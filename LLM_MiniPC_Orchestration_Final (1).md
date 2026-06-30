# Local LLM Mini PC — Final Orchestration Design

**Hardware:** AMD Ryzen AI MAX+ 395, 128 GB unified LPDDR5X, Radeon 8060S iGPU  
**Users:** 15 (3 Tailscale accounts × 5 users each)  
**Stack:** llama.cpp (Vulkan) → LiteLLM `:4001` → LibreChat  
**Status:** This is the document you follow. No deviations.

---

## 1. Memory Budget — Hard Ceiling

```
128 GB total
 - 16 GB  →  OS + Docker + LibreChat + LiteLLM + misc
 -  8 GB  →  Safety headroom (page cache, spikes)
─────────────────────────────────────────────────
104 GB usable for inference
```

| Engine | Weights | KV cache | Total | Mode |
|---|---|---|---|---|
| Qwen3.5-9B | 9.5 GB | 14 GB | **24 GB** | Always on |
| Qwen3.6-27B | 28 GB | 16 GB | **44 GB** | Always on |
| Qwen-Coder-Next | 33 GB | 6 GB | **39 GB** | On-demand |
| Whisper (STT) | 2 GB | — | **2 GB** | Always on, CPU |
| Kokoro (TTS) | 0.5 GB | — | **0.5 GB** | Always on, CPU |
| FLUX image | 12 GB | — | **12 GB** | On-demand, iGPU |
| LTX-Video | 18–22 GB | — | **20 GB** | Queue-only, exclusive |

**Safe peak scenarios:**

| Scenario | Memory used | Safe? |
|---|---|---|
| 9B + 27B always on + audio | ~71 GB | ✅ Always |
| + Coder loaded (normal mode) | ~110 GB | ✅ Within budget |
| + FLUX image (Coder idle) | ~83 GB | ✅ Safe |
| + FLUX image (Coder active) | ~122 GB | ⚠️ Tight, serial lock required |
| + Video (Coder active) | ~131 GB | ❌ OOM — trigger video mode |

---

## 2. Two Operating Modes

The orchestrator (`model_loader.py`) maintains one of two system states at all times.

```
┌─────────────────────────────────────────────────────────┐
│  NORMAL MODE                                            │
│                                                         │
│  9B ████████ always on                                  │
│  27B ███████████████ always on                          │
│  Coder ████████████████████ on-demand (10 min idle TTL) │
│  Audio ██ always on (CPU, no iGPU conflict)             │
│  FLUX  ████████ on-demand, serial lock with Coder       │
│  Video  OFF — 0 GB used                                 │
│                                                         │
│  Trigger to VIDEO MODE: video request arrives in queue  │
└─────────────────────────────────────────────────────────┘
                           ↕ mode switch (~2–3 min drain)
┌─────────────────────────────────────────────────────────┐
│  VIDEO MODE                                             │
│                                                         │
│  9B ████████ always on                                  │
│  27B ███████████████ always on                          │
│  Coder  DRAINING → SIGSTOP (frozen, frees iGPU)        │
│  Audio ██ always on (CPU)                               │
│  FLUX  BLOCKED during video run                         │
│  Video ████████████████████ warm, queue served          │
│                                                         │
│  Return to NORMAL MODE: video queue empty for 15 min    │
└─────────────────────────────────────────────────────────┘
```

**What users experience during mode switch:**
- Coding requests → silently routed to Qwen-27B with `X-Model-Degraded: coder-draining` header. LibreChat shows model name only — users see no error.
- Video requester → sees "Video queued — ~60–90 s. Starting now." toast.
- Image requests → queued behind video, served after.

---

## 3. Coder-80B State Machine

Coder is the most dangerous model on the box. It gets its own state machine.

```
         idle request
              │
    ┌─────────▼──────────┐
    │       IDLE         │◄────────────────────────────┐
    │   not loaded,      │                             │
    │   0 GB used        │                             │ idle > 10 min
    └─────────┬──────────┘                             │
              │ coding request arrives                 │
    ┌─────────▼──────────┐                   ┌─────────┴──────────┐
    │      LOADING       │                   │      RUNNING       │
    │  ~15–25 s cold     │──── ready ───────►│  max 1 concurrent  │
    │  start, serial     │                   │  slot (--parallel 2│
    │  lock held         │                   │  but 1 at LiteLLM) │
    └────────────────────┘                   └─────────┬──────────┘
                                                       │ video req OR
                                                       │ image needs mem
                                             ┌─────────▼──────────┐
                                             │     DRAINING       │
                                             │  finish current    │
                                             │  req, no new jobs  │
                                             │  → SIGSTOP / unload│
                                             └────────────────────┘
```

