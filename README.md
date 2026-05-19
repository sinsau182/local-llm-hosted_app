# AI Inference Platform

Monorepo scaffold generated from `Modified_System_Architecture_version-2.0.docx`.

## Stack

- Frontend: Next.js 15 + TypeScript + Tailwind + Zustand
- API Gateway: FastAPI (async REST + SSE)
- Data: PostgreSQL 16 + pgvector, Redis
- Inference runtimes: Ollama, ComfyUI (container placeholders)
- Networking: Caddy reverse proxy

## Repository Layout

- `frontend/` Next.js orchestration/admin UI
- `backend/` FastAPI gateway, services, repositories, worker
- `infra/` Caddy and DB initialization scripts
- `inference/` runtime notes and integration placeholders
- `docs/` architecture notes and implementation mapping

## Quick Start

1. Copy env templates:
   - `copy .env.example .env`
   - `copy backend\.env.example backend\.env`
   - `copy frontend\.env.example frontend\.env.local`
2. Start infrastructure:
   - `docker compose up --build`
3. Open:
   - Frontend: http://localhost:3000
   - API docs: http://localhost:8000/docs

## Notes

- Endpoints are scaffolded to match the architecture spec.
- Production authentication, OIDC wiring, GPU runtime integration, and model pipelines require environment-specific values.
