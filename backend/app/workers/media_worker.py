import logging
import os
import time


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("media_worker")


def run() -> None:
    poll_interval = int(os.getenv("WORKER_POLL_SECONDS", "5"))
    logger.info("media worker started with poll interval=%ss", poll_interval)
    while True:
        # Placeholder loop for DB-backed SKIP LOCKED job pickup.
        logger.debug("polling for media jobs")
        time.sleep(poll_interval)


if __name__ == "__main__":
    run()
