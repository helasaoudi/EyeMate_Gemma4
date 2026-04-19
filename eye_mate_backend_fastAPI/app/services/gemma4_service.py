"""
Gemma 4 multimodal inference (image + text -> text).
Uses google/gemma-4-E4B-it per Hugging Face model card (instruction-tuned, vision + text).
"""

from __future__ import annotations

import io
import logging
import os
import re
from typing import Any, Dict, List, Optional

import numpy as np
import torch
from PIL import Image

from app.config import settings
from app.prompts.document_prompts import PROMPT_EN, PROMPT_FR

logger = logging.getLogger(__name__)

try:
    from transformers import AutoModelForImageTextToText, AutoProcessor
except ImportError:  # pragma: no cover
    AutoModelForImageTextToText = None  # type: ignore
    AutoProcessor = None


def _resolve_inference_device(model: torch.nn.Module) -> torch.device:
    """
    Pick a device for `inputs.to(device)` when using accelerate `device_map`
    (e.g. CUDA). Skips `meta` placeholders from iteration order.
    """
    try:
        emb = model.get_input_embeddings()
        w = getattr(emb, "weight", None)
        if w is not None and getattr(w, "device", None) is not None:
            if w.device.type != "meta":
                return w.device
    except Exception:
        pass
    for t in list(model.parameters()) + list(model.buffers()):
        if torch.is_tensor(t) and t.device.type != "meta":
            return t.device
    return torch.device("cpu")


def _effective_device_map() -> Optional[str]:
    """
    On CPU/MPS, ``device_map='auto'`` can leave Gemma4 partly on ``meta`` while
    weights sit on CPU — then ``generate()`` errors (inputs on cpu, model on meta).
    Use a plain load (``device_map=None``) and ``.to(device)`` instead.
    """
    raw = (settings.DEVICE_MAP or "").strip()
    if not raw or raw.lower() in ("none", "null"):
        return None
    if not torch.cuda.is_available() and raw.lower() == "auto":
        logger.info(
            "[Gemma4] Non-CUDA: using device_map=None + explicit .to(device) "
            "(DEVICE_MAP=auto is unsafe for this model on CPU/MPS)."
        )
        return None
    return raw


def _single_device_target() -> torch.device:
    """Real device when loading with ``device_map=None``."""
    if torch.cuda.is_available():
        return torch.device("cuda")
    use_mps = os.getenv("GEMMA_USE_MPS", "").lower() in ("1", "true", "yes")
    if use_mps and torch.backends.mps.is_available():
        return torch.device("mps")
    return torch.device("cpu")


def _text_from_parsed_response(parsed: Any) -> str:
    """Turn tokenizer ``parse_response`` output into a single user-visible string."""

    def walk(obj: Any) -> str:
        if obj is None:
            return ""
        if isinstance(obj, str):
            return obj.strip()
        if isinstance(obj, dict):
            for key in ("content", "text", "message", "assistant"):
                if key in obj:
                    s = walk(obj[key])
                    if s:
                        return s
            for v in obj.values():
                s = walk(v)
                if s:
                    return s
        if isinstance(obj, (list, tuple)):
            for item in obj:
                s = walk(item)
                if s:
                    return s
        return ""

    return walk(parsed)


def _decode_response_text(proc: Any, response_ids: torch.Tensor) -> str:
    """Decode generated token ids; IT models often need ``parse_response`` on the decoded string."""

    def _try_parse(decoded: str) -> str:
        if not decoded or not hasattr(proc, "parse_response"):
            return ""
        try:
            parsed = proc.parse_response(decoded)
            if isinstance(parsed, str) and parsed.strip():
                return parsed.strip()
            if isinstance(parsed, dict):
                return _text_from_parsed_response(parsed)
        except Exception:
            return ""
        return ""

    for skip_special in (True, False):
        decoded = proc.decode(response_ids, skip_special_tokens=skip_special).strip()
        if not decoded:
            continue
        from_parse = _try_parse(decoded)
        if from_parse:
            return from_parse
        return decoded

    if hasattr(proc, "parse_response"):
        try:
            parsed = proc.parse_response(response_ids)
            if isinstance(parsed, str) and parsed.strip():
                return parsed.strip()
            if isinstance(parsed, dict):
                s = _text_from_parsed_response(parsed)
                if s:
                    return s
        except Exception as e:
            logger.warning("parse_response(token ids) failed: %s", e)

    return ""


