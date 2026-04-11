"""
Gemma 4 multimodal inference (image + text -> text).
Uses google/gemma-4-E4B-it per Hugging Face model card (instruction-tuned, vision + text).
"""

from __future__ import annotations

import io
import logging
import re
from typing import Any, Dict, List, Optional

import torch
from PIL import Image

from app.config import settings
from app.prompts.document_prompts import PROMPT_EN, PROMPT_FR

logger = logging.getLogger(__name__)

try:
    from transformers import AutoModelForMultimodalLM, AutoProcessor
except ImportError:  # pragma: no cover
    AutoModelForMultimodalLM = None  # type: ignore
    AutoProcessor = None


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

        if AutoModelForMultimodalLM is None or AutoProcessor is None:
            raise RuntimeError("transformers must be installed with Gemma 4 support.")

        model_id = settings.MODEL_NAME

        try:
            self._set_load_progress(
                "Step 1/3: Loading processor & tokenizer from Hugging Face "
                "(first time: downloads; later: uses disk cache)."
            )
            self.processor = AutoProcessor.from_pretrained(model_id)

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
            self.model = AutoModelForMultimodalLM.from_pretrained(
                model_id,
                dtype=dtype,
                device_map=settings.DEVICE_MAP,
                attn_implementation=settings.ATTN_IMPLEMENTATION,
            )
            self.model.eval()

            self._set_load_progress("Step 3/3: Resolving device and marking model ready.")
            self._device = next(self.model.parameters()).device
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

        # Do NOT use apply_chat_template + image URLs: HF may write temp files (file://)
        # and fail in Docker. Use Processor.__call__ with PIL + image_token placeholders
        # (see transformers tests/models/gemma4/test_processing_gemma4.py).
        proc = self.processor
        # Instruction-tuned Gemma 4 expects chat template + add_generation_prompt (HF notebooks).
        # Raw image_token+text omits roles / assistant header and often yields empty generations.
        messages = [
            {
                "role": "user",
                "content": [
                    {"type": "image", "image": pil_image},
                    {"type": "text", "text": user_text.strip()},
                ],
            }
        ]
        try:
            inputs = proc.apply_chat_template(
                messages,
                tokenize=True,
                add_generation_prompt=True,
                return_dict=True,
                return_tensors="pt",
                processor_kwargs={
                    "padding": True,
                    "return_mm_token_type_ids": True,
                },
            )
            logger.debug("Gemma4 inference: apply_chat_template + PIL image (no file URL).")
        except Exception as e:
            logger.warning(
                "apply_chat_template failed (%s); using processor() PIL fallback", e
            )
            placeholder = proc.image_token
            inputs = proc(
                images=[[pil_image]],
                text=[f"{placeholder}{user_text.strip()}"],
                return_tensors="pt",
                return_mm_token_type_ids=True,
                padding=True,
            )

        inputs = inputs.to(self._device)

        input_len = inputs["input_ids"].shape[-1]

        with torch.no_grad():
            outputs = self.model.generate(
                **inputs,
                max_new_tokens=max_new_tokens,
                do_sample=False,
            )

        sequences = outputs.sequences if hasattr(outputs, "sequences") else outputs
        response_ids = sequences[0][input_len:]
        # Match HF Gemma 4 recipes: decode with skip_special_tokens=True, then parse_response;
        # assistant text is under "content", not "text".
        raw_text = proc.decode(response_ids, skip_special_tokens=True).strip()

        if hasattr(proc, "parse_response"):
            try:
                parsed = proc.parse_response(
                    proc.decode(response_ids, skip_special_tokens=True)
                )
                if isinstance(parsed, str) and parsed.strip():
                    return parsed.strip()
                if isinstance(parsed, dict):
                    for key in ("content", "text"):
                        val = parsed.get(key)
                        if val is not None and str(val).strip():
                            return str(val).strip()
            except Exception as e:  # pragma: no cover
                logger.warning("parse_response failed, using raw decode: %s", e)

        return raw_text


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
