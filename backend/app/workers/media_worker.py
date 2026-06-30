"""Single-consumer media worker (Orchestration design §5/§9).

Exactly one of these runs. It drains the Redis FIFO one job at a time — that
serialization is the memory safety net: a FLUX/LTXV spike can never run
concurrently with another generation.

Ordering rules:
  * Video is exclusive and goes first. While any video is queued, images wait.
  * When the orchestrator is enabled it coordinates through ``orch:*`` Redis keys:
      - a video only runs once the orchestrator has switched to VIDEO mode
        (Coder drained + paused, iGPU memory reclaimed);
      - an image waits while the Coder is RUNNING (§5 serial lock).
    With the orchestrator disabled, those gates are skipped and we simply serve
    the FIFO with video priority.
"""

import logging
import time

import redis

from app.core.config import settings
from app.services.inference_service import InferenceService
from app.services.media_queue import MediaQueue

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("media_worker")


def _claim_next(queue: MediaQueue, orchestrated: bool) -> tuple[str, str] | None:
    """Pick the next runnable job, or None if we should wait. Pops it from Redis."""
    pending_videos = queue.publish_video_pending()

    if pending_videos:
        if orchestrated and queue.mode() != "video":
            return None  # wait for the orchestrator to enter VIDEO mode
        job_id = queue.claim_video()
        return (job_id, "video") if job_id else None

    # No videos waiting.
    if orchestrated and queue.mode() == "video":
        return None  # orchestrator still draining back to NORMAL — hold images
    if queue.has_image():
        if orchestrated and queue.coder_busy():
            return None  # §5 serial lock: image waits while the Coder is busy
        job_id = queue.claim_image()
        return (job_id, "image") if job_id else None

    return None


def run() -> None:
    service = InferenceService()
    queue = service.queue
    orchestrated = settings.media_orchestrator_enabled
    idle = settings.media_worker_idle_seconds
    logger.info("media worker started (orchestrated=%s, idle=%ss)", orchestrated, idle)

    while True:
        try:
            claim = _claim_next(queue, orchestrated)
        except redis.RedisError as exc:
            logger.warning("redis unavailable, retrying: %s", exc)
            time.sleep(idle)
            continue

        if claim is None:
            time.sleep(idle)
            continue

        job_id, media_type = claim
        try:
            queue.set_active(job_id)
            logger.info("processing %s job %s", media_type, job_id)
            service.execute_job(job_id)
            logger.info("finished job %s", job_id)
        except Exception:  # noqa: BLE001 — never let one job kill the worker
            logger.exception("job %s crashed", job_id)
        finally:
            try:
                queue.clear_active()
            except redis.RedisError:
                pass


if __name__ == "__main__":
    run()
