from contextlib import asynccontextmanager
import logging
import threading

from fastapi import FastAPI
from starlette.requests import Request

from app.controllers.image_controller import router
from app.services.gemma4_service import Gemma4Service
from app.config import settings

logging.basicConfig(level=getattr(logging, settings.LOG_LEVEL))
logger = logging.getLogger(__name__)

gemma4_service = Gemma4Service()


def _load_model_in_background() -> None:
    """HF download + torch load can take a long time; must not block HTTP startup."""
    try:
        logger.info(
            "Background thread started — see [Gemma4] logs for Step 1/3, 2/3, 3/3."
        )
        gemma4_service.load_model()
        logger.info("Background thread: Gemma 4 is ready for inference.")
    except Exception:
        logger.exception("Background thread: model load failed (see [Gemma4] above)")


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
