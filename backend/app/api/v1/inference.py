from fastapi import APIRouter, HTTPException, status

from app.core.config import settings
from app.schemas.inference import (
    ChatRequest,
    ChatResponse,
    EmbedRequest,
    EmbedResponse,
    JobStatusResponse,
    MediaRequest,
    MediaSubmitResponse,
    ModelsResponse,
)
from app.services.inference_service import InferenceService


router = APIRouter()
service = InferenceService()


@router.post("/chat", response_model=ChatResponse)
async def chat(payload: ChatRequest) -> ChatResponse:
    return service.chat(payload)


@router.post("/media", response_model=MediaSubmitResponse, status_code=202)
async def submit_media(payload: MediaRequest) -> MediaSubmitResponse:
    if not settings.feature_media_queue:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Media generation is disabled (FEATURE_MEDIA_QUEUE=false).",
        )
    return service.submit_media(payload)


@router.get("/jobs/{job_id}", response_model=JobStatusResponse)
async def get_job(job_id: str) -> JobStatusResponse:
    return service.get_job(job_id)


@router.post("/jobs/{job_id}/cancel", response_model=JobStatusResponse)
async def cancel_job(job_id: str) -> JobStatusResponse:
    """Cancel an abandoned job (the frontend beacons this on page unload so a
    reloaded generation doesn't keep clogging the serial queue)."""
    return service.cancel_job(job_id)


@router.get("/models", response_model=ModelsResponse)
async def models() -> ModelsResponse:
    return service.list_models()


@router.post("/embed", response_model=EmbedResponse)
async def embed(payload: EmbedRequest) -> EmbedResponse:
    return service.embed(payload)
