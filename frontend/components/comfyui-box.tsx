"use client";

import { appConfig } from "@/config/app-config";
import { useSessionStore } from "@/lib/store/session";

/**
 * The single entry point for image/video creation. The platform's own gen UI
 * was removed in favour of the simplified ComfyUI surface — this card sends the
 * user there, tagging the URL with their id (`?user=<uid>`) so ComfyUI can
 * attribute generated assets back to them for history retrieval.
 */
export function ComfyUIBox({ className = "" }: { className?: string }) {
  const userId = useSessionStore((state) => state.userId);

  const url = new URL(appConfig.comfyuiUrl);
  url.searchParams.set("user", userId ?? "anonymous");

  return (
    <a
      href={url.toString()}
      target="_blank"
      rel="noreferrer"
      className={`group flex items-center justify-between gap-4 rounded-2xl border border-cyan-600/30 bg-gradient-to-br from-cyan-50 to-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-600 hover:shadow-md ${className}`}
    >
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700">Image &amp; video</p>
        <h2 className="font-display text-2xl font-semibold text-ink">Create with ComfyUI</h2>
        <p className="max-w-md text-sm text-ink/60">
          Generate images and videos on your local GPU in a simplified ComfyUI studio.
          Your creations are saved to your library.
        </p>
      </div>
      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-cyan-600 text-2xl text-white transition group-hover:bg-cyan-700">
        ✨
      </span>
    </a>
  );
}
