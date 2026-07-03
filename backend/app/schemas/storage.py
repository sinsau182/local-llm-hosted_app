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
    # API path that streams the object from the media bucket. The frontend
    # prepends the API base URL to preview/download the asset.
    url: str | None = None
    created_at: str | None = None


class ArtifactListResponse(BaseModel):
    items: list[Artifact]
