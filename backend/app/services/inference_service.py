from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from urllib import error, request
from uuid import uuid4

from app.core.config import settings
from app.schemas.inference import (
    ChatRequest,
    ChatResponse,
    JobStatusResponse,
    MediaRequest,
    MediaSubmitResponse,
    ModelInfo,
    ModelsResponse,
)


class InferenceService:
    def __init__(self) -> None:
        self._job_root = Path(settings.media_root) / "_jobs"
        self._artifact_root = Path(settings.media_root) / "generated"

    def _request_json(self, path: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
        body = None if payload is None else json.dumps(payload).encode("utf-8")
        req = request.Request(
            f"{settings.ollama_url.rstrip('/')}{path}",
            data=body,
            headers={"Content-Type": "application/json"},
            method="POST" if payload is not None else "GET",
        )

        with request.urlopen(req, timeout=settings.ollama_timeout_seconds) as response:
            return json.loads(response.read().decode("utf-8"))

    def _timestamp(self) -> str:
        return datetime.now(UTC).isoformat()

    def _ensure_job_root(self) -> None:
        self._job_root.mkdir(parents=True, exist_ok=True)

    def _job_path(self, job_id: str) -> Path:
        self._ensure_job_root()
        return self._job_root / f"{job_id}.json"

    def _load_job(self, job_id: str) -> dict[str, Any] | None:
        job_path = self._job_path(job_id)
        if not job_path.exists():
            return None
        return json.loads(job_path.read_text(encoding="utf-8"))

    def _save_job(self, job: dict[str, Any]) -> None:
        job_path = self._job_path(str(job["job_id"]))
        job_path.write_text(json.dumps(job, indent=2, sort_keys=True), encoding="utf-8")

    def _artifact_path(self, job_id: str, media_type: str) -> Path:
        self._artifact_root.mkdir(parents=True, exist_ok=True)
        return self._artifact_root / f"{job_id}.{media_type}.txt"

    def _ollama_chat(self, payload: ChatRequest) -> str:
        response = self._request_json(
            "/api/chat",
            {
                "model": payload.model,
                "messages": [{"role": "user", "content": payload.prompt}],
                "stream": False,
                "options": {"num_predict": payload.max_tokens},
            },
        )
        message = response.get("message") or {}
        content = message.get("content") or response.get("response") or ""
        return str(content)

    def chat(self, payload: ChatRequest) -> ChatResponse:
        try:
            output = self._ollama_chat(payload)
        except (error.URLError, error.HTTPError, TimeoutError, json.JSONDecodeError, ValueError):
            output = f"[stub:{payload.model}] {payload.prompt[:200]}"

        return ChatResponse(
            request_id=str(uuid4()),
            output=output,
        )

    def submit_media(self, payload: MediaRequest) -> MediaSubmitResponse:
        job_id = str(uuid4())
        job = {
            "job_id": job_id,
            "status": "QUEUED",
            "prompt": payload.prompt,
            "media_type": payload.media_type,
            "model": payload.model,
            "created_at": self._timestamp(),
            "updated_at": self._timestamp(),
        }
        self._save_job(job)
        return MediaSubmitResponse(job_id=job_id, status="QUEUED")

    def get_job(self, job_id: str) -> JobStatusResponse:
        job = self._load_job(job_id)
        if job is None:
            return JobStatusResponse(job_id=job_id, status="NOT_FOUND")
        return JobStatusResponse(job_id=job_id, status=str(job.get("status", "UNKNOWN")))

    def list_pending_media_jobs(self) -> list[dict[str, Any]]:
        self._ensure_job_root()
        pending_jobs: list[dict[str, Any]] = []
        for job_path in self._job_root.glob("*.json"):
            try:
                job = json.loads(job_path.read_text(encoding="utf-8"))
            except json.JSONDecodeError:
                continue
            if job.get("status") == "QUEUED":
                pending_jobs.append(job)
        return pending_jobs

    def complete_media_job(self, job_id: str) -> bool:
        job = self._load_job(job_id)
        if job is None:
            return False

        artifact_path = self._artifact_path(job_id, str(job.get("media_type", "media")))
        artifact_path.write_text(
            "\n".join(
                [
                    f"job_id={job_id}",
                    f"model={job.get('model', 'unknown')}",
                    f"media_type={job.get('media_type', 'unknown')}",
                    f"prompt={job.get('prompt', '')}",
                ]
            ),
            encoding="utf-8",
        )

        job["status"] = "COMPLETED"
        job["artifact_path"] = str(artifact_path)
        job["updated_at"] = self._timestamp()
        self._save_job(job)
        return True

    def process_pending_media_jobs(self) -> int:
        processed = 0
        for job in self.list_pending_media_jobs():
            if self.complete_media_job(str(job["job_id"])):
                processed += 1
        return processed

    def list_models(self) -> ModelsResponse:
        try:
            response = self._request_json("/api/tags")
            models: list[ModelInfo] = []

            for model in response.get("models", []):
                details = model.get("details") or {}
                quantization = details.get("quantization_level") or details.get("quantization") or "unknown"
                parameter_size = details.get("parameter_size") or details.get("size") or "unknown"
                models.append(
                    ModelInfo(
                        name=str(model.get("name", "unknown")),
                        precision=str(quantization),
                        vram_gb=self._estimate_vram_gb(parameter_size),
                    )
                )

            if models:
                return ModelsResponse(models=models)
        except (error.URLError, error.HTTPError, TimeoutError, json.JSONDecodeError, ValueError):
            pass

        return ModelsResponse(
            models=[
                ModelInfo(name="qwen2.5-coder:14b", precision="Q4_K_M", vram_gb=12.5),
                ModelInfo(name="flux.1-dev", precision="FP16", vram_gb=24.0),
                ModelInfo(name="wan-2.2", precision="Q8_0", vram_gb=38.0),
            ]
        )

    @staticmethod
    def _estimate_vram_gb(parameter_size: str) -> float:
        text = str(parameter_size).strip().lower()

        try:
            if text.endswith("b"):
                return float(text[:-1]) * 2.0
            if text.endswith("m"):
                return round(float(text[:-1]) / 1000.0 * 2.0, 1)
            return float(text)
        except ValueError:
            return 0.0