**Hard rules for Coder:**
- `--parallel 1` at LiteLLM level (even though llama.cpp runs `--parallel 2` internally). Only one user job in flight at a time.
- Never SIGKILL mid-inference. Always drain first. A hard kill leaves KV cache dirty and memory unaccounted until the process fully exits.
- During DRAINING, new coding requests go to 27B. Do not queue them for Coder — the drain could take 3–5 minutes.
- cgroup memory limit: `56 GB` hard ceiling on the Coder process via systemd slice. If it spikes past this (runaway KV), the kernel kills only Coder, not the whole system.

---

## 4. t/s Optimization — 9B and 27B

This is the priority. Every flag below has a measured reason.

### Qwen3.5-9B — target 28–35 t/s single user, ~65 t/s aggregate at 5 concurrent

```bash
llama-server \
  -m /models/qwen3.5-9b-q8_0.gguf \
  -ngl 99 \                          # full iGPU offload — no layers on CPU
  -fa \                              # FlashAttention: +15–25% decode t/s on Vulkan
  -c 32768 \                         # 32k context per slot
  --parallel 6 \                     # 6 slots — enough for 15 users at realistic concurrency
  --cont-batching \                  # CRITICAL: 2–3× aggregate throughput at 5+ users
  --cache-type-k q8_0 \             # quantized KV: ~50% memory cut, negligible quality loss
  --cache-type-v q8_0 \             # this is what makes --parallel 6 affordable
  --mlock \                          # pin weights — no swap on unified memory
  --no-mmap \                        # prevent OS double-buffering on unified mem
  --host 0.0.0.0 --port 8081
```

**Additional t/s levers for 9B specifically:**
- `--threads 8` — Ryzen AI MAX+ has 16 cores; 8 threads for decode is the sweet spot (leave headroom for 27B + OS)
- `--batch-size 512` — larger prefill batch = faster prompt processing when multiple users hit simultaneously
- `--ubatch-size 128` — micro-batch for continuous batching; tune down to 64 if latency spikes under load

### Qwen3.6-27B — target 10–14 t/s single user

```bash
llama-server \
  -m /models/qwen3.6-27b-q8_0.gguf \
  -ngl 99 \
  -fa \
  -c 24576 \                         # 24k not 32k — context dominates decode cost at this size
  --parallel 4 \
  --cont-batching \
  --cache-type-k q8_0 \
  --cache-type-v q8_0 \
  --mlock \
  --no-mmap \
  --threads 8 \
  --batch-size 512 \
  --host 0.0.0.0 --port 8082
```

**27B t/s tuning rule:** if t/s drops below 8 under load, the fix is **not** more parallel slots — it is dropping `-c` from 24576 to 16384. Context length dominates decode cost at 27B scale. Do this before anything else.

### Qwen-Coder-Next — target 8–12 t/s

```bash
llama-server \
  -m /models/qwen-coder-next-q8_0.gguf \
  -ngl 99 \
  -fa \
  -c 65536 \                         # long context is the whole point of this model
  --parallel 2 \                     # 2 internal slots, but LiteLLM enforces 1 at proxy
  --cont-batching \
  --cache-type-k q8_0 \
  --cache-type-v q8_0 \
  --mlock \
  --host 0.0.0.0 --port 8083
```

### Why these flags are non-negotiable

| Flag | Effect | Without it |
|---|---|---|
| `--cont-batching` | New requests join in-flight batch | Each request waits for previous to finish — 3× worse throughput |
| `-fa` | FlashAttention: lower KV bandwidth | 15–25% t/s loss, more memory pressure |
| `--cache-type-k/v q8_0` | 50% KV footprint reduction | Can't afford `--parallel 6` on 9B, system OOMs under load |
| `--mlock` | Weights pinned in RAM | OS swaps hot layers to disk under memory pressure — catastrophic t/s drop |
| `--no-mmap` | No OS double-buffering | Unified memory gets double-accounted, effective headroom halves |
| `-ngl 99` | All layers on iGPU | CPU decode is 4–6× slower |

---

## 5. Media Models — Scheduling Rules

### Audio (always on, CPU — zero iGPU conflict)