_DOCUMENT_TYPE_MAP = {
    "facture": "facture",
    "invoice": "facture",
    "recu": "recu",
    "receipt": "recu",
    "cin": "cin",
    "id": "cin",
    "passeport": "passeport",
    "passport": "passeport",
    "ticket": "ticket",
    "guichet": "guichet",
    "queue": "guichet",
    "contrat": "contrat",
    "contract": "contrat",
    "lettre": "lettre",
    "letter": "lettre",
    "formulaire": "formulaire",
    "form": "formulaire",
    "carte": "carte",
    "card": "carte",
}


class Gemma4Service:
    """Loads one Gemma 4 multimodal model and runs scene + document analysis."""

    def __init__(self) -> None:
        self.model = None
        self.processor = None
        self._device: Optional[torch.device] = None
        self._is_loaded = False
        # Human-readable progress for /health and logs (not the same as "install per request").
        self._load_progress: str = (
            "Queued: load runs once at server start (download cache + load into GPU/RAM)."
        )
        self._load_error: Optional[str] = None

    def _set_load_progress(self, msg: str) -> None:
        self._load_progress = msg
        logger.info("[Gemma4] %s", msg)

    def get_health_status(self) -> tuple[str, str, Optional[str]]:
        """
        Returns (status, message, device) for GET /health.
        status: ready | loading | error
        """
        if self._load_error:
            return "error", self._load_error, None
        if self.is_model_loaded():
            dev = str(self._device) if self._device else "unknown"
            return (
                "ready",
                "Model is loaded and ready for inference.",
                dev,
            )
        return "loading", self._load_progress, None

    def is_model_loaded(self) -> bool:
        return self._is_loaded and self.model is not None and self.processor is not None

    def load_model(self) -> None:
        if self._is_loaded:
            logger.info("Gemma 4 model already loaded")
            return

        if AutoModelForImageTextToText is None or AutoProcessor is None:
            raise RuntimeError("transformers must be installed with Gemma 4 support.")

        model_id = settings.MODEL_NAME

        try:
            self._set_load_progress(
                "Step 1/3: Loading processor & tokenizer from Hugging Face "
                "(first time: downloads; later: uses disk cache)."
            )
            self.processor = AutoProcessor.from_pretrained(
                model_id, 
                trust_remote_code=True
            )

            if torch.cuda.is_available():
                dtype = torch.bfloat16
                if settings.TORCH_DTYPE == "float16":
                    dtype = torch.float16
            else:
                dtype = torch.float32

            self._set_load_progress(
                "Step 2/3: Loading Gemma weights into memory — "
                "FIRST RUN can take many minutes (large download). "
                "Subsequent starts only read from cache."
            )
            device_map = _effective_device_map()
            self.model = AutoModelForImageTextToText.from_pretrained(
                model_id,
                dtype=dtype,
                device_map=device_map,
                attn_implementation=settings.ATTN_IMPLEMENTATION,
                trust_remote_code=True,
            )
            self.model.eval()

            self._set_load_progress("Step 3/3: Resolving device and marking model ready.")
            if device_map is None:
                self._device = _single_device_target()
                self.model.to(self._device)
                logger.info("[Gemma4] Loaded with device_map=None; weights on %s", self._device)
            else:
                self._device = _resolve_inference_device(self.model)
            self._is_loaded = True
            self._load_progress = f"Ready on {self._device}."
            logger.info("[Gemma4] Finished loading. Inference is available.")
        except Exception as e:
            self._load_error = f"Model load failed: {e!s}"
            self._load_progress = self._load_error
            logger.exception("[Gemma4] load_model failed")
            raise

    def get_model_info(self) -> Dict[str, Any]:
        return {
            "device": str(self._device) if self._device else "unknown",
            "is_loaded": self.is_model_loaded(),
            "model_name": settings.MODEL_NAME,
        }

    def get_available_tasks(self) -> List[str]:
        return settings.AVAILABLE_TASKS

    def analyze_image(self, image_bytes: bytes, task_prompt: str) -> Dict[str, Any]:
        """Scene / camera description (replaces Florence-2 /infer)."""
        if not self.is_model_loaded():
            raise RuntimeError("Model is not loaded yet. Please wait and try again.")
        if not image_bytes:
            raise ValueError("Empty image file received")

        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        text = self._run_multimodal_generate(
            user_text=task_prompt,
            pil_image=img,
            max_new_tokens=settings.MAX_NEW_TOKENS_SCENE,
        )
        return {
            "result": {"description": text},
            "task": task_prompt,
            "image_size": {"width": img.width, "height": img.height},
        }

    def analyze_document(
        self, image_bytes: bytes, language: str = "fr"
    ) -> Dict[str, Any]:
        """Structured document reading for ReadDocument flow."""
        if not self.is_model_loaded():
            raise RuntimeError("Model is not loaded yet. Please wait and try again.")
        if not image_bytes:
            raise ValueError("Empty image file received")

        lang = (language or "fr").lower()
        prompt = PROMPT_FR if lang.startswith("fr") else PROMPT_EN

        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        raw = self._run_multimodal_generate(
            user_text=prompt,
            pil_image=img,
            max_new_tokens=settings.MAX_NEW_TOKENS_DOCUMENT,
        )
        doc_type, summary, details = _parse_structured_document(raw, lang.startswith("fr"))
        return {
            "type": doc_type,
            "summary": summary,
            "details": details,
        }

    def _run_multimodal_generate(
        self,
        user_text: str,
        pil_image: Image.Image,
        max_new_tokens: int,
    ) -> str:
        assert self.model is not None and self.processor is not None and self._device is not None

        proc = self.processor
        # IT checkpoint expects chat layout + generation prompt (assistant header). Raw
        # image_token+text often yields EOS immediately and an empty decode.
        rgb = np.copy(np.asarray(pil_image.convert("RGB"), dtype=np.uint8))
        conversation = [
            {
                "role": "user",
                "content": [
                    {"type": "image", "image": rgb},
                    {"type": "text", "text": user_text.strip()},
                ],
            }
        ]
        try:
            inputs = proc.apply_chat_template(
                conversation,
                tokenize=True,
                add_generation_prompt=True,
                return_tensors="pt",
                return_dict=True,
                processor_kwargs={
                    "padding": True,
                    "return_mm_token_type_ids": True,
                },
            )
            logger.debug("Gemma4 inference: apply_chat_template + in-memory numpy image.")
        except Exception as e:
            logger.warning(
                "apply_chat_template failed (%s); falling back to image_token prompt.", e
            )
            placeholder = proc.image_token
            inputs = proc(
                images=[[rgb]],
                text=[f"{placeholder}{user_text.strip()}"],
                return_tensors="pt",
                return_mm_token_type_ids=True,
                padding=True,
            )

        inputs = inputs.to(self._device)

        input_len = inputs["input_ids"].shape[-1]

        # Greedy decoding: hub generation_config.json may set top_p/top_k for sampling;
        # those values conflict with do_sample=False and trigger HF warnings.
        with torch.no_grad():
            outputs = self.model.generate(
                **inputs,
                max_new_tokens=max_new_tokens,
                do_sample=False,
                temperature=1.0,
                top_p=1.0,
                top_k=50,
            )

        sequences = outputs.sequences if hasattr(outputs, "sequences") else outputs
        response_ids = sequences[0][input_len:]

        return _decode_response_text(proc, response_ids)


