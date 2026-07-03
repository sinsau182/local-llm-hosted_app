"""Per-user media history, backed by Postgres + the media bucket.

Artifacts are ingested from ComfyUI (see media_ingest_service). This service
reads that history for the storage/library UI and generates the API path used
to stream each object back to the browser. Deleting an artifact removes both the
bucket object and the Postgres row.
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.artifact import Artifact as ArtifactRow
from app.repositories.artifact_repository import ArtifactRepository
from app.schemas.storage import Artifact, ArtifactListResponse, QuotaResponse
from app.services.media_bucket import bucket


class StorageService:
    def __init__(self, db: Session):
        self.repo = ArtifactRepository(db)

    def _content_url(self, artifact_id: str) -> str:
        return f"{settings.api_prefix}/storage/files/{artifact_id}/content"

    def _to_schema(self, row: ArtifactRow) -> Artifact:
        return Artifact(
            id=str(row.id),
            media_type=row.media_type,
            file_path=row.file_path,
            size_bytes=row.size_bytes,
            url=self._content_url(str(row.id)),
            created_at=row.created_at.isoformat() if row.created_at else None,
        )

    def get_quota(self, user_id: str) -> QuotaResponse:
        used = self.repo.used_bytes(user_id)
        quota = self.repo.quota_bytes(user_id, settings.max_storage_bytes)
        return QuotaResponse(
            storage_quota_bytes=quota,
            storage_used_bytes=used,
            storage_available_bytes=max(quota - used, 0),
        )

    def list_files(self, user_id: str) -> ArtifactListResponse:
        return ArtifactListResponse(items=[self._to_schema(r) for r in self.repo.list_for_user(user_id)])

    def get_artifact(self, artifact_id: str) -> ArtifactRow | None:
        """Look up by id only (used by the public content-streaming route;
        artifact ids are unguessable UUIDs)."""
        return self.repo.get(artifact_id)

    def delete_file(self, user_id: str, artifact_id: str) -> bool:
        row = self.repo.get_owned(user_id, artifact_id)
        if row is None:
            return False
        bucket.delete(row.file_path)
        self.repo.delete(row)
        return True
