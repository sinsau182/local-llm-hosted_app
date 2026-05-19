import type {
  ArtifactListResponse,
  ChatRequest,
  ChatResponse,
  JobStatusResponse,
  LoginRequest,
  MediaRequest,
  MediaSubmitResponse,
  ModelsResponse,
  QueueResponse,
  QuotaResponse,
  TokenResponse,
  UserProfileResponse,
  VramResponse,
} from "@/lib/types/api";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

type RequestOptions = RequestInit & {
  xUserEmail?: string;
  xUserId?: string;
};

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
    throw new Error(`API request failed (${response.status})`);
  }

  return (await response.json()) as T;
}

export const apiClient = {
  login(payload: LoginRequest): Promise<TokenResponse> {
    return request<TokenResponse>("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  getVram(): Promise<VramResponse> {
    return request<VramResponse>("/api/v1/sys/vram");
  },
  getQueue(): Promise<QueueResponse> {
    return request<QueueResponse>("/api/v1/sys/queue");
  },
  me(email: string): Promise<UserProfileResponse> {
    return request<UserProfileResponse>("/api/v1/auth/me", { xUserEmail: email });
  },
  chat(payload: ChatRequest): Promise<ChatResponse> {
    return request<ChatResponse>("/api/v1/inference/chat", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  submitMedia(payload: MediaRequest): Promise<MediaSubmitResponse> {
    return request<MediaSubmitResponse>("/api/v1/inference/media", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  getJob(jobId: string): Promise<JobStatusResponse> {
    return request<JobStatusResponse>(`/api/v1/inference/jobs/${jobId}`);
  },
  getModels(): Promise<ModelsResponse> {
    return request<ModelsResponse>("/api/v1/inference/models");
  },
  getQuota(userId: string): Promise<QuotaResponse> {
    return request<QuotaResponse>("/api/v1/storage/quota", { xUserId: userId });
  },
  getFiles(userId: string): Promise<ArtifactListResponse> {
    return request<ArtifactListResponse>("/api/v1/storage/files", { xUserId: userId });
  },
  deleteFile(userId: string, artifactId: string): Promise<void> {
    return request<void>(`/api/v1/storage/files/${artifactId}`, {
      method: "DELETE",
      xUserId: userId,
    });
  },
};
