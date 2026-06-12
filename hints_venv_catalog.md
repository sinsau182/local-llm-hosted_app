# Python Virtual Environments & AI Services Catalog

**Location:** `~/hints_venv`  
**Last updated:** 2026-05-21

## System overview

- Host hardware: Ryzen AI Max+ 395, Radeon 8060S (`gfx1150`/`gfx1151`)
- ROCm: 7.2
- System Python: 3.12.3
- Consolidated model root: `/data/models/`
- Kernel: `6.17.0-xx-generic`
- Previous stable fallback kernel: `6.17.0-14-generic`

## Active virtual environments

### 1. ComfyUI Native (fallback, Docker is primary)
- Path: `/home/breachlabz/ai-server/comfyui-native/.venv`
- Size: 18 GB
- Python: 3.12.3
- Purpose: ComfyUI image/video generation on native host with ROCm GPU support
- Key packages: PyTorch `2.7.1+rocm6.2.4`, `torchvision`, ComfyUI `0.18.1`
- Start command:

```bash
cd /home/breachlabz/ai-server/comfyui-native && screen -dmS comfyui .venv/bin/python ComfyUI/main.py --listen 0.0.0.0
```

- URL: <http://localhost:8188>
- Notes:
  - Docker ComfyUI on `rocm/pytorch:latest` (`2.10.0+rocm7.2`) serves port `8188`
  - Native venv is retained only as fallback
  - Requires GPU environment variables to avoid crashes
  - `torchaudio` has a non-critical import warning affecting only audio nodes

### 2. Dependency_track (Docker active)
- Native path: `/home/breachlabz/platform/tools/Dependency_track/`
- Docker Compose: `/home/breachlabz/platform/tools/docker-compose.yml`
- API server URL: <http://localhost:8082>
- Frontend URL: <http://localhost:8083>
- Status: Runs through `docker-compose` (`dtrack-apiserver` and `dtrack-frontend`)
- Notes: Native `.venv` exists, but Docker is the primary deployment

### 3. License_Scanner (Docker active)
- Native path: `/home/breachlabz/platform/tools/License_Scanner/`
- Docker Compose: `/home/breachlabz/platform/tools/docker-compose.yml`
- Status: Runs through `docker-compose` as part of the platform stack
- Notes: Native `.venv` exists, but Docker is the primary deployment

### 4. cylabz_security_platform (Docker active)
- Native path: `/home/breachlabz/platform/tools/cylabz_security_platform/`
- Docker Compose: `/home/breachlabz/platform/tools/docker-compose.yml`
- Status: Runs through `docker-compose` as part of the platform stack
- Notes: Native `.venv` exists, but Docker is the primary deployment

### 5. Metis_CLI (Docker active)
- Native path: `/home/breachlabz/platform/tools/Metis_CLI/`
- Docker Compose: `/home/breachlabz/platform/tools/docker-compose.yml`
- Status: Runs through `docker-compose` as part of the platform stack
- Notes: Native `.venv` exists, but Docker is the primary deployment

## Development virtual environments

### 6. AI Development (`ai_dev`)
- Path: `/home/breachlabz/platform/ai_dev`
- Python: 3.12.3
- Purpose: AI model training for CAN Bus IDS under Threat Intelligence
- Key packages: PyTorch `2.9.1+rocm6.4`, `numpy 2.4.3`, `pandas 3.0.1`, `scikit-learn 1.8.0`, `matplotlib 3.10.8`, `seaborn 0.13.2`, `scipy 1.17.1`, `psutil 7.2.2`, `onnx 1.20.1`, `onnxruntime 1.24.4`, `jupyter/jupyterlab 4.5.6`
- GPU: AMD Radeon (`gfx1150`) with `torch.cuda.is_available() = True`
- Project: `model_dev/Threat_Intelligence/` — CAN Bus Intrusion Detection System
- Dataset: ROAD CAN Bus dataset (`signal_extractions`: ambient + attacks CSVs)
- Activation:

```bash
source /home/breachlabz/platform/ai_dev/bin/activate
```

- Jupyter:

```bash
jupyter lab --notebook-dir=/home/breachlabz/platform/ai_dev/model_dev/Threat_Intelligence/jupyter_notebook
```

- Notes:
  - Not a service; intended for interactive AI development work
  - GPU environment variables must be exported before launching Jupyter
  - PyTorch bundles its own `libhsa-runtime64.so` from ROCm 6.4 and does not use system ROCm libs
  - If GPU faults occur, reboot into kernel `6.17.0-14-generic`

### 7. Dependency_track (native fallback)
- Path: `/home/breachlabz/platform/tools/Dependency_track/.venv`
- Size: 195 MB
- Python: 3.12.3
- Purpose: Dependency tracking tool with Flask backend and Vite frontend
- Backend start:

