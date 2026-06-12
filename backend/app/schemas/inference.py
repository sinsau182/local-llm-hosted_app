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