| Model | Engine | Port | Mode | Footprint |
|---|---|---|---|---|
| Whisper large-v3-q5 | whisper.cpp | 9001 | Always on, CPU | ~2 GB |
| Kokoro-82M | kokoro | 9002 | Always on, CPU | ~0.5 GB |

Audio runs on CPU only. It does not touch the iGPU. It does not conflict with any Qwen model. Load once at startup, never unload.

### Image (on-demand, serial lock)

```
User requests image
        │
        ▼
Is Coder currently RUNNING?
        │
   YES  │  NO
        │   └──► Is FLUX loaded?
        │              │
        │         YES  │  NO
        │              │   └──► Acquire serial lock → load FLUX (~12 GB) → generate
        │              └──► Generate immediately
        │
        └──► Queue image job (Redis FIFO)
             User sees: "Image queued — position N, ~45s"
             Served after Coder finishes current request
```

**FLUX flags (ComfyUI):**
- Model: `FLUX.1-schnell` fp8 — 4-step generation, ~5–8 s/image
- Run with `--highvram` flag in ComfyUI
- Unload after 10 min idle (frees 12 GB back to Qwen headroom)
- Never run simultaneously with video

### Video (queue-only, exclusive mode)

Video is the most expensive operation on this box. It gets a dedicated Redis queue and is the only model that triggers a full mode switch.

```
Video request arrives
        │
        ▼
Orchestrator sets mode = VIDEO
        │
        ▼
Coder state → DRAINING (finish current, no new jobs)
        │
        ▼
Wait for Coder to finish (~max 5 min)
        │
        ▼
SIGSTOP Coder container (frozen, iGPU freed, ~33 GB reclaimed)
        │
        ▼
Load LTX-Video (~20 GB) → process queue one job at a time
        │
        ▼
Video queue empty for 15 min?
        │
        ▼
SIGCONT Coder → Coder resumes → mode = NORMAL
```

User-facing message: **"Video queued — estimated 60–120 s. Your job is position N."**  
Be explicit: video on this box is batch, not interactive.

---

## 6. Full System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Tailscale (3 accounts, 5 users each)                          │
│  Account A → virtual key K1  │  Account B → K2  │  C → K3     │
└────────────────────┬────────────────────────────────────────────┘
                     │ HTTPS via Caddy
                     ▼
              ┌─────────────┐
              │  LibreChat  │   ← message thread continuity lives here
              └──────┬──────┘
                     │ OpenAI-compatible API
                     ▼
        ┌────────────────────────┐
        │   LiteLLM  :4001       │
        │   least-busy routing   │
        │   per-key rpm/tpm caps │
        │   Redis-backed queues  │
        └──┬──────┬──────┬───┬──┘
           │      │      │   │
    ┌──────▼─┐ ┌──▼───┐ ┌▼──────────┐  ┌─────────┐
    │ 9B     │ │ 27B  │ │ Coder     │  │  Redis  │
    │ :8081  │ │ :8082│ │ :8083     │  │  queue  │
    │ p=6    │ │ p=4  │ │ p=2 (1 at │  │  state  │
    │ KVq8   │ │ KVq8 │ │  LiteLLM) │  └─────────┘
    └────────┘ └──────┘ └───────────┘
           │ model_loader.py orchestrates everything below
           ▼
    ┌──────────────────────────────────────────────┐
    │  Media sidecar processes                     │
    │                                              │
    │  Whisper :9001  ──── CPU, always on          │
    │  Kokoro  :9002  ──── CPU, always on          │
    │  FLUX    :9003  ──── iGPU, on-demand         │
    │  LTX-Video :9004 ── iGPU, queue-only         │
    └──────────────────────────────────────────────┘