```bash
cd /home/breachlabz/platform/tools/Dependency_track && screen -dmS dependency_track .venv/bin/python Dependency_track.py
```

- Backend URL: <http://localhost:5001>
- Frontend start:

```bash
cd /home/breachlabz/platform/tools/Dependency_track/frontend && screen -dmS dependency_track_frontend npm run dev -- --port 5173
```

- Frontend URL: <http://localhost:5173>
- Status: Native fallback kept in case Docker fails

### 8. License_Scanner (native fallback)
- Path: `/home/breachlabz/platform/tools/License_Scanner/.venv`
- Size: 212 MB
- Python: 3.12.3
- Purpose: Flask backend and React frontend for license scanning
- Backend start:

```bash
cd /home/breachlabz/platform/tools/License_Scanner && screen -dmS license_scanner .venv/bin/python License_Scanner.py
```

- Backend URL: <http://localhost:5002>
- Frontend start:

```bash
cd /home/breachlabz/platform/tools/License_Scanner/frontend && screen -dmS license_scanner_ui npm run dev
```

- Frontend URL: <http://localhost:5175>
- Status: Native fallback kept in case Docker fails

### 9. cylabz_security_platform (native fallback)
- Path: `/home/breachlabz/platform/tools/cylabz_security_platform/.venv`
- Size: 31 MB
- Python: 3.12.3
- Purpose: Flask-based security platform orchestrator
- Start:

```bash
cd /home/breachlabz/platform/tools/cylabz_security_platform && screen -dmS cylabz .venv/bin/python orchestrator.py
```

- URL: <http://localhost:5050>
- Status: Native fallback kept in case Docker fails

### 10. Metis_CLI (native fallback)
- Path: `/home/breachlabz/platform/tools/Metis_CLI/.venv`
- Size: 208 MB
- Python: 3.12.3
- Purpose: Flask backend and React frontend for the Metis CLI web interface
- Backend start:

```bash
cd /home/breachlabz/platform/tools/Metis_CLI && screen -dmS metis_cli .venv/bin/python metis_cli.py --web
```

- Backend URL: <http://localhost:5000>
- Frontend start:

```bash
cd /home/breachlabz/platform/tools/Metis_CLI/frontend && screen -dmS metis_cli_frontend npm run dev
```

- Frontend URL: <http://localhost:5174>
- Status: Native fallback kept in case Docker fails

## AI services and endpoints

### Ollama
- Binary: `/usr/local/bin/ollama` (`v0.18.1`)
- Service: systemd under user `ollama`
- Service control:

```bash
sudo systemctl {start|stop|restart|status} ollama
```

- API: <http://localhost:11434>
- Web UI: <http://localhost:3010>
- UI container: `open-webui`
- Models path: `/data/models/ollama/` (166 GB total)
- Systemd override: `/etc/systemd/system/ollama.service.d/override.conf`
- Model override environment:

```text
Environment="OLLAMA_MODELS=/data/models/ollama"
```

- GPU mode: Vulkan, not ROCm/HIP
- Vulkan setting:

```text
OLLAMA_VULKAN=1
```

- Notes:
  - Uses Mesa RADV Vulkan driver on `gfx1151`
  - ROCm/HIP discovery fails during startup, but Vulkan fallback is stable and intentional

#### Ollama CLI examples

```bash
ollama list
ollama run qwen3.5:27b
ollama run qwen2.5:7b "hello"
```

#### Ollama models

| Model | Size | Use case |
|---|---:|---|
| `qwen3-coder-next` | 51.7 GB | Coding |
| `qwen2.5:72b` | 47.4 GB | General purpose (large) |
| `qwen3-vl:32b` | 20.9 GB | Vision + language |
| `deepseek-r1:32b` | 19.9 GB | Reasoning |
| `qwen3.5:27b` | 17.4 GB | General purpose (medium) |
| `qwen3-embedding:8b` | 4.7 GB | RAG embeddings |
| `qwen2.5:7b` | 4.7 GB | General purpose (small/fast) |

### ComfyUI
- Install path: `/home/breachlabz/ai-server/comfyui-native/ComfyUI/`
- Native venv: `/home/breachlabz/ai-server/comfyui-native/.venv`
- Service: Docker container `comfyui`
- Compose file: `/home/breachlabz/ai-server/docker-compose.yml`
- Start:

```bash
docker compose -f /home/breachlabz/ai-server/docker-compose.yml up -d comfyui
```

- API/UI: <http://localhost:8188>
- Models path: `/data/models/comfyui/` (149 GB total)
- Config source: `extra_model_paths.yaml` in the ComfyUI directory
- Notes:
  - AMD GPU is visible in the container with 66 GB GTT VRAM shown
  - GPU compute reliability depends on KFD access and the running kernel

