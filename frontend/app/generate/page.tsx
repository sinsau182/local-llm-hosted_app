"use client";

import { useRef, useState } from "react";
import { apiClient, ApiError } from "@/lib/api/client";

type Size = { label: string; width: number; height: number };

const SIZES: Size[] = [
  { label: "Square · 1024", width: 1024, height: 1024 },
  { label: "Portrait · 832×1216", width: 832, height: 1216 },
  { label: "Landscape · 1216×832", width: 1216, height: 832 },
];

const POLL_MS = 1500;
const MAX_POLLS = 240; // ~6 min ceiling

export default function GeneratePage() {
  const [prompt, setPrompt] = useState("");
  const [size, setSize] = useState<Size>(SIZES[0]);
  const [steps, setSteps] = useState(4);
  const [status, setStatus] = useState<"idle" | "working" | "done" | "error">("idle");
  const [statusText, setStatusText] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function reset() {
    if (pollRef.current) clearTimeout(pollRef.current);
    pollRef.current = null;
  }

  async function poll(jobId: string, attempt: number) {
    if (attempt > MAX_POLLS) {
      setStatus("error");
      setError("Timed out waiting for the image.");
      return;
    }
    try {
      const job = await apiClient.getJob(jobId);
      if (job.status === "COMPLETED" && job.image) {
        setImage(job.image);
        setStatus("done");
        setStatusText("");
        return;
      }
      if (job.status === "FAILED" || job.status === "NOT_FOUND") {
        setStatus("error");
        setError(job.error || `Generation ${job.status.toLowerCase()}.`);
        return;
      }
      setStatusText(`Generating… (${attempt * (POLL_MS / 1000)}s)`);
      pollRef.current = setTimeout(() => poll(jobId, attempt + 1), POLL_MS);
    } catch (err) {
      setStatus("error");
      setError(err instanceof ApiError ? err.message : "Lost contact with the server.");
    }
  }

  async function onGenerate() {
    if (!prompt.trim() || status === "working") return;
    reset();
    setStatus("working");
    setStatusText("Queuing…");
    setImage(null);
    setError(null);
    try {
      const res = await apiClient.submitMedia({
        prompt: prompt.trim(),
        media_type: "image",
        width: size.width,
        height: size.height,
        steps,
      });
      if (res.status === "FAILED") {
        setStatus("error");
        setError("Could not start generation — is ComfyUI running with a model loaded?");
        return;
      }
      poll(res.job_id, 1);
    } catch (err) {
      setStatus("error");
      setError(err instanceof ApiError ? err.message : "Could not submit the request.");
    }
  }

  const working = status === "working";

  return (
    <section className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700">ComfyUI · Flux.1-schnell</p>
        <h1 className="font-display text-3xl font-semibold text-ink">Image Generation</h1>
        <p className="text-sm text-ink/60">Describe an image; it&apos;s rendered locally on your GPU via ComfyUI.</p>
      </div>

      <div className="space-y-4 rounded-2xl border border-ink/10 bg-white p-5 shadow-sm">
        <textarea
          className="min-h-[110px] w-full resize-y rounded-xl border border-ink/15 p-3 text-sm outline-none focus:border-cyan-600"
          placeholder="A photorealistic red fox sitting in a snowy pine forest at golden hour…"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") onGenerate();
          }}
        />

        <div className="flex flex-wrap items-end gap-4">
          <label className="text-xs text-ink/60">
            <span className="mb-1 block font-medium">Size</span>
            <select
              className="rounded-lg border border-ink/15 px-3 py-2 text-sm"
              value={size.label}
              onChange={(e) => setSize(SIZES.find((s) => s.label === e.target.value) ?? SIZES[0])}
            >
              {SIZES.map((s) => (
                <option key={s.label} value={s.label}>{s.label}</option>
              ))}
            </select>
          </label>

          <label className="text-xs text-ink/60">
            <span className="mb-1 block font-medium">Steps: {steps}</span>
            <input
              type="range" min={1} max={8} value={steps}
              onChange={(e) => setSteps(Number(e.target.value))}
              className="w-40 align-middle"
            />
          </label>

          <button
            type="button"
            onClick={onGenerate}
            disabled={working || !prompt.trim()}
            className="ml-auto h-10 rounded-xl bg-cyan-600 px-6 text-sm font-medium text-white transition hover:bg-cyan-700 disabled:opacity-40"
          >
            {working ? "Generating…" : "Generate"}
          </button>
        </div>
      </div>

      {working && (
        <div className="flex items-center gap-3 rounded-2xl border border-ink/10 bg-white p-5 text-sm text-ink/60 shadow-sm">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-cyan-600 border-t-transparent" />
          {statusText || "Working…"}
        </div>
      )}

      {status === "error" && error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      {image && (
        <div className="space-y-3 rounded-2xl border border-ink/10 bg-white p-4 shadow-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image} alt={prompt} className="mx-auto max-h-[70vh] w-auto rounded-xl" />
          <div className="flex justify-end">
            <a
              href={image}
              download={`flux-${Date.now()}.png`}
              className="rounded-lg border border-ink/15 px-4 py-2 text-sm font-medium text-ink/80 hover:border-cyan-600 hover:text-cyan-700"
            >
              Download
            </a>
          </div>
        </div>
      )}
    </section>
  );
}