def _parse_structured_document(text: str, french: bool) -> tuple[str, str, str]:
    """Mirror mobile geminiService parsing for TYPE / RÉSUMÉ|SUMMARY / DÉTAILS|DETAILS."""
    cleaned = text.replace("*", "").strip()

    type_m = re.search(r"TYPE:\s*(\w+)", cleaned, re.IGNORECASE)
    type_str = type_m.group(1).lower() if type_m else "autre"
    doc_type = _DOCUMENT_TYPE_MAP.get(type_str, "autre")

    if french:
        summary_m = re.search(
            r"RÉSUMÉ:\s*([\s\S]*?)(?=DÉTAILS:|$)", cleaned, re.IGNORECASE
        )
        details_m = re.search(r"DÉTAILS:\s*([\s\S]*?)$", cleaned, re.IGNORECASE)
    else:
        summary_m = re.search(
            r"SUMMARY:\s*([\s\S]*?)(?=DETAILS:|DÉTAILS:|$)", cleaned, re.IGNORECASE
        )
        details_m = re.search(r"DETAILS:\s*([\s\S]*?)$", cleaned, re.IGNORECASE)

    summary = summary_m.group(1).strip() if summary_m else ""
    details = details_m.group(1).strip() if details_m else ""

    if not summary or len(summary) < 10:
        lines = [ln for ln in cleaned.split("\n") if ln.strip()]
        summary = "\n".join(lines[:5])
        details = cleaned

    return doc_type, summary, details