#### Native fallback start

```bash
cd /home/breachlabz/ai-server/comfyui-native && screen -dmS comfyui .venv/bin/python ComfyUI/main.py --listen 0.0.0.0
```

### Open WebUI
- Container: `open-webui` (`ghcr.io/open-webui/open-webui:main`)
- Port: <http://localhost:3010>
- Config:

```text
OLLAMA_BASE_URL=http://host.docker.internal:11434
```

- Embedding model: `qwen3-embedding:8b`

#### ComfyUI model storage layout

```text
/data/models/comfyui/
├── checkpoints/
│   ├── flux2-klein/          (23 GB)  — Image generation
│   ├── ltx-2.3/              (26 GB)  — Video generation (LTX 0.9.8)
│   ├── wan2.1-14b/           (65 GB)  — Video generation (high quality)
│   └── wan2.1-1.3b/          (6 GB)   — Video generation (fast, shared T5/VAE via symlink)
├── clip/                     (4.8 GB) — Text encoders for image models
├── vae/
├── loras/
├── embeddings/
├── controlnet/
└── upscale_models/
```

### Other model directories
- Reranker: `/data/models/reranker/` (2.2 GB)
- TTS: `/data/models/tts/` (347 MB) — Kokoro TTS
- Hugging Face cache: `/data/models/huggingface/` (empty)

## Default Ollama usage guidance

```text
ollama run qwen3-coder-128k → daily driver
ollama run qwen3-coder-256k → only when massive context is specifically needed
```

## Known issues and fixes

### Open WebUI port mapping
- Problem: Container was originally created with host port `3000`, while Compose was later updated to `3010:8080`, so port `3010` was not accessible
- Symptom: `http://localhost:3010` returned connection refused
- Fix:

```bash
docker compose -f /home/breachlabz/ai-server/docker-compose.yml up -d --force-recreate open-webui
```

- Verify:

```bash
curl http://localhost:3010
```

- Status: Fixed

### Flask apps do not auto-start after reboot
- Native Flask apps do not have systemd services
- They must be started manually in `screen` sessions when Docker fails
- Quick-start commands:

```bash
cd /home/breachlabz/platform/tools/Dependency_track && screen -dmS dependency_track .venv/bin/python Dependency_track.py
cd /home/breachlabz/platform/tools/License_Scanner && screen -dmS license_scanner .venv/bin/python License_Scanner.py
cd /home/breachlabz/platform/tools/cylabz_security_platform && screen -dmS cylabz .venv/bin/python orchestrator.py
cd /home/breachlabz/platform/tools/Metis_CLI && screen -dmS metis_cli .venv/bin/python metis_cli.py --web
```

- Status: Docker containers are now the primary deployment method; native venvs remain fallback only

### Platform tools Docker stack
- Main Compose: `/home/breachlabz/platform/tools/docker-compose.yml`
- Services:
  - `fossology` (`8090`)
  - `dtrack-apiserver` (`8082`)
  - `dtrack-frontend` (`8083`)
  - `swagger-ui` (`8084`)
  - `pgadmin` (`8085`)
  - `sonarqube` (`9000`)
- Start:

```bash
docker compose -f /home/breachlabz/platform/tools/docker-compose.yml up -d
```

### Scanner Pro Docker stack
- Compose: `/home/breachlabz/platform/tools/scanner_pro/docker-compose.yml`
- Services:
  - `nginx` (`80`)
  - `frontend` (`3000`)
  - `auth` (`3001`)
  - `project` (`3002`)
  - `engine` (`8010`)
  - `report` (`3003`)
  - `postgres` (`5436`)
  - `redis` (`6381`)
- Start:

```bash
docker compose -f /home/breachlabz/platform/tools/scanner_pro/docker-compose.yml up -d
```

### Vulnguard Docker stack
- Compose: `/home/breachlabz/platform/tools/vulnguard/docker-compose.yml`
- Directory: `/home/breachlabz/platform/tools/vulnguard/`

### Portainer standalone
- Container: `portainer/portainer-ce:latest`
- Ports: `8000` (agent), `9443` (UI)
- Start:

```bash
docker run -d -p 9443:9443 --name portainer --restart=unless-stopped -v /var/run/docker.sock:/var/run/docker.sock portainer/portainer-ce:latest
```

### ComfyUI Docker GPU note
- The container can see GPU devices through `--device` flags
- KFD memory operations may still fail depending on cgroup driver and kernel
- Use the native venv as GPU fallback when container GPU execution is unstable

## Removed virtual environments

Removed during cleanup on `2026-04-01`:

- `~/ai-env` (14 GB) — CUDA-based PyTorch, unusable on AMD GPU
- `platform/tools/scanner_pro/.venv` (517 MB) — Windows-origin, unusable on Linux
- `platform/tools/vulnguard/.venv` (454 MB) — Windows-origin, unusable on Linux
- `platform/tools/Metis/Docker_based_metis/.venv` (13 MB) — Windows-origin, unusable
- `platform/tools/Metis/.venv` (631 MB) — Windows-origin, unusable
- `platform/tools/Metis_CLI/tools/metis/.venv` (838 MB) — Windows-origin, unusable
- `~/llm-tools/` (895 MB) — `llama.cpp` and `text-generation-webui`, superseded by Ollama
- `ai_dev/.../jupyter_notebook/.venv` (5.2 GB) — Windows-origin, unusable; removed on `2026-04-02`

Total freed from venv cleanup: approximately **17.3 GB**.

## Platform Docker stacks summary

### Main platform tools

| Service | Port(s) | Purpose |
|---|---|---|
| `fossology` | `8090` | Open-source license compliance |
| `dtrack-apiserver` | `8082` | Dependency-Track API server |
| `dtrack-frontend` | `8083` | Dependency-Track web UI |
| `swagger-ui` | `8084` | API documentation |
| `pgadmin` | `8085` | PostgreSQL management |
| `sonarqube` | `9000` | Code quality and security scanning |

### Scanner Pro

| Service | Port(s) | Purpose |
|---|---|---|
| `nginx` | `80` | Reverse proxy |
| `frontend` | `3000` | Web UI |
| `auth` | `3001` | Authentication service |
| `project` | `3002` | Project management |
| `engine` | `8010` | Scanning engine |
| `report` | `3003` | Report generation |
| `postgres` | `5436` | Database |
| `redis` | `6381` | Cache |

### AI server

| Service | Port(s) | Purpose |
|---|---|---|
| `open-webui` | `3010` | Ollama web interface |
| `comfyui` | `8188` | Image and video generation |

## GPU workarounds for ROCm and PyTorch on `gfx1150`

### Required environment variables before any `.cuda()` call

```bash
export HSA_OVERRIDE_GFX_VERSION=11.5.0
export HSA_XNACK=1
export PYTORCH_HIP_ALLOC_CONF=max_split_size_mb:512
```

#### Notes
- `HSA_OVERRIDE_GFX_VERSION=11.5.0`: tells ROCm to treat the GPU as `gfx1150`
- `HSA_XNACK=1`: enables XNACK, required for APU unified memory page-fault retry
- `PYTORCH_HIP_ALLOC_CONF=max_split_size_mb:512`: reduces HIP allocator fragmentation and helps avoid OOM issues

### Permanent shell configuration

Add the following to `~/.bashrc` or `~/.profile`:

```bash
export HSA_OVERRIDE_GFX_VERSION=11.5.0
export HSA_XNACK=1
export PYTORCH_HIP_ALLOC_CONF=max_split_size_mb:512
```

### Kernel boot parameters

Set these in `/etc/default/grub` under `GRUB_CMDLINE_LINUX_DEFAULT`:

```text
amdgpu.gttsize=122880
amdgpu.noretry=0
ttm.pages_limit=31457280
```

- Apply with:

```bash
sudo update-grub && sudo reboot
```

- Verify GTT allocation:

```bash
cat /sys/class/drm/card*/device/mem_info_gtt_total
```

Expected value is roughly 128 GB.

### Kernel compatibility
- `6.17.0-14-generic`: last known good kernel for ROCm/HIP PyTorch GPU operations
- `6.17.0-19-generic`: broken; triggers KFD memory access faults on `.cuda()` calls
- Roll back through GRUB advanced options if required
- Set default kernel:

```bash
sudo grub-set-default 'gnome-advanced-6.17.0-14-generic'
```

- Inspect exact menu entry:

```bash
grep -i menuentry /boot/grub/grub.cfg | head -20
```

### Vulkan vs ROCm
- Ollama uses Vulkan with `OLLAMA_VULKAN=1` and remains stable without ROCm environment variables
- PyTorch and ComfyUI use ROCm/HIP and depend on the environment variables and kernel compatibility listed above
- If ROCm fails, Ollama can still run through Vulkan

### GPU crash diagnostics

```bash
rocm-smi
rocminfo | grep -A5 "Agent 2"
HSA_OVERRIDE_GFX_VERSION=11.5.0 HSA_XNACK=1 python3 -c "import torch; print(torch.cuda.is_available())"
```

If the last command fails with `Memory access fault`, the kernel is the likely cause and a reboot into `6.17.0-14-generic` is recommended.
