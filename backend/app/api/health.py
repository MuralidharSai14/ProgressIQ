"""Health check endpoint."""
from fastapi import APIRouter
from app.config import get_settings
from app.ai.embeddings import is_model_available

router = APIRouter()
settings = get_settings()


@router.get("/health")
async def health_check():
    """
    Basic health check. The frontend calls this to verify the backend is running.
    Returns the AI provider mode and feature availability.
    """
    return {
        "status": "ok",
        "app": settings.app_name,
        "version": settings.app_version,
        "ai_provider": settings.ai_provider,
        "semantic_matching": is_model_available(),
        "confidence_threshold": settings.confidence_threshold,
        "message": "PROGRESSIQ API is running",
    }
