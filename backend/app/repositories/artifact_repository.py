"""Persistence for generated-media artifacts (Postgres).

Backs the storage/history views and the ComfyUI ingester. ``file_path`` stores
the object key in the media bucket (``user/<uid>/<file>``), which is also the
dedupe key so the ingester never imports the same output twice.
"""

from __future__ import annotations

from sqlalchemy import func, insert, select, text
from sqlalchemy.orm import Session

from app.models.artifact import Artifact
from app.models.user import User


class ArtifactRepository:
    def __init__(self, db: Session):
        self.db = db

    # ── User bootstrap ────────────────────────────────────────────────────────
    def ensure_user(self, user_id: str) -> None:
        """Insert a placeholder user row if it is missing (FK safety for
        ingested assets). Idempotent."""
        exists = self.db.scalar(select(User.id).where(User.id == user_id))
        if exists:
            return
        self.db.execute(
            text(
                "INSERT INTO users (id, email, full_name, role) "
                "VALUES (:id, :email, :name, 'user') ON CONFLICT (id) DO NOTHING"
            ),
            {"id": user_id, "email": f"{user_id}@local", "name": "Ingested"},
        )
        self.db.commit()

    def user_exists(self, user_id: str) -> bool:
        return self.db.scalar(select(User.id).where(User.id == user_id)) is not None

    # ── Artifacts ──────────────────────────────────────────────────────────────
    def by_key(self, key: str) -> Artifact | None:
        return self.db.scalar(select(Artifact).where(Artifact.file_path == key))

    def list_for_user(self, user_id: str) -> list[Artifact]:
        return list(
            self.db.scalars(
                select(Artifact)
                .where(Artifact.user_id == user_id)
                .order_by(Artifact.created_at.desc())
            )
        )

    def get(self, artifact_id: str) -> Artifact | None:
        return self.db.get(Artifact, artifact_id)

    def get_owned(self, user_id: str, artifact_id: str) -> Artifact | None:
        return self.db.scalar(
            select(Artifact).where(Artifact.id == artifact_id, Artifact.user_id == user_id)
        )

    def used_bytes(self, user_id: str) -> int:
        return int(
            self.db.scalar(
                select(func.coalesce(func.sum(Artifact.size_bytes), 0)).where(
                    Artifact.user_id == user_id
                )
            )
            or 0
        )

    def quota_bytes(self, user_id: str, default: int) -> int:
        value = self.db.scalar(select(User.storage_quota_bytes).where(User.id == user_id))
        return int(value) if value is not None else default

    def create(self, user_id: str, media_type: str, key: str, size_bytes: int) -> Artifact:
        row = self.db.execute(
            insert(Artifact)
            .values(user_id=user_id, media_type=media_type, file_path=key, size_bytes=size_bytes)
            .returning(Artifact.id)
        ).scalar_one()
        self.db.commit()
        return self.db.get(Artifact, row)

    def delete(self, artifact: Artifact) -> None:
        self.db.delete(artifact)
        self.db.commit()
