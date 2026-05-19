# Backend (FastAPI Gateway)

## Run locally

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Responsibilities

- Authentication and session token lifecycle
- VRAM-aware admission checks (placeholder service)
- Multimodal inference orchestration endpoints
- Storage quota and artifact metadata APIs
- System telemetry endpoints

## Notes

This scaffold is architecture-aligned and intentionally keeps runtime adapters lightweight placeholders for Ollama, ComfyUI, and ROCm telemetry.
