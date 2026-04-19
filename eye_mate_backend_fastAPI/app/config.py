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

    # vLLM Configuration
    # Set USE_VLLM=true to enable vLLM engine (much faster inference)
    # Note: vLLM only works on Linux with NVIDIA GPUs, not on macOS
    USE_VLLM: bool = os.getenv("USE_VLLM", "false").lower() in ("true", "1", "yes")
    
    # vLLM GPU memory utilization (0.0-1.0). Higher = more memory used, better performance
    VLLM_GPU_MEMORY_UTILIZATION: float = float(
        os.getenv("VLLM_GPU_MEMORY_UTILIZATION", "0.90")
    )
    
    # Tensor parallelism size (number of GPUs to split model across)
    VLLM_TENSOR_PARALLEL_SIZE: int = int(os.getenv("VLLM_TENSOR_PARALLEL_SIZE", "1"))
    
    # Data type for model weights (auto, half, float16, bfloat16, float32)
    VLLM_DTYPE: str = os.getenv("VLLM_DTYPE", "auto")
    
    # Enable chunked prefill for better throughput with long contexts
    VLLM_ENABLE_CHUNKED_PREFILL: bool = os.getenv(
        "VLLM_ENABLE_CHUNKED_PREFILL", "true"
    ).lower() in ("true", "1", "yes")
    
    # Maximum model sequence length (reduce if OOM)
    VLLM_MAX_MODEL_LEN: int = int(os.getenv("VLLM_MAX_MODEL_LEN", "8192"))
    
    # Enforce eager execution (disable CUDA graphs). Set to false for better perf
    VLLM_ENFORCE_EAGER: bool = os.getenv("VLLM_ENFORCE_EAGER", "false").lower() in (
        "true",
        "1",
        "yes",
    )
    
    # Enable prefix caching to reuse KV cache for repeated prompt prefixes
    VLLM_ENABLE_PREFIX_CACHING: bool = os.getenv(
        "VLLM_ENABLE_PREFIX_CACHING", "true"
    ).lower() in ("true", "1", "yes")

    # Natural-language prompts for /infer (camera); not Florence task tokens
    AVAILABLE_TASKS: list[str] = [
        "Describe in detail what you see in this image, including objects, colors, and their positions.",
        "Give a concise caption of this image for a blind user.",
        "List the main objects and their approximate positions in this scene.",
    ]


settings = Settings()
