from contextlib import asynccontextmanager
import logging
import threading

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.requests import Request

from app.controllers.image_controller import router
from app.config import settings

logging.basicConfig(level=getattr(logging, settings.LOG_LEVEL))
logger = logging.getLogger(__name__)

# Conditionally use vLLM or standard transformers based on configuration
if settings.USE_VLLM:
    logger.info("Using vLLM engine for optimized inference")
    from app.services.gemma4_vllm_service import Gemma4VLLMService
    gemma4_service = Gemma4VLLMService()
else:
    logger.info("Using standard Transformers engine")
    from app.services.gemma4_service import Gemma4Service
    gemma4_service = Gemma4Service()


def _load_model_in_background() -> None:
    """HF download + torch load can take a long time; must not block HTTP startup."""
    try:
        engine_name = "vLLM" if settings.USE_VLLM else "Transformers"
        logger.info(
            f"Background thread started — loading model with {engine_name} engine."
        )
        gemma4_service.load_model()
        logger.info(f"Background thread: Gemma 4 is ready for inference ({engine_name}).")
    except Exception:
        logger.exception("Background thread: model load failed")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # If load_model() runs here, Uvicorn will not accept TCP connections until it returns.
    # Loading in a thread lets /health, middleware logs, and 503 on /infer work immediately.
    logger.info(
        "FastAPI starting — HTTP available now; model loading in background thread."
    )
    threading.Thread(
        target=_load_model_in_background, name="gemma4-load", daemon=True
    ).start()
    yield
    logger.info("FastAPI server shutting down...")


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.API_TITLE,
        description=settings.API_DESCRIPTION,
        version=settings.API_VERSION,
        lifespan=lifespan,
    )

    # CORS middleware for mobile frontend connectivity
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # Allow all origins for development/ngrok
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def log_incoming_requests(request: Request, call_next):
        # Logs as soon as the TCP request hits the app (before body / inference).
        client = request.client.host if request.client else "?"
        logger.info("HTTP %s %s from %s", request.method, request.url.path, client)
        response = await call_next(request)
        return response

    app.include_router(router)
    return app


app = create_app()
