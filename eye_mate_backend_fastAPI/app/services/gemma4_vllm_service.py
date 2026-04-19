"""
Gemma 4 multimodal inference using vLLM for optimized performance.
Replaces standard transformers with vLLM for faster inference and lower GPU memory.
"""

from __future__ import annotations

import base64
import io
import logging
import re
from typing import Any, Dict, List, Optional

import numpy as np
from PIL import Image

from app.config import settings
from app.prompts.document_prompts import PROMPT_EN, PROMPT_FR

logger = logging.getLogger(__name__)

try:
    from vllm import LLM, SamplingParams
    from vllm.multimodal.utils import fetch_image
except ImportError:
    LLM = None
    SamplingParams = None
    fetch_image = None


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


class Gemma4VLLMService:
    """Loads Gemma 4 multimodal model using vLLM for optimized inference."""

    def __init__(self) -> None:
        self.llm: Optional[LLM] = None
        self._is_loaded = False
        self._load_progress: str = (
            "Queued: vLLM will load the model with optimized memory management."
        )
        self._load_error: Optional[str] = None

    def _set_load_progress(self, msg: str) -> None:
        self._load_progress = msg
        logger.info("[Gemma4-vLLM] %s", msg)

    def get_health_status(self) -> tuple[str, str, Optional[str]]:
        """
        Returns (status, message, device) for GET /health.
        status: ready | loading | error
        """
        if self._load_error:
            return "error", self._load_error, None
        if self.is_model_loaded():
            return (
                "ready",
                "vLLM model is loaded and ready for inference.",
                "cuda",
            )
        return "loading", self._load_progress, None

    def is_model_loaded(self) -> bool:
        return self._is_loaded and self.llm is not None

    def load_model(self) -> None:
        """Load model using vLLM with optimized settings."""
        if self._is_loaded:
            logger.info("Gemma 4 vLLM model already loaded")
            return

        if LLM is None or SamplingParams is None:
            raise RuntimeError(
                "vLLM must be installed. Run: pip install vllm"
            )

        model_id = settings.MODEL_NAME

        try:
            self._set_load_progress(
                "Step 1/2: Initializing vLLM engine with optimized memory settings."
            )
            
            # vLLM initialization with optimal settings
            self.llm = LLM(
                model=model_id,
                # GPU memory utilization (0.9 = 90% of available GPU memory)
                gpu_memory_utilization=settings.VLLM_GPU_MEMORY_UTILIZATION,
                # Tensor parallelism for multi-GPU setups
                tensor_parallel_size=settings.VLLM_TENSOR_PARALLEL_SIZE,
                # Data type for weights
                dtype=settings.VLLM_DTYPE,
                # Enable/disable chunked prefill for better throughput
                enable_chunked_prefill=settings.VLLM_ENABLE_CHUNKED_PREFILL,
                # Max model length (adjust based on your needs)
                max_model_len=settings.VLLM_MAX_MODEL_LEN,
                # Trust remote code (required for some models)
                trust_remote_code=True,
                # Enforce eager mode (set to False for better performance with CUDA graphs)
                enforce_eager=settings.VLLM_ENFORCE_EAGER,
                # Enable prefix caching for repeated prompts
                enable_prefix_caching=settings.VLLM_ENABLE_PREFIX_CACHING,
            )

            self._set_load_progress("Step 2/2: vLLM engine initialized successfully.")
            self._is_loaded = True
            self._load_progress = "Ready with vLLM optimization."
            logger.info("[Gemma4-vLLM] Model loaded. Inference is available.")
        except Exception as e:
            self._load_error = f"vLLM model load failed: {e!s}"
            self._load_progress = self._load_error
            logger.exception("[Gemma4-vLLM] load_model failed")
            raise

    def get_model_info(self) -> Dict[str, Any]:
        return {
            "device": "cuda",
            "is_loaded": self.is_model_loaded(),
            "model_name": settings.MODEL_NAME,
            "engine": "vLLM",
        }

    def get_available_tasks(self) -> List[str]:
        return settings.AVAILABLE_TASKS

    def analyze_image(self, image_bytes: bytes, task_prompt: str) -> Dict[str, Any]:
        """Scene / camera description using vLLM."""
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
        """Structured document reading using vLLM."""
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
        """Run inference using vLLM with multimodal input."""
        assert self.llm is not None

        # Convert PIL image to base64 or data URL for vLLM
        # vLLM expects images as URLs, file paths, or base64 encoded strings
        buffered = io.BytesIO()
        pil_image.save(buffered, format="PNG")
        img_str = base64.b64encode(buffered.getvalue()).decode()
        image_url = f"data:image/png;base64,{img_str}"

        # Construct chat-style prompt for instruction-tuned model
        # Format may vary based on the specific model's chat template
        prompt = f"<image>\n{user_text.strip()}"

        # vLLM sampling parameters (greedy decoding)
        sampling_params = SamplingParams(
            temperature=0.0,  # Greedy decoding
            max_tokens=max_new_tokens,
            top_p=1.0,
            top_k=-1,  # -1 means disabled
        )

        # Generate response
        try:
            outputs = self.llm.generate(
                {
                    "prompt": prompt,
                    "multi_modal_data": {
                        "image": image_url,
                    },
                },
                sampling_params=sampling_params,
            )
            
            # Extract generated text
            if outputs and len(outputs) > 0:
                generated_text = outputs[0].outputs[0].text
                return generated_text.strip()
            else:
                logger.warning("vLLM generated empty output")
                return ""
        except Exception as e:
            logger.exception("vLLM generation failed: %s", e)
            raise


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

    return doc_type, summary, details
