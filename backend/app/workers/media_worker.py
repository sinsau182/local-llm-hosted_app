import logging
import os
import time

from app.services.inference_service import InferenceService


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("media_worker")


def run() -> None:
    poll_interval = int(os.getenv("WORKER_POLL_SECONDS", "5"))
    service = InferenceService()
    logger.info("media worker started with poll interval=%ss", poll_interval)
    while True:
        processed = service.process_pending_media_jobs()
        if processed:
            logger.info("processed %s queued media job(s)", processed)
        else:
            logger.debug("polling for media jobs")
        time.sleep(poll_interval)


if __name__ == "__main__":
    run()
