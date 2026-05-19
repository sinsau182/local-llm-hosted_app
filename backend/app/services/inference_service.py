from uuid import uuid4

from app.schemas.inference import (
    ChatRequest,
    ChatResponse,
    JobStatusResponse,
    MediaRequest,
    MediaSubmitResponse,
    ModelInfo,
    ModelsResponse,
)


class InferenceService:
    def chat(self, payload: ChatRequest) -> ChatResponse:
        return ChatResponse(
            request_id=str(uuid4()),
            output=f"[stub:{payload.model}] {payload.prompt[:200]}",
        )

    def submit_media(self, payload: MediaRequest) -> MediaSubmitResponse:
        return MediaSubmitResponse(job_id=str(uuid4()), status="PENDING")

    def get_job(self, job_id: str) -> JobStatusResponse:
        return JobStatusResponse(job_id=job_id, status="PENDING")

    def list_models(self) -> ModelsResponse:
        return ModelsResponse(
            models=[
                ModelInfo(name="qwen2.5-coder:14b", precision="Q4_K_M", vram_gb=12.5),
                ModelInfo(name="flux.1-dev", precision="FP16", vram_gb=24.0),
                ModelInfo(name="wan-2.2", precision="Q8_0", vram_gb=38.0),
            ]
        )
