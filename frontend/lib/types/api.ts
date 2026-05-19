export type LoginRequest = {
  email: string;
  password: string;
};

export type TokenResponse = {
  access_token: string;
  refresh_token: string;
  token_type: string;
};

export type VramResponse = {
  vram_total_gb: number;
  vram_used_gb: number;
  temperature_c: number;
  bandwidth_utilization_percent: number;
};

export type QueueResponse = {
  global_queue_depth: number;
  active_ollama_workers: number;
  active_comfyui_workers: number;
};
