from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    prompt: str = Field(min_length=1)
    model: str = "qwen2.5-coder:14b"
    max_tokens: int = 512


class ChatResponse(BaseModel):
    request_id: str
    output: str


class MediaRequest(BaseModel):
    prompt: str = Field(min_length=1)
    media_type: str = Field(pattern="^(image|video)$")
    model: str


class MediaSubmitResponse(BaseModel):
    job_id: str
    status: str


class JobStatusResponse(BaseModel):
    job_id: str
    status: str


class ModelInfo(BaseModel):
    name: str
    precision: str
    vram_gb: float


class ModelsResponse(BaseModel):
    models: list[ModelInfo]
