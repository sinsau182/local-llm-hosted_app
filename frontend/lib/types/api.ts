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

export type UserProfileResponse = {
  user_id: string;
  email: string;
  full_name: string;
  role: string;
  storage_quota_bytes: number;
  storage_used_bytes: number;
};

export type ModelInfo = {
  name: string;
  precision: string;
  vram_gb: number;
};

export type ModelsResponse = {
  models: ModelInfo[];
};

export type ChatHistoryMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type ChatRequest = {
  prompt: string;
  model?: string;
  max_tokens?: number;
  messages?: ChatHistoryMessage[];
};

export type ChatResponse = {
  request_id: string;
  output: string;
  routed_model: string;
};

export type MediaRequest = {
  prompt: string;
  media_type?: "image" | "video";
  model?: string;
  width?: number;
  height?: number;
  steps?: number;
  seed?: number;
  num_frames?: number;
  fps?: number;
};

export type MediaSubmitResponse = {
  job_id: string;
  status: string;
  position?: number;
  eta_seconds?: number;
};

export type JobStatusResponse = {
  job_id: string;
  status: string;
  media_type?: string;
  prompt?: string;
  image?: string | null;
  video?: string | null;
  error?: string | null;
  position?: number;
  eta_seconds?: number;
};

export type Artifact = {
  id: string;
  media_type: string;
  file_path: string;
  size_bytes: number;
  /** API path that streams the object from the media bucket. */
  url?: string | null;
  created_at?: string | null;
};

export type ArtifactListResponse = {
  items: Artifact[];
};

export type SpeechFormat = "mp3" | "wav" | "opus" | "flac" | "aac" | "pcm";

export type SpeechRequest = {
  input: string;
  voice?: string;
  model?: string;
  response_format?: SpeechFormat | "";
  speed?: number;
};

export type TranscriptionResponse = {
  text: string;
  model?: string;
  language?: string | null;
  duration?: number | null;
};

export type EmbedRequest = {
  input: string | string[];
};

export type EmbedResponse = {
  embeddings: number[][];
  model: string;
  dimensions: number;
};

export type AddDocRequest = {
  text: string;
  metadata?: Record<string, string>;
  doc_id?: string;
};

export type AddDocResponse = {
  doc_id: string;
  dimensions: number;
};

export type SearchRequest = {
  query: string;
  n_results?: number;
};

export type SearchResult = {
  doc_id: string;
  text: string;
  metadata: Record<string, string>;
  distance: number;
};

export type SearchResponse = {
  results: SearchResult[];
  query: string;
};

export type QuotaResponse = {
  storage_quota_bytes: number;
  storage_used_bytes: number;
  storage_available_bytes: number;
};
