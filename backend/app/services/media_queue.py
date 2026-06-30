"""Redis-backed media job queue (Orchestration design §9).

Every image/video request is enqueued here — there are *no* direct ComfyUI calls
from the request path. A single worker (``app.workers.media_worker``) drains the
queue one job at a time, which is what gives us the serial lock that prevents a
FLUX/LTXV memory spike from colliding with the always-on coders.

This module also defines the **shared contract** between this app and the host
orchestrator (``ai-server/model_loader.py``). Both connect to the same Redis and
communicate only through these keys:

    mediaq:image          LIST    queued image job_ids   (LPUSH head / RPOP tail = FIFO)
    mediaq:video          LIST    queued video job_ids
    mediaq:active         STRING  job_id currently executing (or absent)
    mediaq:video_pending  STRING  count of queued videos — the worker's signal to
                                  the orchestrator that it should switch to VIDEO mode

    orch:mode             STRING  "normal" | "video"            (set by orchestrator)
    orch:coder_state      STRING  idle|loading|running|draining (set by orchestrator)

When the orchestrator is not deployed (``settings.media_orchestrator_enabled`` is
False) the worker ignores ``orch:*`` and just serves FIFO with video priority.
"""

from __future__ import annotations

import redis

from app.core.config import settings

Q_IMAGE = "mediaq:image"
Q_VIDEO = "mediaq:video"
K_ACTIVE = "mediaq:active"
K_VIDEO_PENDING = "mediaq:video_pending"

K_MODE = "orch:mode"
K_CODER = "orch:coder_state"
K_CODER_BUSY = "orch:coder_busy"


class MediaQueue:
    """Thin wrapper over Redis lists implementing the §9 FIFO with positions."""

    def __init__(self, client: redis.Redis | None = None) -> None:
        self._r = client or redis.Redis.from_url(settings.redis_url, decode_responses=True)

    def _key(self, media_type: str) -> str:
        return Q_VIDEO if media_type == "video" else Q_IMAGE

    # ── producer side (API process) ──────────────────────────────────────────
    def enqueue(self, job_id: str, media_type: str) -> tuple[int, int]:
        """Push a job onto its FIFO. Returns (position, eta_seconds)."""
        self._r.lpush(self._key(media_type), job_id)
        return self.stats(job_id, media_type)

    def stats(self, job_id: str, media_type: str) -> tuple[int, int]:
        """1-based queue position and a rough ETA in seconds.

        Processing order is video-first then image (video is exclusive), so an
        image waits behind every queued video plus the images ahead of it.
        Returns (0, 0) once the job has left the queue (active or finished).
        """
        videos = list(reversed(self._r.lrange(Q_VIDEO, 0, -1)))  # FIFO order
        images = list(reversed(self._r.lrange(Q_IMAGE, 0, -1)))
        img_eta = settings.media_eta_image_seconds
        vid_eta = settings.media_eta_video_seconds

        if media_type == "video":
            if job_id not in videos:
                return 0, 0
            videos_ahead, images_ahead = videos.index(job_id), 0
            own_eta = vid_eta
        else:
            if job_id not in images:
                return 0, 0
            videos_ahead, images_ahead = len(videos), images.index(job_id)
            own_eta = img_eta

        active = self._r.get(K_ACTIVE)
        active_ahead = 1 if active and active != job_id else 0

        position = videos_ahead + images_ahead + active_ahead + 1
        eta = (videos_ahead * vid_eta) + (images_ahead * img_eta) + (active_ahead * img_eta) + own_eta
        return position, int(eta)

    # ── consumer side (worker process) ───────────────────────────────────────
    def has_video(self) -> bool:
        return self._r.llen(Q_VIDEO) > 0

    def has_image(self) -> bool:
        return self._r.llen(Q_IMAGE) > 0

    def publish_video_pending(self) -> int:
        """Tell the orchestrator how many videos are waiting; returns the count."""
        count = self._r.llen(Q_VIDEO)
        self._r.set(K_VIDEO_PENDING, count)
        return count

    def claim_video(self) -> str | None:
        return self._r.rpop(Q_VIDEO)

    def claim_image(self) -> str | None:
        return self._r.rpop(Q_IMAGE)

    def set_active(self, job_id: str) -> None:
        self._r.set(K_ACTIVE, job_id)

    def clear_active(self) -> None:
        self._r.delete(K_ACTIVE)

    # ── orchestration state (read-only here; written by model_loader.py) ──────
    def mode(self) -> str:
        return self._r.get(K_MODE) or "normal"

    def coder_state(self) -> str:
        return self._r.get(K_CODER) or "idle"

    def coder_busy(self) -> bool:
        """True only while the Coder is actively serving a request (§5 serial
        lock) — not merely loaded, so images aren't starved the whole time."""
        return self._r.get(K_CODER_BUSY) == "1"
