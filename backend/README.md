# Backend (FastAPI Gateway)

## Run locally

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Runtime configuration

Set these environment variables when connecting to a real Ollama instance:

- `OLLAMA_URL` - defaults to `http://localhost:11434`
- `OLLAMA_TIMEOUT_SECONDS` - defaults to `30`

When Ollama is reachable, `POST /api/v1/inference/chat` uses the model you pass in the request, and `GET /api/v1/inference/models` reflects the models returned by Ollama's `/api/tags` endpoint.

## Responsibilities

- Authentication and session token lifecycle
- VRAM-aware admission checks (placeholder service)
- Multimodal inference orchestration endpoints
- Storage quota and artifact metadata APIs
- System telemetry endpoints

## Notes

This scaffold is architecture-aligned and intentionally keeps runtime adapters lightweight placeholders for Ollama, ComfyUI, and ROCm telemetry.
