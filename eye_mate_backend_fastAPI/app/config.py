"""
Configuration settings for the EyeMate FastAPI application
"""

import os


class Settings:
    """Application settings"""

    # API Settings
    API_TITLE: str = "EyeMate Gemma 4 API"
    API_DESCRIPTION: str = (
        "FastAPI service for multimodal image analysis using Google Gemma 4 (E4B instruction-tuned)."
    )
    API_VERSION: str = "2.0.0"

    # Server Settings
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))

    # Gemma 4 — image+text -> text (instruction-tuned multimodal)
    # See: https://huggingface.co/google/gemma-4-E4B-it
    MODEL_NAME: str = os.getenv("GEMMA4_MODEL_NAME", "google/gemma-4-E4B-it")
    MAX_NEW_TOKENS_SCENE: int = int(os.getenv("MAX_NEW_TOKENS_SCENE", "1024"))
    MAX_NEW_TOKENS_DOCUMENT: int = int(os.getenv("MAX_NEW_TOKENS_DOCUMENT", "2048"))

    # torch dtype: BFLOAT16 on CUDA, float32 on CPU unless overridden
    TORCH_DTYPE: str = os.getenv("TORCH_DTYPE", "bfloat16")

    # On CPU/MPS, gemma4_service ignores DEVICE_MAP=auto and loads with device_map=None + .to(device).
    DEVICE_MAP: str = os.getenv("DEVICE_MAP", "auto")
    ATTN_IMPLEMENTATION: str = os.getenv("ATTN_IMPLEMENTATION", "sdpa")

    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")

    # Natural-language prompts for /infer (camera); not Florence task tokens
    AVAILABLE_TASKS: list[str] = [
        "Describe in detail what you see in this image, including objects, colors, and their positions.",
        "Give a concise caption of this image for a blind user.",
        "List the main objects and their approximate positions in this scene.",
    ]


settings = Settings()