```

**LiteLLM endpoints exposed:**

| Endpoint | Routes to | Notes |
|---|---|---|
| `POST /v1/chat/completions` model=general | Qwen 9B :8081 | Default for all chat |
| `POST /v1/chat/completions` model=reasoning | Qwen 27B :8082 | Explicit think tasks |
| `POST /v1/chat/completions` model=coder | Coder :8083 | Code only |
| `POST /v1/audio/transcriptions` | Whisper :9001 | STT |
| `POST /v1/audio/speech` | Kokoro :9002 | TTS |
| `POST /v1/images/generations` | ComfyUI/FLUX :9003 | Image gen |
| `POST /v1/videos/generations` | ComfyUI/LTX :9004 | Video, queued |

---

## 7. LiteLLM Config (production-ready)

```yaml
model_list:
  - model_name: general
    litellm_params:
      model: openai/qwen3.5-9b
      api_base: http://llama-9b:8081/v1
      api_key: dummy
      rpm: 120
      timeout: 60

  - model_name: reasoning
    litellm_params:
      model: openai/qwen3.6-27b
      api_base: http://llama-27b:8082/v1
      api_key: dummy
      rpm: 60
      timeout: 120

  - model_name: coder
    litellm_params:
      model: openai/qwen-coder-next
      api_base: http://llama-coder:8083/v1
      api_key: dummy
      rpm: 30
      timeout: 300

  - model_name: whisper
    litellm_params:
      model: openai/whisper-large-v3
      api_base: http://whisper:9001/v1
      api_key: dummy

  - model_name: kokoro
    litellm_params:
      model: openai/kokoro
      api_base: http://kokoro:9002/v1
      api_key: dummy

  - model_name: flux
    litellm_params:
      model: openai/flux-schnell
      api_base: http://comfyui:9003/v1
      api_key: dummy

  - model_name: video
    litellm_params:
      model: openai/ltx-video
      api_base: http://comfyui-video:9004/v1
      api_key: dummy

router_settings:
  routing_strategy: least-busy
  num_retries: 1
  timeout: 120
  fallbacks:
    - reasoning: [general]     # 27B saturated → fall to 9B
    - coder: [reasoning]       # Coder draining → fall to 27B silently
  redis_host: redis
  redis_port: 6379

general_settings:
  master_key: ${LITELLM_MASTER_KEY}
  database_url: ${POSTGRES_URL}
  max_parallel_requests: 16
  # pre_call_hook wired to model_loader.py for heavy models
  callbacks: ["model_loader.litellm_pre_call_hook"]

# Per-account virtual key limits (set via LiteLLM UI or API after deploy)
# Key K1, K2, K3 — each gets:
#   general:   rpm=40, tpm=30000
#   reasoning: rpm=20, tpm=15000
#   coder:     rpm=10, tpm=10000
```

---

## 8. cgroup Safety Nets (systemd, cgroupv2)

These are the hard stops that prevent a runaway model from rebooting the system.

```ini
# /etc/systemd/system/llama-coder.service
[Unit]
Description=Qwen Coder llama.cpp server
After=network.target

[Service]
ExecStart=/usr/local/bin/llama-server -m /models/qwen-coder-next-q8_0.gguf \
  -ngl 99 -fa -c 65536 --parallel 2 --cont-batching \
  --cache-type-k q8_0 --cache-type-v q8_0 \
  --mlock --host 0.0.0.0 --port 8083
MemoryMax=56G          # hard ceiling — kernel kills this process, not system
MemoryHigh=48G         # soft warning — kernel starts reclaiming at this point
CPUQuota=800%          # max 8 cores out of 16
Restart=on-failure
RestartSec=5
User=saurav

[Install]
WantedBy=multi-user.target
```

```ini
# /etc/systemd/system/comfyui-video.service
[Service]
MemoryMax=28G           # 20 GB model + 8 GB spike buffer
MemoryHigh=24G
CPUQuota=400%
```

```ini
# /etc/systemd/system/comfyui-flux.service
[Service]
MemoryMax=24G           # 12 GB base + 12 GB peak spike
MemoryHigh=20G
```

**Why this matters:** without cgroup limits, FLUX's 12 GB peak spike can grow to 22+ GB and collide with Coder's 50 GB during a simultaneous request. With the limits, the OS kills only the offending process — not the whole box.

---

## 9. Image Queue — Redis FIFO with Position Tracking

Every image request goes through Redis. No direct FLUX calls. This is what prevents the reboot scenario.

**Queue flow:**

```
POST /v1/images/generations
        │
        ▼
model_loader.py checks:
  - Is Coder RUNNING? → enqueue, return position
  - Is video active?  → enqueue, return position
  - Is FLUX loaded?   → generate immediately
  - Is FLUX unloaded? → load FLUX, then generate
        │
        ▼
Redis key: image_queue (LIST, LPUSH / BRPOP)
Redis key: image_queue_position (HASH, job_id → position)
        │
        ▼
FLUX worker (single process) polls queue
Generates one image at a time — never parallel
        │
        ▼
