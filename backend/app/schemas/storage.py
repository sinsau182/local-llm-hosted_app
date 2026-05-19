from pydantic import BaseModel


class QuotaResponse(BaseModel):
    storage_quota_bytes: int
    storage_used_bytes: int
    storage_available_bytes: int


class Artifact(BaseModel):
    id: str
    media_type: str
    file_path: str
    size_bytes: int


class ArtifactListResponse(BaseModel):
    items: list[Artifact]
