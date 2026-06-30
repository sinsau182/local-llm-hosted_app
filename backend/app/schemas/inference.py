from typing import Literal

from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str = Field(min_length=1)


class ChatRequest(BaseModel):
    prompt: str = Field(min_length=1)
    model: str = "auto"
    max_tokens: int = 2000
    messages: list[ChatMessage] = Field(default_factory=list)


class ChatResponse(BaseModel):
    request_id: str
    output: str
    routed_model: str = ""


class MediaRequest(BaseModel):
    prompt: str = Field(min_length=1)
    media_type: str = Field(default="image", pattern="^(image|video)$")
    model: str = "flux1-schnell"
    width: int = Field(default=1024, ge=256, le=1536)
    height: int = Field(default=1024, ge=256, le=1536)
    steps: int = Field(default=4, ge=1, le=20)
    seed: int | None = None
    # Video-only (ignored for images). None -> service uses configured defaults.
    num_frames: int | None = Field(default=None, ge=9, le=257)
    fps: float | None = Field(default=None, ge=1, le=60)


class MediaSubmitResponse(BaseModel):
    job_id: str
    status: str
    position: int = 0       # 1-based place in line (0 = not queued)
    eta_seconds: int = 0    # rough estimate until this job completes


class JobStatusResponse(BaseModel):
    job_id: str
    status: str
    media_type: str = ""
    prompt: str = ""
    image: str | None = None  # data URL, present when an image job is COMPLETED
    video: str | None = None  # data URL, present when a video job is COMPLETED
    error: str | None = None
    position: int = 0         # 1-based place in line while QUEUED (0 otherwise)
    eta_seconds: int = 0      # rough estimate until this job completes


class ModelInfo(BaseModel):
    name: str
    precision: str
    vram_gb: float


class ModelsResponse(BaseModel):
    models: list[ModelInfo]


class EmbedRequest(BaseModel):
    input: str | list[str] = Field(min_length=1)


class EmbedResponse(BaseModel):
    embeddings: list[list[float]]
    model: str
    dimensions: int


class AddDocRequest(BaseModel):
    text: str = Field(min_length=1)
    metadata: dict[str, str] = Field(default_factory=dict)
    doc_id: str = ""


class AddDocResponse(BaseModel):
    doc_id: str
    dimensions: int


class SearchRequest(BaseModel):
    query: str = Field(min_length=1)
    n_results: int = Field(default=5, ge=1, le=20)


class SearchResult(BaseModel):
    doc_id: str
    text: str
    metadata: dict[str, str]
    distance: float


class SearchResponse(BaseModel):
    results: list[SearchResult]
    query: str
