# Architecture Summary (v2.0 Mapping)

This scaffold reflects the architecture document's key requirements:

- Four-layer system split (UI, API orchestration, data/services, inference runtimes)
- FastAPI gateway with typed request/response contracts
- Next.js dashboard with session state and typed API access
- PostgreSQL + pgvector + Redis data plane
- Sharded media storage rooted at `/data/media/{user_id}/{date}/{job_uuid}`
- Async media jobs and SSE-friendly chat pathway
- Docker Compose single-host deployment profile

## Endpoints Scaffolded

- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `GET /api/v1/auth/me`
- `POST /api/v1/inference/chat`
- `POST /api/v1/inference/media`
- `GET /api/v1/inference/jobs/{id}`
- `GET /api/v1/inference/models`
- `GET /api/v1/storage/quota`
- `GET /api/v1/storage/files`
- `DELETE /api/v1/storage/files/{id}`
- `GET /api/v1/sys/vram`
- `GET /api/v1/sys/queue`

## Remaining Integration Work

- OIDC Google Workspace callback and domain allowlist
- RS256 key lifecycle and token revocation persistence
- Real VRAM monitor adapter (ROCm-SMI)
- Ollama/ComfyUI adapters and model precision policy
- Background job queue and durable retries
- Production-grade migrations and role-based policies
