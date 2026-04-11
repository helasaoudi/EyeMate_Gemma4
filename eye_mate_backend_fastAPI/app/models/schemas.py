from pydantic import BaseModel, Field
from typing import Dict, Any, Optional


class ImageAnalysisRequest(BaseModel):
    """Request model for image analysis"""

    text: str = "Describe this image in detail"

    class Config:
        json_schema_extra = {
            "example": {
                "text": "Describe this image in detail",
            }
        }


class ImageAnalysisResponse(BaseModel):
    """Response model for image analysis (scene / camera)"""

    result: Dict[str, Any]
    task: str
    image_name: Optional[str] = None
    image_size: Optional[Dict[str, int]] = None

    class Config:
        json_schema_extra = {
            "example": {
                "result": {
                    "description": "A person is crossing a street at a crosswalk.",
                },
                "task": "Describe in detail what you see",
                "image_name": "example.jpg",
                "image_size": {"width": 3000, "height": 2003},
            }
        }


class DocumentAnalysisRequest(BaseModel):
    """JSON body for /document/analyze"""

    image_base64: str = Field(..., description="JPEG/PNG image as base64 (no data: prefix required)")
    language: str = Field(default="fr", description="fr or en")


class DocumentAnalysisResponse(BaseModel):
    """Structured document analysis for ReadDocument screen"""

    type: str
    summary: str
    details: str


class HealthResponse(BaseModel):
    """Response model for health check"""

    status: str
    message: str
    device: Optional[str] = None

    class Config:
        json_schema_extra = {
            "example": {
                "status": "ready",
                "message": "Model is loaded and ready",
                "device": "cuda:0",
            }
        }


class ApiInfoResponse(BaseModel):
    """Response model for API information"""

    message: str
    status: str
    device: str
    endpoints: Dict[str, str]
    available_tasks: list[str]

    class Config:
        json_schema_extra = {
            "example": {
                "message": "Welcome to EyeMate Gemma 4 API!",
                "status": "ready",
                "device": "cuda:0",
                "endpoints": {
                    "/infer": "POST - Scene image analysis",
                    "/document/analyze": "POST - Document reading (JSON)",
                    "/health": "GET - Health check",
                },
                "available_tasks": ["..."],
            }
        }
