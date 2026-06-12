from __future__ import annotations

import json
import re
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from urllib import error, request
from uuid import uuid4

from app.core.config import settings
from app.schemas.inference import (
    ChatRequest,
    ChatResponse,
    EmbedRequest,
    EmbedResponse,
    JobStatusResponse,
    MediaRequest,
    MediaSubmitResponse,
    ModelInfo,
    ModelsResponse,
)

_CHAT_MODELS = ["qwen3-coder-next", "qwen3.6-27b", "qwen3.5-9b"]

_MODEL_ROUTING: list[tuple[list[str], str]] = [
    # Reasoning / analysis checked FIRST — qwen3.6-27b
    # Uses multi-word phrases to avoid false matches on generic single words
    (
        [
            "difference between", "pros and cons", "trade-off", "what is better",
            "analyze", "compare", "contrast", "evaluate", "critique", "assess",
            "philosophy", "deep dive", "explain why", "reason why",
            "cause and effect", "impact of", "relationship between",
            "recommend", "which is best", "should i choose",
        ],
        "qwen3.6-27b",
    ),
    # Code / engineering — qwen3-coder-next
    # Single words are safe here since they're unambiguously technical
    (
        [
            "code", "function", "debug", "script", "class", "implement", "refactor", "syntax",
            "bug", "error", "exception", "fix this",
            "api endpoint", "algorithm", "compile", "git ", "dockerfile",
            "regex", "json", "array", "loop", "variable", "import", "library", "package",
        ],
        "qwen3-coder-next",
    ),
]

def _pick_model(prompt: str) -> str:
    lower = prompt.lower()
    for keywords, model in _MODEL_ROUTING:
        if any(k in lower for k in keywords):
            return model
    return "qwen3.5-9b"


def _chat_messages(payload: ChatRequest) -> list[dict[str, str]]:
    history = [
        {"role": message.role, "content": message.content}
        for message in payload.messages[-20:]
        if message.content.strip()
    ]
    history.append({"role": "user", "content": payload.prompt})
    return history


_QUANT_BITS: dict[str, float] = {
    "Q2_K": 2.6,
    "Q3_K_S": 3.0, "Q3_K_M": 3.3, "Q3_K_L": 3.6,
    "Q4_0": 4.0, "Q4_1": 4.5,
    "Q4_K_S": 4.4, "Q4_K_M": 4.5,
    "Q5_0": 5.0, "Q5_1": 5.5,
    "Q5_K_S": 5.5, "Q5_K_M": 5.7,
    "Q6_K": 6.6,
    "Q8_0": 8.0,
    "F16": 16.0, "FP16": 16.0,
    "BF16": 16.0,
    "F32": 32.0,
    "IQ2_XS": 2.3, "IQ3_XS": 3.3, "IQ4_XS": 4.25, "IQ4_NL": 4.5,
}


def _extract_precision(model_id: str) -> str:
    match = re.search(
        r"(IQ[2-6]_[A-Z0-9]+|Q[2-8]_K_[SML]|Q[2-8]_[K01]|BF16|FP16|F16|F32)",
        model_id,
        re.IGNORECASE,
    )
    return match.group(0).upper() if match else "unknown"


def _estimate_vram_gb(model_id: str, precision: str) -> float:
    param_match = re.search(r"(\d+(?:\.\d+)?)\s*[Bb]\b", model_id)
    if not param_match:
        return 0.0
    params_b = float(param_match.group(1))
    bits = _QUANT_BITS.get(precision.upper(), 8.0)
    return round(params_b * bits / 8.0, 1)


class InferenceService:
    def __init__(self) -> None:
        self._job_root = Path(settings.media_root) / "_jobs"
        self._artifact_root = Path(settings.media_root) / "generated"

    def _request_json(self, path: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
        body = None if payload is None else json.dumps(payload).encode("utf-8")
        req = request.Request(
            f"{settings.llama_url.rstrip('/')}{path}",
            data=body,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {settings.litellm_api_key}",
            },
            method="POST" if payload is not None else "GET",
        )
        with request.urlopen(req, timeout=settings.llama_timeout_seconds) as response:
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

    def _llama_chat(self, payload: ChatRequest) -> tuple[str, str]:
        routing_text = "\n".join([message.content for message in payload.messages[-6:]] + [payload.prompt])
        model = _pick_model(routing_text) if payload.model == "auto" else payload.model
        response = self._request_json(
            "/v1/chat/completions",
            {
                "model": model,
                "messages": _chat_messages(payload),
                "max_tokens": payload.max_tokens,
                "stream": False,
            },
        )
        choices = response.get("choices") or []
        content = ""
        if choices:
            message = choices[0].get("message") or {}
            content = str(message.get("content") or "")
        return content, model

    def chat(self, payload: ChatRequest) -> ChatResponse:
        routing_text = "\n".join([message.content for message in payload.messages[-6:]] + [payload.prompt])
        intended_model = _pick_model(routing_text) if payload.model == "auto" else payload.model
        try:
            output, routed_model = self._llama_chat(payload)
        except (error.URLError, error.HTTPError, TimeoutError, json.JSONDecodeError, ValueError):
            output = f"[llama-server unreachable] {payload.prompt[:200]}"
            routed_model = intended_model

        return ChatResponse(
            request_id=str(uuid4()),
            output=output,
            routed_model=routed_model,
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
            "\n".join([
                f"job_id={job_id}",
                f"model={job.get('model', 'unknown')}",
                f"media_type={job.get('media_type', 'unknown')}",
                f"prompt={job.get('prompt', '')}",
            ]),
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

    def embed(self, payload: EmbedRequest) -> EmbedResponse:
        inputs = payload.input if isinstance(payload.input, list) else [payload.input]
        response = self._request_json(
            "/v1/embeddings",
            {"model": "qwen3-embedding-8b", "input": inputs, "encoding_format": "float"},
        )
        vectors = [entry["embedding"] for entry in response.get("data", [])]
        return EmbedResponse(
            embeddings=vectors,
            model="qwen3-embedding-8b",
            dimensions=len(vectors[0]) if vectors else 0,
        )

    def list_models(self) -> ModelsResponse:
        auto_model = ModelInfo(name="auto", precision="router", vram_gb=0.0)
        try:
            response = self._request_json("/v1/models")
            models: list[ModelInfo] = [auto_model]
            for entry in response.get("data", []):
                model_id = str(entry.get("id", "unknown"))
                if model_id not in _CHAT_MODELS:
                    continue
                precision = _extract_precision(model_id)
                models.append(ModelInfo(
                    name=model_id,
                    precision=precision,
                    vram_gb=_estimate_vram_gb(model_id, precision),
                ))
            if len(models) > 1:
                return ModelsResponse(models=models)
        except (error.URLError, error.HTTPError, TimeoutError, json.JSONDecodeError, ValueError):
            pass

        return ModelsResponse(
            models=[
                auto_model,
                ModelInfo(name="qwen3-coder-next", precision="Q4_K_M", vram_gb=4.5),
                ModelInfo(name="qwen3.6-27b", precision="Q8_0", vram_gb=27.0),
                ModelInfo(name="qwen3.5-9b", precision="Q8_0", vram_gb=9.0),
            ]
        )
