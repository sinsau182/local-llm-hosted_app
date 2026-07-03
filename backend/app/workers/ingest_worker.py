"""Background worker: sync ComfyUI outputs into the bucket + Postgres.

Runs as its own container. Ensures the bucket exists, then polls the ComfyUI
output dir on an interval, importing any new per-user generations. Kept separate
from the media queue worker so ingestion never blocks generation.
"""

import logging
import time

from botocore.exceptions import BotoCoreError, ClientError

from app.core.config import settings
from app.services.media_bucket import bucket
from app.services.media_ingest_service import MediaIngestService

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ingest_worker")


def run() -> None:
    service = MediaIngestService()
    interval = settings.ingest_poll_seconds
    logger.info("ingest worker started (dir=%s, interval=%ss)", settings.comfyui_output_dir, interval)

    # Make sure the bucket exists before the first scan (retry until MinIO is up).
    while True:
        try:
            bucket.ensure_bucket()
            break
        except (BotoCoreError, ClientError) as exc:
            logger.warning("waiting for object storage: %s", exc)
            time.sleep(interval)

    while True:
        try:
            n = service.scan_once()
            if n:
                logger.info("imported %d new artifact(s)", n)
        except Exception:  # noqa: BLE001 — never let the loop die
            logger.exception("ingest scan failed")
        time.sleep(interval)


if __name__ == "__main__":
    run()
