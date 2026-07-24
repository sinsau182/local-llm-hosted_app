import type {
  AddDocRequest,
  AddDocResponse,
  ArtifactListResponse,
  ChatRequest,
  ChatResponse,
  EmbedRequest,
  EmbedResponse,
  JobStatusResponse,
  LoginRequest,
  MediaRequest,
  MediaSubmitResponse,
  ModelsResponse,
  QueueResponse,
  QuotaResponse,
  SearchRequest,
  SearchResponse,
  SpeechRequest,
  TokenResponse,
  TranscriptionResponse,
  UserProfileResponse,
  VramResponse,
} from "@/lib/types/api";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://breachlabz-nucbox-evo-x2.tail040b45.ts.net";

type RequestOptions = RequestInit & {
  xUserEmail?: string;
  xUserId?: string;
};

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function readErrorMessage(response: Response): Promise<string | null> {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    try {
      const payload = (await response.json()) as Record<string, unknown>;
      const detail = payload.detail ?? payload.message ?? payload.error;

      if (typeof detail === "string" && detail.trim()) {
        return detail.trim();
      }
    } catch {
      return null;
    }
  }

  try {
    const text = await response.text();
    return text.trim() ? text.trim() : null;
  } catch {
    return null;
  }
}

async function request<T>(path: string, init?: RequestOptions): Promise<T> {
  const headers = new Headers({
    "Content-Type": "application/json",
    ...(init?.headers ?? {}),
  });

  if (init?.xUserEmail) {
    headers.set("x-user-email", init.xUserEmail);
  }

  if (init?.xUserId) {
    headers.set("x-user-id", init.xUserId);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    const errorMessage = await readErrorMessage(response);
    const statusLabel = response.statusText ? `${response.status} ${response.statusText}` : `${response.status}`;
    throw new ApiError(
      response.status,
      errorMessage ? `API request failed (${statusLabel}): ${errorMessage}` : `API request failed (${statusLabel})`,
    );
  }

  return (await response.json()) as T;
}

export const apiClient = {
  login(payload: LoginRequest): Promise<TokenResponse> {
    return request<TokenResponse>("/backend/v1/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  getVram(): Promise<VramResponse> {
    return request<VramResponse>("/backend/v1/sys/vram");
  },
  getQueue(): Promise<QueueResponse> {
    return request<QueueResponse>("/backend/v1/sys/queue");
  },
  me(email: string): Promise<UserProfileResponse> {
    return request<UserProfileResponse>("/backend/v1/auth/me", { xUserEmail: email });
  },
  chat(payload: ChatRequest): Promise<ChatResponse> {
    return request<ChatResponse>("/backend/v1/inference/chat", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  submitMedia(payload: MediaRequest): Promise<MediaSubmitResponse> {
    return request<MediaSubmitResponse>("/backend/v1/inference/media", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  getJob(jobId: string): Promise<JobStatusResponse> {
    return request<JobStatusResponse>(`/backend/v1/inference/jobs/${jobId}`);
  },
  // Best-effort cancel that survives page unload — sendBeacon queues the POST in
  // the browser so an abandoned generation is dropped instead of clogging the
  // serial queue. Returns false if beacons aren't available (caller can ignore).
  cancelJobBeacon(jobId: string): boolean {
    if (typeof navigator === "undefined" || typeof navigator.sendBeacon !== "function") {
      return false;
    }
    return navigator.sendBeacon(`${API_BASE_URL}/backend/v1/inference/jobs/${jobId}/cancel`);
  },
  getModels(): Promise<ModelsResponse> {
    return request<ModelsResponse>("/backend/v1/inference/models");
  },
  // Kokoro TTS — returns the raw audio as a Blob (the backend streams bytes,
  // not JSON), so this bypasses the JSON `request` helper.
  async synthesizeSpeech(payload: SpeechRequest): Promise<Blob> {
    const response = await fetch(`${API_BASE_URL}/backend/v1/inference/audio/speech`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    if (!response.ok) {
      const errorMessage = await readErrorMessage(response);
      throw new ApiError(response.status, errorMessage ?? `Speech synthesis failed (${response.status})`);
    }
    return response.blob();
  },
  // Whisper STT — multipart upload of an audio file. FormData sets its own
  // Content-Type boundary, so this also bypasses the JSON `request` helper.
  async transcribe(file: Blob, options?: { filename?: string; model?: string; language?: string }): Promise<TranscriptionResponse> {
    const form = new FormData();
    form.append("file", file, options?.filename ?? "recording.webm");
    if (options?.model) form.append("model", options.model);
    if (options?.language) form.append("language", options.language);
    const response = await fetch(`${API_BASE_URL}/backend/v1/inference/audio/transcriptions`, {
      method: "POST",
      body: form,
      cache: "no-store",
    });
    if (!response.ok) {
      const errorMessage = await readErrorMessage(response);
      throw new ApiError(response.status, errorMessage ?? `Transcription failed (${response.status})`);
    }
    return (await response.json()) as TranscriptionResponse;
  },
  embed(payload: EmbedRequest): Promise<EmbedResponse> {
    return request<EmbedResponse>("/backend/v1/inference/embed", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  addDocument(payload: AddDocRequest): Promise<AddDocResponse> {
    return request<AddDocResponse>("/backend/v1/search/add", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  search(payload: SearchRequest): Promise<SearchResponse> {
    return request<SearchResponse>("/backend/v1/search/query", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  getQuota(userId: string): Promise<QuotaResponse> {
    return request<QuotaResponse>("/backend/v1/storage/quota", { xUserId: userId });
  },
  getFiles(userId: string): Promise<ArtifactListResponse> {
    return request<ArtifactListResponse>("/backend/v1/storage/files", { xUserId: userId });
  },
  deleteFile(userId: string, artifactId: string): Promise<void> {
    return request<void>(`/backend/v1/storage/files/${artifactId}`, {
      method: "DELETE",
      xUserId: userId,
    });
  },
};
