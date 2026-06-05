from fastapi import APIRouter

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
    return service.submit_media(payload)


@router.get("/jobs/{job_id}", response_model=JobStatusResponse)
async def get_job(job_id: str) -> JobStatusResponse:
    return service.get_job(job_id)


@router.get("/models", response_model=ModelsResponse)
async def models() -> ModelsResponse:
    return service.list_models()


@router.post("/embed", response_model=EmbedResponse)
async def embed(payload: EmbedRequest) -> EmbedResponse:
    return service.embed(payload)
