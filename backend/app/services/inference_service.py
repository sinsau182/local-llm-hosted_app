from __future__ import annotations

import base64
import json
import logging
import random
import re
import time
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from urllib import error, parse, request
from uuid import uuid4

import redis

from app.core.config import settings
from app.services.media_queue import MediaQueue
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

logger = logging.getLogger("inference_service")

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
        self.queue = MediaQueue()

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

    # ─── ComfyUI integration ────────────────────────────────────────────────
    def _comfy_post(self, path: str, payload: dict[str, Any]) -> dict[str, Any]:
        req = request.Request(
            f"{settings.comfyui_url.rstrip('/')}{path}",
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with request.urlopen(req, timeout=settings.comfyui_timeout_seconds) as response:
            return json.loads(response.read().decode("utf-8"))

    def _comfy_get(self, path: str) -> dict[str, Any]:
        req = request.Request(f"{settings.comfyui_url.rstrip('/')}{path}", method="GET")
        with request.urlopen(req, timeout=settings.comfyui_timeout_seconds) as response:
            return json.loads(response.read().decode("utf-8"))

    def _comfy_get_bytes(self, path: str) -> bytes:
        req = request.Request(f"{settings.comfyui_url.rstrip('/')}{path}", method="GET")
        with request.urlopen(req, timeout=settings.comfyui_timeout_seconds) as response:
            return response.read()

    def _flux_workflow(self, prompt: str, width: int, height: int, steps: int, seed: int) -> dict[str, Any]:
        """Flux.1-schnell text-to-image graph in ComfyUI API format."""
        return {
            "4": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": settings.comfyui_checkpoint}},
            "5": {"class_type": "EmptySD3LatentImage", "inputs": {"width": width, "height": height, "batch_size": 1}},
            "6": {"class_type": "CLIPTextEncode", "inputs": {"text": prompt, "clip": ["4", 1]}},
            "7": {"class_type": "CLIPTextEncode", "inputs": {"text": "", "clip": ["4", 1]}},
            "3": {"class_type": "KSampler", "inputs": {
                "seed": seed, "steps": steps, "cfg": 1.0, "sampler_name": "euler",
                "scheduler": "simple", "denoise": 1.0,
                "model": ["4", 0], "positive": ["6", 0], "negative": ["7", 0], "latent_image": ["5", 0],
            }},
            "8": {"class_type": "VAEDecode", "inputs": {"samples": ["3", 0], "vae": ["4", 2]}},
            "9": {"class_type": "SaveImage", "inputs": {"filename_prefix": "flux_gen", "images": ["8", 0]}},
        }

    def _ltx_video_workflow(
        self, prompt: str, width: int, height: int, num_frames: int, steps: int, seed: int, fps: float,
    ) -> dict[str, Any]:
        """LTX-Video 2B distilled text-to-video graph in ComfyUI API format.

        Classic LTXV pipeline: checkpoint bundles the VAE; the T5 text encoder is
        loaded separately. The distilled model runs at cfg 1.0 with few steps.
        SaveVideo writes an .mp4 and reports it under the node's ``images`` output.
        """
        negative = "worst quality, inconsistent motion, blurry, jittery, distorted, watermark"
        return {
            "40": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": settings.ltx_checkpoint}},
            "41": {"class_type": "CLIPLoader", "inputs": {"clip_name": settings.ltx_t5_encoder, "type": "ltxv"}},
            "6": {"class_type": "CLIPTextEncode", "inputs": {"text": prompt, "clip": ["41", 0]}},
            "7": {"class_type": "CLIPTextEncode", "inputs": {"text": negative, "clip": ["41", 0]}},
            "8": {"class_type": "EmptyLTXVLatentVideo", "inputs": {
                "width": width, "height": height, "length": num_frames, "batch_size": 1}},
            "9": {"class_type": "LTXVConditioning", "inputs": {
                "positive": ["6", 0], "negative": ["7", 0], "frame_rate": fps}},
            "10": {"class_type": "CFGGuider", "inputs": {
                "model": ["40", 0], "positive": ["9", 0], "negative": ["9", 1], "cfg": 1.0}},
            "11": {"class_type": "LTXVScheduler", "inputs": {
                "steps": steps, "max_shift": 2.05, "base_shift": 0.95, "stretch": True,
                "terminal": 0.1, "latent": ["8", 0]}},
            "12": {"class_type": "KSamplerSelect", "inputs": {"sampler_name": "euler"}},
            "13": {"class_type": "RandomNoise", "inputs": {"noise_seed": seed}},
            "14": {"class_type": "SamplerCustomAdvanced", "inputs": {
                "noise": ["13", 0], "guider": ["10", 0], "sampler": ["12", 0],
                "sigmas": ["11", 0], "latent_image": ["8", 0]}},
            "15": {"class_type": "VAEDecode", "inputs": {"samples": ["14", 0], "vae": ["40", 2]}},
            "16": {"class_type": "CreateVideo", "inputs": {"images": ["15", 0], "fps": fps}},
            "17": {"class_type": "SaveVideo", "inputs": {
                "video": ["16", 0], "filename_prefix": "ltx_gen", "format": "auto", "codec": "auto"}},
        }

    def _wan22_video_workflow(
        self, prompt: str, width: int, height: int, num_frames: int, steps: int, seed: int, fps: float,
    ) -> dict[str, Any]:
        """Wan 2.2 T2V-A14B text-to-video graph in ComfyUI API format.

        Two-expert MoE: the high-noise expert denoises steps [0, switch) and hands
        the leftover-noise latent to the low-noise expert for [switch, steps). Both
        experts are GGUF Q4 (UnetLoaderGGUF); the umt5 text encoder is GGUF
        (CLIPLoaderGGUF, type "wan") and the VAE is the Wan2.1 safetensors. Mirrors
        the LTXV path's CreateVideo->SaveVideo so the artifact lands as an .mp4.
        """
        switch = max(1, min(settings.wan_switch_step, steps - 1))
        return {
            "37": {"class_type": "UnetLoaderGGUF", "inputs": {"unet_name": settings.wan_high_noise_gguf}},
            "38": {"class_type": "UnetLoaderGGUF", "inputs": {"unet_name": settings.wan_low_noise_gguf}},
            "54": {"class_type": "ModelSamplingSD3", "inputs": {"model": ["37", 0], "shift": settings.wan_shift}},
            "55": {"class_type": "ModelSamplingSD3", "inputs": {"model": ["38", 0], "shift": settings.wan_shift}},
            "39": {"class_type": "CLIPLoaderGGUF", "inputs": {"clip_name": settings.wan_umt5_gguf, "type": "wan"}},
            "6": {"class_type": "CLIPTextEncode", "inputs": {"text": prompt, "clip": ["39", 0]}},
            "7": {"class_type": "CLIPTextEncode", "inputs": {"text": settings.wan_negative, "clip": ["39", 0]}},
            "40": {"class_type": "VAELoader", "inputs": {"vae_name": settings.wan_vae}},
            "5": {"class_type": "EmptyHunyuanLatentVideo", "inputs": {
                "width": width, "height": height, "length": num_frames, "batch_size": 1}},
            "57": {"class_type": "KSamplerAdvanced", "inputs": {
                "add_noise": "enable", "noise_seed": seed, "steps": steps, "cfg": settings.wan_cfg,
                "sampler_name": settings.wan_sampler, "scheduler": settings.wan_scheduler,
                "start_at_step": 0, "end_at_step": switch, "return_with_leftover_noise": "enable",
                "model": ["54", 0], "positive": ["6", 0], "negative": ["7", 0], "latent_image": ["5", 0]}},
            "58": {"class_type": "KSamplerAdvanced", "inputs": {
                "add_noise": "disable", "noise_seed": seed, "steps": steps, "cfg": settings.wan_cfg,
                "sampler_name": settings.wan_sampler, "scheduler": settings.wan_scheduler,
                "start_at_step": switch, "end_at_step": 10000, "return_with_leftover_noise": "disable",
                "model": ["55", 0], "positive": ["6", 0], "negative": ["7", 0], "latent_image": ["57", 0]}},
            "8": {"class_type": "VAEDecode", "inputs": {"samples": ["58", 0], "vae": ["40", 0]}},
            "16": {"class_type": "CreateVideo", "inputs": {"images": ["8", 0], "fps": fps}},
            "17": {"class_type": "SaveVideo", "inputs": {
                "video": ["16", 0], "filename_prefix": "wan22_gen", "format": "auto", "codec": "auto"}},
        }

    def _http_error_detail(self, exc: error.HTTPError) -> str:
        try:
            return exc.read().decode("utf-8")[:400]
        except Exception:  # noqa: BLE001
            return str(exc)

    def _completed_response(self, job: dict[str, Any]) -> JobStatusResponse:
        image = None
        video = None
        artifact_path = job.get("artifact_path")
        if artifact_path and Path(artifact_path).exists():
            encoded = base64.b64encode(Path(artifact_path).read_bytes()).decode("ascii")
            if job.get("media_type") == "video":
                video = f"data:video/mp4;base64,{encoded}"
            else:
                image = f"data:image/png;base64,{encoded}"
        return JobStatusResponse(
            job_id=str(job["job_id"]), status="COMPLETED",
            media_type=str(job.get("media_type", "")), prompt=str(job.get("prompt", "")),
            image=image, video=video,
        )

    def _fail_job(self, job: dict[str, Any], message: str) -> JobStatusResponse:
        job["status"] = "FAILED"
        job["error"] = message
        job["updated_at"] = self._timestamp()
        self._save_job(job)
        return JobStatusResponse(
            job_id=str(job["job_id"]), status="FAILED",
            media_type=str(job.get("media_type", "")), prompt=str(job.get("prompt", "")), error=message,
        )

    def submit_media(self, payload: MediaRequest) -> MediaSubmitResponse:
        """Enqueue a media job (§9). Never calls ComfyUI directly — a single worker
        drains the Redis FIFO so image/video/coder spikes can't collide."""
        job_id = str(uuid4())
        seed = payload.seed if payload.seed is not None else random.randint(0, 2**31 - 1)
        job = {
            "job_id": job_id,
            "status": "QUEUED",
            "prompt": payload.prompt,
            "media_type": payload.media_type,
            "model": payload.model,
            "width": payload.width,
            "height": payload.height,
            "steps": payload.steps,
            "seed": seed,
            "created_at": self._timestamp(),
            "updated_at": self._timestamp(),
        }

        if payload.media_type == "video" and settings.video_model == "wan22":
            # Wan 2.2 constraints: width/height multiple of 16, frames = (4n + 1).
            # Dimensions are capped at the configured 480p default to keep the
            # two-expert peak within the APU's shared-memory budget.
            width = min(settings.wan_video_width, max(256, (payload.width // 16) * 16))
            height = min(settings.wan_video_height, max(256, (payload.height // 16) * 16))
            frames = payload.num_frames if payload.num_frames is not None else settings.wan_video_frames
            frames = max(5, ((frames - 1) // 4) * 4 + 1)
            fps = payload.fps if payload.fps is not None else settings.wan_video_fps
            steps = payload.steps if payload.steps >= 10 else settings.wan_video_steps
            job.update({"width": width, "height": height, "num_frames": frames, "fps": fps, "steps": steps})
        elif payload.media_type == "video":
            # LTXV constraints: width/height multiple of 32, frames = (n*8 + 1).
            width = max(256, (payload.width // 32) * 32)
            height = max(256, (payload.height // 32) * 32)
            frames = payload.num_frames if payload.num_frames is not None else settings.ltx_video_frames
            frames = max(9, ((frames - 1) // 8) * 8 + 1)
            fps = payload.fps if payload.fps is not None else settings.ltx_video_fps
            steps = payload.steps if payload.steps >= 6 else settings.ltx_video_steps
            job.update({"width": width, "height": height, "num_frames": frames, "fps": fps, "steps": steps})

        self._save_job(job)
        try:
            position, eta = self.queue.enqueue(job_id, payload.media_type)
        except redis.RedisError as exc:
            self._fail_job(job, f"Could not queue the job: {exc}")
            return MediaSubmitResponse(job_id=job_id, status="FAILED")
        return MediaSubmitResponse(
            job_id=job_id, status="QUEUED", position=position, eta_seconds=eta,
        )

    def execute_job(self, job_id: str) -> bool:
        """Run one queued job to completion: build the graph, submit to ComfyUI,
        poll until it finishes, download the artifact. Called only by the worker,
        one job at a time — this serialization is the §5/§9 memory safety net.
        Returns True once the job reached a terminal state (COMPLETED/FAILED)."""
        job = self._load_job(job_id)
        if job is None:
            return False

        media_type = job.get("media_type")
        if media_type == "video" and settings.video_model == "wan22":
            workflow = self._wan22_video_workflow(
                job["prompt"], job["width"], job["height"],
                job["num_frames"], job["steps"], job["seed"], job["fps"],
            )
        elif media_type == "video":
            workflow = self._ltx_video_workflow(
                job["prompt"], job["width"], job["height"],
                job["num_frames"], job["steps"], job["seed"], job["fps"],
            )
        else:
            workflow = self._flux_workflow(
                job["prompt"], job["width"], job["height"], job["steps"], job["seed"],
            )

        try:
            response = self._comfy_post("/prompt", {"prompt": workflow, "client_id": job_id})
            prompt_id = response.get("prompt_id")
            if not prompt_id:
                raise ValueError(json.dumps(response)[:400])
        except error.HTTPError as exc:
            self._fail_job(job, f"ComfyUI rejected the job: {self._http_error_detail(exc)}")
            return True
        except (error.URLError, TimeoutError, ValueError, json.JSONDecodeError) as exc:
            self._fail_job(job, f"Could not reach ComfyUI: {exc}")
            return True

        job["status"] = "PROCESSING"
        job["comfy_prompt_id"] = prompt_id
        job["updated_at"] = self._timestamp()
        self._save_job(job)
        return self._await_comfy_result(job, prompt_id)

    def _await_comfy_result(self, job: dict[str, Any], prompt_id: str) -> bool:
        """Block until ComfyUI reports the prompt in /history, then save the output."""
        job_id = str(job["job_id"])
        deadline = time.monotonic() + settings.media_job_timeout_seconds
        poll = settings.media_poll_seconds
        while time.monotonic() < deadline:
            try:
                history = self._comfy_get(f"/history/{prompt_id}")
            except (error.URLError, error.HTTPError, TimeoutError, json.JSONDecodeError, ValueError):
                time.sleep(poll)
                continue
            entry = history.get(prompt_id)
            if not entry:  # still queued/running inside ComfyUI
                time.sleep(poll)
                continue

            info = self._find_output(entry)
            if not info:
                comfy_status = entry.get("status") or {}
                messages = comfy_status.get("messages") or []
                self._fail_job(job, f"ComfyUI finished without an artifact. {messages}"[:400])
                return True

            try:
                query = parse.urlencode({
                    "filename": info.get("filename", ""),
                    "subfolder": info.get("subfolder", ""),
                    "type": info.get("type", "output"),
                })
                data = self._comfy_get_bytes(f"/view?{query}")
            except (error.URLError, error.HTTPError, TimeoutError) as exc:
                self._fail_job(job, f"Could not fetch the generated artifact: {exc}")
                return True

            suffix = Path(str(info.get("filename", ""))).suffix or (
                ".mp4" if job.get("media_type") == "video" else ".png"
            )
            artifact = self._artifact_root / f"{job_id}{suffix}"
            artifact.parent.mkdir(parents=True, exist_ok=True)
            artifact.write_bytes(data)
            job["status"] = "COMPLETED"
            job["artifact_path"] = str(artifact)
            job["updated_at"] = self._timestamp()
            self._save_job(job)
            return True

        self._fail_job(job, "Generation timed out.")
        return True

    @staticmethod
    def _find_output(entry: dict[str, Any]) -> dict[str, Any] | None:
        """Locate the saved file among ComfyUI node outputs (image or video)."""
        for node_output in (entry.get("outputs") or {}).values():
            for key in ("images", "gifs", "videos"):
                items = node_output.get(key)
                if items:
                    return items[0]
        return None

    def get_job(self, job_id: str) -> JobStatusResponse:
        """Read-only status. The worker owns execution, so this just reflects the
        stored job document, adding live queue position/ETA while QUEUED."""
        job = self._load_job(job_id)
        if job is None:
            return JobStatusResponse(job_id=job_id, status="NOT_FOUND")

        status = str(job.get("status", "UNKNOWN"))
        if status == "COMPLETED":
            return self._completed_response(job)
        if status == "FAILED":
            return JobStatusResponse(
                job_id=job_id, status="FAILED",
                media_type=str(job.get("media_type", "")), prompt=str(job.get("prompt", "")),
                error=job.get("error"),
            )

        response = JobStatusResponse(
            job_id=job_id, status=status,
            media_type=str(job.get("media_type", "")), prompt=str(job.get("prompt", "")),
        )
        if status == "QUEUED":
            try:
                response.position, response.eta_seconds = self.queue.stats(
                    job_id, str(job.get("media_type", "image")),
                )
            except redis.RedisError:
                pass
        return response

    def cancel_job(self, job_id: str) -> JobStatusResponse:
        """Cancel a job a client abandoned (e.g. the page reloaded while
        generating). If it is still QUEUED it is pulled from the FIFO; if it is the
        one currently executing, ComfyUI is interrupted so the serial worker frees
        the slot. Idempotent — a job already in a terminal state is returned as-is."""
        job = self._load_job(job_id)
        if job is None:
            return JobStatusResponse(job_id=job_id, status="NOT_FOUND")
        if str(job.get("status")) in ("COMPLETED", "FAILED", "CANCELLED"):
            return self.get_job(job_id)

        was_active = False
        try:
            was_active = self.queue.active() == job_id
            self.queue.remove(job_id)
        except redis.RedisError:
            pass
        if was_active:
            # Stop the in-flight run; the worker then records a terminal state and
            # moves on. (It may finalize as FAILED rather than CANCELLED — harmless,
            # the abandoned client never sees it; the point is to free the worker.)
            try:
                self._comfy_post("/interrupt", {})
            except (error.URLError, error.HTTPError, TimeoutError, ValueError):
                pass

        job["status"] = "CANCELLED"
        job["error"] = "Cancelled by client"
        job["updated_at"] = self._timestamp()
        self._save_job(job)
        return JobStatusResponse(
            job_id=job_id, status="CANCELLED",
            media_type=str(job.get("media_type", "")), prompt=str(job.get("prompt", "")),
            error=job.get("error"),
        )

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
