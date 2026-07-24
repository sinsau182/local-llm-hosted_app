import json
from urllib import error

from fastapi import APIRouter, File, Form, HTTPException, Response, UploadFile, status

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
    SpeechRequest,
    TranscriptionResponse,
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


@router.post("/audio/speech")
async def audio_speech(payload: SpeechRequest) -> Response:
    """Kokoro TTS. Returns the synthesized audio bytes (Content-Type set to the
    requested/default format). Synchronous — Kokoro is a CPU always-on sidecar."""
    if not settings.feature_audio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Audio generation is disabled (FEATURE_AUDIO=false).",
        )
    try:
        audio, media_type = service.synthesize_speech(payload)
    except (error.URLError, error.HTTPError, TimeoutError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Kokoro TTS unavailable: {exc}",
        ) from exc
    return Response(content=audio, media_type=media_type)


@router.post("/audio/transcriptions", response_model=TranscriptionResponse)
async def audio_transcriptions(
    file: UploadFile = File(...),
    model: str = Form(""),
    language: str = Form(""),
) -> TranscriptionResponse:
    """Whisper STT. Accepts an audio upload and returns the transcript.
    Synchronous — Whisper is a CPU always-on sidecar."""
    if not settings.feature_audio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Audio transcription is disabled (FEATURE_AUDIO=false).",
        )
    data = await file.read()
    if not data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Empty audio upload.",
        )
    try:
        return service.transcribe(
            data,
            file.filename or "audio.wav",
            file.content_type or "application/octet-stream",
            model,
            language,
        )
    except (error.URLError, error.HTTPError, TimeoutError, ValueError, json.JSONDecodeError) as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Whisper STT unavailable: {exc}",
        ) from exc


@router.get("/models", response_model=ModelsResponse)
async def models() -> ModelsResponse:
    return service.list_models()


@router.post("/embed", response_model=EmbedResponse)
async def embed(payload: EmbedRequest) -> EmbedResponse:
    return service.embed(payload)
