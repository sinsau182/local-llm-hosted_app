class SystemService:
    def get_vram(self) -> dict[str, float]:
        # Placeholder for ROCm-SMI integration.
        return {
            "vram_total_gb": 96.0,
            "vram_used_gb": 24.5,
            "temperature_c": 62.0,
            "bandwidth_utilization_percent": 41.0,
        }

    def get_queue(self) -> dict[str, int]:
        return {
            "global_queue_depth": 0,
            "active_ollama_workers": 1,
            "active_comfyui_workers": 1,
        }
