# Ollama Integration Placeholder

Planned responsibilities:

- Host chat/code models with continuous batching (`OLLAMA_NUM_PARALLEL`)
- Expose runtime model list and residency info to API gateway
- Provide precision-aware loading (Q4/Q8/FP16 policy)

Expected API binding in backend: `app/services/inference_service.py`.
