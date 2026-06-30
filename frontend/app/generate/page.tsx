"use client";

import { useRef, useState } from "react";
import { apiClient, ApiError } from "@/lib/api/client";

type Size = { label: string; width: number; height: number };
type Mode = "image" | "video";

const IMAGE_SIZES: Size[] = [
  { label: "Square · 1024", width: 1024, height: 1024 },
  { label: "Portrait · 832×1216", width: 832, height: 1216 },
  { label: "Landscape · 1216×832", width: 1216, height: 832 },
];

// LTX-Video runs best at smaller, 32-aligned resolutions.
const VIDEO_SIZES: Size[] = [
  { label: "Landscape · 768×512", width: 768, height: 512 },
  { label: "Square · 640×640", width: 640, height: 640 },
  { label: "Portrait · 512×768", width: 512, height: 768 },
];

const POLL_MS = 1500;
const MAX_POLLS = 320; // ~8 min ceiling (video is slower than image)

// Friendly "you're in line" text from the server's queue position + ETA.
function queueText(position?: number, eta?: number): string {
  if (!position || position <= 1) {
    return eta ? `Starting now — ~${eta}s` : "Starting now…";
  }
  const wait = eta ? ` ~${eta < 60 ? `${eta}s` : `${Math.round(eta / 60)} min`}` : "";
  return `Queued — position ${position}.${wait}`;
}

export default function GeneratePage() {
  const [mode, setMode] = useState<Mode>("image");
  const [prompt, setPrompt] = useState("");
  const [size, setSize] = useState<Size>(IMAGE_SIZES[0]);
  const [steps, setSteps] = useState(4);
  const [status, setStatus] = useState<"idle" | "working" | "done" | "error">("idle");
  const [statusText, setStatusText] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [video, setVideo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sizes = mode === "video" ? VIDEO_SIZES : IMAGE_SIZES;

  function reset() {
    if (pollRef.current) clearTimeout(pollRef.current);
    pollRef.current = null;
  }

  function switchMode(next: Mode) {
    if (next === mode) return;
    reset();
    setMode(next);
    setSize(next === "video" ? VIDEO_SIZES[0] : IMAGE_SIZES[0]);
    setSteps(next === "video" ? 8 : 4);
    setStatus("idle");
    setStatusText("");
    setImage(null);
    setVideo(null);
    setError(null);
  }

  async function poll(jobId: string, attempt: number) {
    if (attempt > MAX_POLLS) {
      setStatus("error");
      setError(`Timed out waiting for the ${mode}.`);
      return;
    }
    try {
      const job = await apiClient.getJob(jobId);
      if (job.status === "COMPLETED" && (job.video || job.image)) {
        if (job.video) setVideo(job.video);
        if (job.image) setImage(job.image);
        setStatus("done");
        setStatusText("");
        return;
      }
      if (job.status === "FAILED" || job.status === "NOT_FOUND") {
        setStatus("error");
        setError(job.error || `Generation ${job.status.toLowerCase()}.`);
        return;
      }
      if (job.status === "QUEUED") {
        setStatusText(queueText(job.position, job.eta_seconds));
      } else {
        setStatusText(`Generating… (${attempt * (POLL_MS / 1000)}s)`);
      }
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
    setVideo(null);
    setError(null);
    try {
      const res = await apiClient.submitMedia({
        prompt: prompt.trim(),
        media_type: mode,
        width: size.width,
        height: size.height,
        steps,
      });
      if (res.status === "FAILED") {
        setStatus("error");
        setError("Could not start generation — is ComfyUI running with a model loaded?");
        return;
      }
      setStatusText(queueText(res.position, res.eta_seconds));
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
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700">
          ComfyUI · {mode === "video" ? "Wan 2.2 T2V-A14B" : "Flux.1-schnell"}
        </p>
        <h1 className="font-display text-3xl font-semibold text-ink">
          {mode === "video" ? "Video Generation" : "Image Generation"}
        </h1>
        <p className="text-sm text-ink/60">
          Describe a {mode}; it&apos;s rendered locally on your GPU via ComfyUI.
          {mode === "video" && " A short clip takes ~3–5 minutes."}
        </p>
      </div>

      <div className="inline-flex rounded-xl border border-ink/10 bg-white p-1 shadow-sm">
        {(["image", "video"] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => switchMode(m)}
            className={`rounded-lg px-5 py-2 text-sm font-medium capitalize transition ${
              mode === m ? "bg-cyan-600 text-white" : "text-ink/60 hover:text-ink"
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      <div className="space-y-4 rounded-2xl border border-ink/10 bg-white p-5 shadow-sm">
        <textarea
          className="min-h-[110px] w-full resize-y rounded-xl border border-ink/15 p-3 text-sm outline-none focus:border-cyan-600"
          placeholder={
            mode === "video"
              ? "A golden retriever puppy running across a meadow at sunrise, cinematic…"
              : "A photorealistic red fox sitting in a snowy pine forest at golden hour…"
          }
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
              onChange={(e) => setSize(sizes.find((s) => s.label === e.target.value) ?? sizes[0])}
            >
              {sizes.map((s) => (
                <option key={s.label} value={s.label}>{s.label}</option>
              ))}
            </select>
          </label>

          <label className="text-xs text-ink/60">
            <span className="mb-1 block font-medium">Steps: {steps}</span>
            <input
              type="range"
              min={mode === "video" ? 6 : 1}
              max={mode === "video" ? 16 : 8}
              value={steps}
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

      {video && (
        <div className="space-y-3 rounded-2xl border border-ink/10 bg-white p-4 shadow-sm">
          <video
            src={video}
            controls
            autoPlay
            loop
            muted
            className="mx-auto max-h-[70vh] w-auto rounded-xl"
          />
          <div className="flex justify-end">
            <a
              href={video}
              download={`ltx-${Date.now()}.mp4`}
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
