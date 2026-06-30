from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "ai-inference-platform-api"
    app_env: str = "dev"
    api_prefix: str = "/backend/v1"

    llama_url: str = "http://localhost:4001"
    llama_timeout_seconds: float = 600.0
    litellm_api_key: str = "sk-f4fe27901e83c3ebf669625d9b291d27dc4908b2a671bb91f3bdda42e905d2b3"

    chromadb_host: str = "localhost"
    chromadb_port: int = 8010
    chromadb_path: str = ".chromadb"
    chromadb_collection: str = "documents"

    jwt_private_key: str = "c77c5664716d90f82b5df8c54625e23e7c44cd5d1fe4b367bc07ac9651647dc1"
    jwt_public_key: str = "unused"
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 15
    refresh_token_days: int = 7

    database_url: str = "postgresql+psycopg://platform_user:platform_password@localhost:5432/platform"
    redis_url: str = "redis://localhost:6379/0"

    media_root: str = "/data/media"
    max_storage_bytes: int = 322122547200
    max_request_timeout_seconds: int = 600

    # ComfyUI (image generation)
    comfyui_url: str = "http://localhost:8188"
    comfyui_checkpoint: str = "flux1-schnell-fp8.safetensors"
    comfyui_timeout_seconds: float = 180.0

    # Video generation backend: "wan22" (Wan 2.2 14B MoE, GGUF Q4) or "ltx".
    video_model: str = "wan22"

    # ComfyUI (video generation — LTX-Video 2B distilled, classic LTXV graph)
    ltx_checkpoint: str = "ltx-2.3/ltxv-2b-0.9.8-distilled.safetensors"
    ltx_t5_encoder: str = "t5xxl_fp8_e4m3fn.safetensors"
    ltx_video_steps: int = 8          # distilled model — few steps is enough
    ltx_video_frames: int = 97        # ~4s at 24fps; LTXV requires (n*8 + 1)
    ltx_video_fps: float = 24.0

    # ComfyUI (video generation — Wan 2.2 T2V-A14B, GGUF Q4_K_M, two-expert MoE).
    # High-noise expert denoises the first steps, low-noise expert finishes;
    # native UnetLoaderGGUF + CLIPLoaderGGUF (umt5) + Wan2.1 VAE. Serialized by
    # the media worker so the ~30GB peak never collides with the coder LLMs.
    wan_high_noise_gguf: str = "Wan2.2-T2V-A14B-HighNoise-Q4_K_M.gguf"
    wan_low_noise_gguf: str = "Wan2.2-T2V-A14B-LowNoise-Q4_K_M.gguf"
    wan_umt5_gguf: str = "umt5-xxl-encoder-Q5_K_M.gguf"
    wan_vae: str = "Wan2.1_VAE.safetensors"
    # Defaults are tuned to finish within media_job_timeout_seconds (600s) on the
    # APU: the full 20-step / 49-frame run overran 600s in testing, so steps and
    # frame count are halved. Bump these (and the worker timeout) for more fidelity.
    wan_video_steps: int = 12         # total sampling steps across both experts
    wan_switch_step: int = 6          # high-noise -> low-noise expert handoff
    wan_cfg: float = 3.5
    wan_shift: float = 8.0            # ModelSamplingSD3 shift (Wan 2.2 default)
    wan_sampler: str = "euler"
    wan_scheduler: str = "simple"
    wan_video_width: int = 832        # Wan 480p native; lighter than 720p on APU
    wan_video_height: int = 480
    wan_video_frames: int = 25        # ~1.5s at 16fps; Wan requires (4n + 1)
    wan_video_fps: float = 16.0
    wan_negative: str = (
        "色调艳丽，过曝，静态，细节模糊不清，字幕，风格，作品，画作，画面，静止，"
        "整体发灰，最差质量，低质量，JPEG压缩残留，丑陋的，残缺的，多余的手指，"
        "画得不好的手部，画得不好的脸部，畸形的，毁容的，形态畸形的肢体，"
        "手指融合，静止不动的画面，杂乱的背景，三条腿，背景人很多，倒着走"
    )

    # Media queue worker (§5/§9). One worker drains the Redis FIFO serially.
    media_poll_seconds: float = 2.0           # how often to poll ComfyUI /history
    media_worker_idle_seconds: float = 2.0    # sleep when the queue is empty
    media_job_timeout_seconds: float = 600.0  # give up on a stuck generation
    media_eta_image_seconds: int = 12         # rough per-image cost for ETA math
    media_eta_video_seconds: int = 90         # rough per-video cost for ETA math
    # When True the worker honours orch:* state set by ai-server/model_loader.py
    # (video-exclusive mode switch, coder serial lock). When False it just serves
    # the FIFO with video priority — safe default for standalone deployments.
    media_orchestrator_enabled: bool = False

    # Feature toggles — source of truth is the root master .env (FEATURE_*).
    feature_media_queue: bool = True
    feature_doc_rag: bool = True

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
