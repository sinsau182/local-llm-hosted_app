"""Object storage for generated media (MinIO / S3-compatible).

Thin boto3 wrapper. Objects are uploaded by the ingester and streamed back to
the browser through the API (see ``storage.py``), so MinIO never needs a public
endpoint. Object keys mirror the ComfyUI output layout: ``user/<uid>/<file>``.
"""

from __future__ import annotations

import logging
from collections.abc import Iterator
from functools import cached_property

import boto3
from botocore.client import Config
from botocore.exceptions import ClientError

from app.core.config import settings

logger = logging.getLogger("media_bucket")

_STREAM_CHUNK = 1024 * 256  # 256 KiB


class MediaBucket:
    """Lazily-connected S3 client scoped to the configured bucket."""

    @cached_property
    def _client(self):
        return boto3.client(
            "s3",
            endpoint_url=settings.minio_endpoint,
            aws_access_key_id=settings.minio_access_key,
            aws_secret_access_key=settings.minio_secret_key,
            region_name=settings.minio_region,
            config=Config(signature_version="s3v4"),
        )

    @property
    def bucket(self) -> str:
        return settings.minio_bucket

    def ensure_bucket(self) -> None:
        """Create the bucket if it does not exist. Idempotent + race-safe."""
        try:
            self._client.head_bucket(Bucket=self.bucket)
            return
        except ClientError:
            pass
        try:
            self._client.create_bucket(Bucket=self.bucket)
            logger.info("created bucket %s", self.bucket)
        except ClientError as exc:
            code = exc.response.get("Error", {}).get("Code", "")
            if code not in ("BucketAlreadyOwnedByYou", "BucketAlreadyExists"):
                raise

    def upload_file(self, key: str, path: str, content_type: str | None = None) -> None:
        extra = {"ContentType": content_type} if content_type else {}
        self._client.upload_file(path, self.bucket, key, ExtraArgs=extra)

    def exists(self, key: str) -> bool:
        try:
            self._client.head_object(Bucket=self.bucket, Key=key)
            return True
        except ClientError:
            return False

    def stream(self, key: str) -> tuple[Iterator[bytes], str, int]:
        """Return (chunk iterator, content-type, size) for streaming to a client."""
        obj = self._client.get_object(Bucket=self.bucket, Key=key)
        body = obj["Body"]

        def _iter() -> Iterator[bytes]:
            try:
                while True:
                    chunk = body.read(_STREAM_CHUNK)
                    if not chunk:
                        break
                    yield chunk
            finally:
                body.close()

        return _iter(), obj.get("ContentType", "application/octet-stream"), int(obj.get("ContentLength", 0))

    def delete(self, key: str) -> None:
        try:
            self._client.delete_object(Bucket=self.bucket, Key=key)
        except ClientError as exc:
            logger.warning("failed to delete %s: %s", key, exc)


bucket = MediaBucket()
