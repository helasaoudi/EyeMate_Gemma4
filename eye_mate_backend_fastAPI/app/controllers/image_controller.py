import base64
import logging
from typing import Any

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.models.schemas import (
    ApiInfoResponse,
    DocumentAnalysisRequest,
    DocumentAnalysisResponse,
    HealthResponse,
    ImageAnalysisResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter()


def get_gemma_service():
    from app.app import gemma4_service

    return gemma4_service


@router.get("/", response_model=ApiInfoResponse)
async def get_api_info():
    """API information and available endpoints."""
    try:
        service = get_gemma_service()
        model_info = service.get_model_info()
        h_status, _, h_device = service.get_health_status()

        return ApiInfoResponse(
            message="Welcome to EyeMate Gemma 4 API!",
            status=h_status,
            device=h_device or model_info["device"],
            endpoints={
                "/infer": "POST - Scene image analysis (multipart)",
                "/document/analyze": "POST - Document analysis (JSON, base64 image)",
                "/health": "GET - Check if model is loaded",
            },
            available_tasks=service.get_available_tasks(),
        )
    except Exception as e:
        logger.error("Error getting API info: %s", str(e))
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/health", response_model=HealthResponse)
async def health_check():
    """Check if the model is loaded and ready (message describes current step)."""
    try:
        service = get_gemma_service()
        status, message, device = service.get_health_status()
        return HealthResponse(status=status, message=message, device=device)
    except Exception as e:
        logger.error("Error checking health: %s", str(e))
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/infer", response_model=ImageAnalysisResponse)
async def analyze_image(
    image: UploadFile = File(...),
    text: str = Form(
        "Describe in detail what you see in this image, including objects, colors, and their positions."
    ),
):
    """
    Scene / environment image analysis (Camera tab).
    Multipart: `image` file + optional `text` instruction for Gemma 4.
    """
    try:
        logger.info("POST /infer — receiving upload (filename=%s)", image.filename)
        image_bytes = await image.read()
        logger.info(
            "POST /infer — bytes read (%d), starting Gemma inference", len(image_bytes)
        )
        service = get_gemma_service()
        result: dict[str, Any] = service.analyze_image(image_bytes, text)
        result["image_name"] = image.filename
        return ImageAnalysisResponse(**result)
    except ValueError as e:
        logger.error("Validation error: %s", str(e))
        raise HTTPException(status_code=400, detail=str(e)) from e
    except RuntimeError as e:
        logger.error("Runtime error: %s", str(e))
        raise HTTPException(status_code=503, detail=str(e)) from e
    except Exception as e:
        logger.error("Unexpected error during inference: %s", str(e), exc_info=True)
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/document/analyze", response_model=DocumentAnalysisResponse)
async def analyze_document(req: DocumentAnalysisRequest):
    """
    Document reading for ReadDocument: structured TYPE / summary / details.
    JSON: `image_base64`, `language` (fr|en).
    """
    try:
        raw_b64 = (req.image_base64 or "").strip()
        if raw_b64.startswith("data:") and "," in raw_b64:
            raw_b64 = raw_b64.split(",", 1)[1]
        try:
            image_bytes = base64.b64decode(raw_b64, validate=False)
        except Exception as e:
            raise HTTPException(
                status_code=400, detail=f"Invalid base64 image: {e}"
            ) from e

        if not image_bytes:
            raise HTTPException(status_code=400, detail="Empty image data")

        lang = req.language.lower() if req.language else "fr"
        if lang not in ("fr", "en"):
            lang = "fr"

        service = get_gemma_service()
        out = service.analyze_document(image_bytes, language=lang)
        return DocumentAnalysisResponse(**out)
    except HTTPException:
        raise
    except ValueError as e:
        logger.error("Validation error: %s", str(e))
        raise HTTPException(status_code=400, detail=str(e)) from e
    except RuntimeError as e:
        logger.error("Runtime error: %s", str(e))
        raise HTTPException(status_code=503, detail=str(e)) from e
    except Exception as e:
        logger.error("Unexpected error during document analysis: %s", str(e), exc_info=True)
        raise HTTPException(status_code=500, detail=str(e)) from e
