# KV Cache, Context Window & Memory Report — Qwen llama.cpp Stack

**Host:** AMD Ryzen AI MAX+ 395 / Radeon 8060S (Strix Halo) · 128 GB unified LPDDR5X (~122 GiB usable, ~256 GB/s shared bandwidth)
**Runtime:** llama.cpp server (Vulkan), 3 models, fronted by LiteLLM. **No Ollama in this stack.**
**Generated:** 2026-06-19 · figures read from the live container args + GGUF metadata.

---

## 1. The three models — KV cache at the context window currently set

| Model (LiteLLM name) | Quant | Architecture | Weights | **ctx set** | KV type | **KV cache @ ctx** | Weights+KV |
|---|---|---|---|---|---|---|---|
| `qwen3-coder-next` | Q4_K_M | qwen3next — hybrid MoE, **12 of 48** attention layers | 45.2 GiB | **131 072** | q8_0 | **1.59 GiB** | 46.8 GiB |
| `qwen3.6-27b` | Q8_0 | qwen35 — dense, 65 layers | 27.1 GiB | **32 768** | q8_0 | **4.32 GiB** | 31.4 GiB |
| `qwen3.5-9b` | Q8_0 | qwen35 — dense, 33 layers | 9.1 GiB | **32 768** | q8_0 | **2.19 GiB** | 11.3 GiB |

> The Coder is a **hybrid** model: only every 4th layer (`full_attention_interval=4`) keeps a growing KV cache; the other 36 layers use a fixed-size linear-attention (SSM) state. That + q8_0 cache is why a 131k window costs it only ~1.6 GiB.

---

## 2. Where the context window is configured

| Layer | File | Controls context? | Key |
|---|---|---|---|
| **llama.cpp server** | `docker-compose.yml` (each `llama-*` service `command:`) | ✅ **Source of truth** | `--ctx-size`, `--cache-type-k/v`, `--flash-attn` |
| **LiteLLM** | `litellm-config.yaml` | ❌ No — proxy/router only | (routes to llama; can cap `max_tokens` per request, not the window) |
| **GGUF metadata** | the `.gguf` file | ℹ️ Read-only — *trained* max | `qwen3*.context_length = 262144` |
| **Ollama** | — | n/a | **not used** — models run on llama.cpp directly |

Current `--ctx-size` values: Coder `131072`, 27b `32768`, 9b `32768`. All models are **trained for 262 144**, so the ceiling is config, not the model.

---

## 3. How KV cache is calculated

```
KV bytes = ctx_tokens × KV_layers × n_kv_heads × (key_len + value_len) × bytes_per_element
```
- **n_parallel = 4 but kv_unified = true** → one shared cache sized at `ctx` (NOT ×4). The 4 slots share the window.
- **bytes_per_element:** f16 = 2.0 · q8_0 ≈ 1.0625 (≈ halves KV vs f16).
- Architecture (from GGUF): all three use `key_len = value_len = 256`. Coder `n_kv_heads=2` over 12 attn layers; 27b/9b `n_kv_heads=4` over all layers.

**Per-token KV cost (the rate that matters):**

| Model | KV layers | n_kv_heads | bytes/elem | **KiB / token** |
|---|---|---|---|---|
| `qwen3-coder-next` | 12 | 2 | 1.0625 (q8) | **12.75** |
| `qwen3.6-27b` | 65 | 4 | 1.0625 (q8) | **138.1** |
| `qwen3.5-9b` | 33 | 4 | 1.0625 (q8) | **70.1** |

---

## 4. KV cache vs context length (GiB) — scaling table

| Model | 8k | 16k | 32k | 64k | 128k | 256k (trained max) |
|---|---|---|---|---|---|---|
| `qwen3-coder-next` | 0.10 | 0.20 | 0.40 | 0.80 | **1.59** | 3.19 |
| `qwen3.6-27b` | 1.08 | 2.16 | **4.32** | 8.63 | 17.27 | 34.53 |
| `qwen3.5-9b` | 0.55 | 1.10 | **2.19** | 4.38 | 8.77 | 17.53 |

(**bold** = currently configured.) All three now run **q8_0 KV** (≈ half the f16 cost). At f16 the 27b/9b rows would be ~2× the values shown.

---

## 5. Constraints & headroom

### Memory budget (the hard limit)
- Unified pool: **~122 GiB usable**, shared by GPU, CPU, and *every* container.
- All 3 models resident: **81.4 GiB weights + 8.1 GiB KV (at set ctx) ≈ 89.5 GiB**.
- Remaining ~33 GiB must cover: per-server **compute buffers**, the **prompt cache** (each llama server: `--cache-ram` default **8 GiB** CPU-side, for slot/checkpoint reuse), and the rest of the stack — LibreChat + MongoDB + pgvector + rag_api, LiteLLM, mcp-proxy, and ComfyUI/ai-dev when running.
- **Observed at report time: 118 GiB used / ~4 GiB free** → the box is effectively full with everything up.

### Token-usage constraints
- Max tokens per request (prompt + generation) = the `--ctx-size`: **131 072 / 32 768 / 16 384**.
- `kv_unified=true`: concurrent requests **share** that window across the 4 slots — heavy parallelism eats into per-request context.
- `--keep`, `--ctx-checkpoints`, `--cache-reuse` (set on the Coder) let it reuse prefixes instead of reprocessing.

### KV-cache headroom — how far each model can grow
| Model | KV now | KV at 128k | Headroom note |
|---|---|---|---|
| Coder | 1.6 GiB | 1.6 GiB (already 128k) | Cheap — could reach 256k for ~3.2 GiB |
| 27b | 4.3 GiB | 17.3 GiB | **KV hog** (138 KiB/tok); 128k would need +13 GiB |
| 9b | 2.2 GiB | 8.8 GiB | now q8_0 KV @ 32k (~70 KiB/tok); was f16 @ 16k (2.06 GiB) |

### Bandwidth constraint (performance, not capacity)
- Token generation is **memory-bandwidth bound** (~200 GB/s effective). KV cache is read every token but model weights dominate; q8_0 KV also trims KV bandwidth slightly. See the separate perf notes.

---

## 6. Recommendations
1. **Don't run all three at full context simultaneously** — at 89 GiB resident there's little room. The Coder is already on-demand (`restart: "no"`); keep it that way.
2. **Raise the 27b context cheaply by halving KV** — it's already q8_0; going to 64k = 8.6 GiB KV, to 128k = 17.3 GiB (only if memory frees up).
3. ~~9b uses f16 KV~~ — **done (2026-06-19):** 9b now runs `q8_0` KV + `--flash-attn auto`, window doubled to **32k** for ~2.19 GiB (was f16 16k @ 2.06 GiB) — i.e. 2× context at the same memory.
4. **The Coder has the most context headroom** — hybrid+MoE+q8 makes 256k cost only ~3.2 GiB if you ever need it.