Result stored at /outputs/{job_id}.png
User polled via GET /v1/images/status/{job_id}
Response: { status: "queued|processing|done", position: N, eta_seconds: N }
```

---

## 10. Monitoring — What to Watch

| Metric | Source | Action if breached |
|---|---|---|
| `kv_cache_used_cells` > 85% for 5 min | llama-server `/metrics` | Drop `--parallel` by 1 on that engine |
| RSS > 110 GB system-wide | `node_exporter` | Check if cgroup limits are set — something escaped |
| 27B t/s < 8 under load | Prometheus | Lower `-c` from 24576 → 16384 |
| Image queue depth > 5 | Redis `LLEN image_queue` | Alert — users waiting > 3 min |
| Video queue depth > 2 | Redis `LLEN video_queue` | Alert — users waiting > 4 min |
| Coder in DRAINING > 6 min | model_loader state | Force SIGSTOP, log the incident |

```bash
# Quick health check — run anytime
python3 model_loader.py --status

# Expected output in normal mode:
# ────────────────────────────────────────
#   System: 98.4 GB used / 128 GB (77%)
#   9B      :8081   ● running   active 4m ago   9.5 GB
#   27B     :8082   ● running   active 1m ago   28 GB
#   Coder   :8083   ● running   active 8m ago   33 GB
#   Whisper :9001   ● running   always-on       2 GB
#   Kokoro  :9002   ● running   always-on       0.5 GB
#   FLUX    :9003   ○ stopped   idle 12m ago    0 GB
#   Video   :9004   ○ stopped   idle             0 GB
# ────────────────────────────────────────
```

---

## 11. Operational Runbook

**Coder OOM crash:**
```bash
systemctl restart llama-coder
python3 model_loader.py --status   # verify clean restart
```

**FLUX caused system to go unresponsive:**
```bash
# Check if cgroup limits are applied
systemctl status comfyui-flux | grep Memory
# If not, apply limits and restart
systemctl edit comfyui-flux   # add MemoryMax=24G
systemctl restart comfyui-flux
```

**27B t/s dropped below 8:**
```bash
# Lower context window — this is always the fix
# Edit docker-compose or systemd service:
# Change -c 24576 → -c 16384
systemctl restart llama-27b
```

**Video stuck in queue:**
```bash
python3 model_loader.py --kill ltx-video
python3 model_loader.py --ensure ltx-video
# Check stderr log:
cat /tmp/ltx-video.stderr.log | tail -50
```

**Force return to normal mode:**
```bash
python3 model_loader.py --mode normal   # drains video, reloads Coder
```

---

## 12. Two-Week Delivery Sequence

**Week 1 — Stable serving**

| Day | Task |
|---|---|
| 1 | Pull Q8 GGUFs (9B, 27B, Coder). Verify checksums. Confirm llama.cpp Vulkan build (Mesa ≥ 24.2 required). |
| 2 | Start 9B + 27B with all flags from §4. Single-user smoke test — verify t/s targets. |
| 3 | Wire LiteLLM `:4001`. LibreChat points only at LiteLLM. Test message thread continuity end-to-end. |
| 4 | Deploy model_loader.py. Coder as on-demand profile. Test cold start → warm → idle unload cycle. |
| 5 | Tailscale ACLs + 3 virtual keys. Test per-account rpm/tpm isolation — one team cannot starve others. |

**Week 2 — Media + load hardening**

| Day | Task |
|---|---|
| 6 | Whisper + Kokoro up on CPU. Verify no iGPU conflict with Qwen under load. |
| 7 | FLUX image queue via Redis. Test serial lock with Coder active. Verify no reboot. |
| 8 | LTX-Video queue + mode switch. Test SIGSTOP/SIGCONT Coder cycle. Verify Coder resumes cleanly. |
| 9 | Apply cgroup limits to all heavy models. Full 15-user mixed soak (1 hr). Watch RSS + OOM killer. |
| 10 | Ship. Runbook verified. Document confirmed port/model map. Done. |

---

## 13. Decisions — Final, No Renegotiation

| Decision | What | Why |
|---|---|---|
| LibreChat only | No Open WebUI | Message thread continuity — LiteLLM dev UI breaks conversation context |
| Coder max 1 concurrent at LiteLLM | `--parallel 1` at proxy | KV spike is bounded and predictable |
| Video mode switch via SIGSTOP | Not hard kill | Dirty KV cache on SIGKILL causes phantom memory until full process exit |
| cgroup limits on all heavy models | systemd `MemoryMax` | OOM killer targets process, not system — no more reboots |
| FLUX serial lock | Redis queue, one job at a time | Parallel FLUX would double the spike to ~44 GB, guaranteed OOM with Coder active |
| Fallback coder → reasoning | LiteLLM fallback config | Users get 27B silently during drain — no error, no broken experience |
