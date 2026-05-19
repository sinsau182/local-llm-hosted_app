import { create } from "zustand";

type SessionState = {
  accessToken: string | null;
  refreshToken: string | null;
  email: string | null;
  userId: string | null;
  setTokens: (accessToken: string, refreshToken: string) => void;
  setProfile: (profile: { email: string; userId?: string }) => void;
  clear: () => void;
};

export const useSessionStore = create<SessionState>((set) => ({
  accessToken: null,
  refreshToken: null,
  email: null,
  userId: null,
  setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),
  setProfile: ({ email, userId }) => set({ email, userId: userId ?? null }),
  clear: () => set({ accessToken: null, refreshToken: null, email: null, userId: null }),
}));
