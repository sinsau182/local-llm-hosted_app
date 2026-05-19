"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { apiClient } from "@/lib/api/client";
import { useSessionStore } from "@/lib/store/session";

export default function LoginPage() {
  const router = useRouter();
  const setTokens = useSessionStore((state) => state.setTokens);
  const [email, setEmail] = useState("user@example.com");
  const [password, setPassword] = useState("password");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await apiClient.login({ email, password });
    setTokens(response.access_token, response.refresh_token);
    router.push("/dashboard");
  }

  return (
    <section className="mx-auto max-w-md rounded-2xl border border-ink/10 bg-white p-6 shadow-sm">
      <h1 className="mb-4 font-display text-3xl font-semibold">Sign in</h1>
      <form className="space-y-4" onSubmit={onSubmit}>
        <label className="block">
          <span className="mb-1 block text-sm">Email</span>
          <input
            className="w-full rounded-lg border border-ink/20 px-3 py-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm">Password</span>
          <input
            type="password"
            className="w-full rounded-lg border border-ink/20 px-3 py-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <button className="w-full rounded-xl bg-ink px-4 py-2 text-sand" type="submit">
          Continue
        </button>
      </form>
    </section>
  );
}
