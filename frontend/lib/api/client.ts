import type {
  LoginRequest,
  QueueResponse,
  TokenResponse,
  VramResponse,
} from "@/lib/types/api";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
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
};
