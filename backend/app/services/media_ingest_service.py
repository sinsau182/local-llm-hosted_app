"""Ingest ComfyUI outputs into the media bucket + Postgres.

The Create panel (ComfyUI extension) tags every generation's filename_prefix as
``user/<uid>/…``, so ComfyUI writes files under
``<comfyui_output_dir>/user/<uid>/``. This service walks that tree, uploads any
file it has not seen before to the bucket, and records an ``artifacts`` row —
giving each user a browsable history of what they created in ComfyUI.

Dedupe is by object key (== path relative to the output dir), so re-scanning is
cheap and safe; ComfyUI keeps owning the files on disk.
"""

from __future__ import annotations

import logging
import mimetypes
from pathlib import Path
from uuid import UUID

from app.core.config import settings
from app.db.session import SessionLocal
from app.repositories.artifact_repository import ArtifactRepository
from app.services.media_bucket import bucket

logger = logging.getLogger("media_ingest")

_IMAGE_EXT = {".png", ".jpg", ".jpeg", ".webp"}
_VIDEO_EXT = {".mp4", ".webm", ".gif"}


def _media_type(suffix: str) -> str | None:
    s = suffix.lower()
    if s in _IMAGE_EXT:
        return "image"
    if s in _VIDEO_EXT:
        return "video"
    return None


def _is_uuid(value: str) -> bool:
    try:
        UUID(value)
        return True
    except (ValueError, AttributeError):
        return False


class MediaIngestService:
    def __init__(self) -> None:
        self._root = Path(settings.comfyui_output_dir)
        self._user_root = self._root / "user"

    def _resolve_user(self, repo: ArtifactRepository, uid_segment: str) -> str:
        """Map a path segment to a real user_id. Valid UUIDs are used as-is
        (creating a placeholder row if needed); anything else (e.g. 'anonymous')
        is attributed to the configured default user."""
        if _is_uuid(uid_segment):
            repo.ensure_user(uid_segment)
            return uid_segment
        repo.ensure_user(settings.ingest_default_user_id)
        return settings.ingest_default_user_id

    def scan_once(self) -> int:
        """Ingest any new outputs. Returns the number of newly imported files."""
        if not self._user_root.exists():
            return 0

        imported = 0
        db = SessionLocal()
        try:
            repo = ArtifactRepository(db)
            for path in sorted(self._user_root.rglob("*")):
                if not path.is_file():
                    continue
                media_type = _media_type(path.suffix)
                if media_type is None:
                    continue

                key = str(path.relative_to(self._root))  # e.g. user/<uid>/flux_gen_00001_.png
                if repo.by_key(key) is not None:
                    continue  # already ingested

                try:
                    uid_segment = path.relative_to(self._user_root).parts[0]
                except (ValueError, IndexError):
                    continue
                user_id = self._resolve_user(repo, uid_segment)

                try:
                    content_type = mimetypes.guess_type(path.name)[0]
                    bucket.upload_file(key, str(path), content_type)
                    repo.create(user_id, media_type, key, path.stat().st_size)
                    imported += 1
                    logger.info("ingested %s -> %s (user %s)", key, media_type, user_id)
                except Exception:  # noqa: BLE001 — one bad file must not stop the scan
                    logger.exception("failed to ingest %s", key)
                    db.rollback()
        finally:
            db.close()
        return imported
