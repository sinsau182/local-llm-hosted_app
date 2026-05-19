from pathlib import Path

from app.core.config import settings
from app.schemas.storage import Artifact, ArtifactListResponse, QuotaResponse


class StorageService:
    def get_quota(self, user_id: str) -> QuotaResponse:
        user_root = Path(settings.media_root) / user_id
        used = 0
        if user_root.exists():
            used = sum(p.stat().st_size for p in user_root.rglob("*") if p.is_file())
        return QuotaResponse(
            storage_quota_bytes=settings.max_storage_bytes,
            storage_used_bytes=used,
            storage_available_bytes=max(settings.max_storage_bytes - used, 0),
        )

    def list_files(self, user_id: str) -> ArtifactListResponse:
        user_root = Path(settings.media_root) / user_id
        items: list[Artifact] = []
        if user_root.exists():
            for file_path in user_root.rglob("*"):
                if file_path.is_file():
                    items.append(
                        Artifact(
                            id=file_path.stem,
                            media_type=file_path.suffix.lstrip("."),
                            file_path=str(file_path),
                            size_bytes=file_path.stat().st_size,
                        )
                    )
        return ArtifactListResponse(items=items)

    def delete_file(self, user_id: str, artifact_id: str) -> bool:
        user_root = Path(settings.media_root) / user_id
        if not user_root.exists():
            return False
        candidates = list(user_root.rglob(f"{artifact_id}.*"))
        if not candidates:
            return False
        candidates[0].unlink(missing_ok=True)
        return True
