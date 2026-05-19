"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api/client";

export default function InferencePage() {
  const [models, setModels] = useState<Array<{ name: string; precision: string; vram_gb: number }>>([]);
  const [prompt, setPrompt] = useState("Describe the latest uploaded image in a concise product brief.");
  const [chatOutput, setChatOutput] = useState<string>("");
  const [jobId, setJobId] = useState("");
  const [jobStatus, setJobStatus] = useState("");
  const [mediaType, setMediaType] = useState<"image" | "video">("image");
  const [mediaPrompt, setMediaPrompt] = useState("Generate a cinematic product hero image with teal lighting.");
  const [model, setModel] = useState("qwen2.5-coder:14b");
  const [mediaJob, setMediaJob] = useState("");

  useEffect(() => {
    void apiClient.getModels().then((response) => setModels(response.models));
  }, []);

  async function submitChat() {
    const response = await apiClient.chat({ prompt, model, max_tokens: 256 });
    setChatOutput(response.output);
  }

  async function submitMedia() {
    const response = await apiClient.submitMedia({ prompt: mediaPrompt, media_type: mediaType, model });
    setMediaJob(response.job_id);
  }

  async function loadJob() {
    const response = await apiClient.getJob(jobId);
    setJobStatus(response.status);
  }

  return (
    <section className="space-y-8">
      <div className="space-y-3">
        <p className="text-xs uppercase tracking-[0.18em] text-ink/50">Inference</p>
        <h1 className="font-display text-4xl font-semibold">Chat, media, and model routing</h1>
        <p className="max-w-3xl text-sm text-ink/70 md:text-base">
          This page maps directly to the architecture endpoints for chat, media generation, jobs, and model inventory.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-3xl border border-ink/10 bg-white/80 p-6 shadow-sm">
          <h2 className="font-display text-2xl font-semibold">Chat endpoint</h2>
          <div className="mt-4 space-y-3">
            <label className="block text-sm">
              <span className="mb-1 block text-ink/70">Prompt</span>
              <textarea className="min-h-32 w-full rounded-xl border border-ink/20 px-3 py-2" value={prompt} onChange={(event) => setPrompt(event.target.value)} />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-ink/70">Model</span>
              <input className="w-full rounded-xl border border-ink/20 px-3 py-2" value={model} onChange={(event) => setModel(event.target.value)} />
            </label>
            <Button type="button" onClick={() => void submitChat()}>Run chat</Button>
            {chatOutput ? <p className="rounded-2xl border border-ink/10 bg-sand/60 p-4 text-sm text-ink/80">{chatOutput}</p> : null}
          </div>
        </article>

        <article className="rounded-3xl border border-ink/10 bg-white/80 p-6 shadow-sm">
          <h2 className="font-display text-2xl font-semibold">Media submit</h2>
          <div className="mt-4 space-y-3 text-sm">
            <label className="block">
              <span className="mb-1 block text-ink/70">Media type</span>
              <select className="w-full rounded-xl border border-ink/20 px-3 py-2" value={mediaType} onChange={(event) => setMediaType(event.target.value as "image" | "video") }>
                <option value="image">Image</option>
                <option value="video">Video</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-ink/70">Prompt</span>
              <textarea className="min-h-32 w-full rounded-xl border border-ink/20 px-3 py-2" value={mediaPrompt} onChange={(event) => setMediaPrompt(event.target.value)} />
            </label>
            <Button type="button" onClick={() => void submitMedia()}>Submit media job</Button>
            {mediaJob ? <p className="rounded-2xl border border-ink/10 bg-sand/60 p-4 text-sm text-ink/80">Job queued: {mediaJob}</p> : null}
          </div>
        </article>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-3xl border border-ink/10 bg-white/80 p-6 shadow-sm">
          <h2 className="font-display text-2xl font-semibold">Job status</h2>
          <div className="mt-4 space-y-3">
            <input className="w-full rounded-xl border border-ink/20 px-3 py-2" placeholder="job id" value={jobId} onChange={(event) => setJobId(event.target.value)} />
            <Button type="button" onClick={() => void loadJob()}>Check job</Button>
            {jobStatus ? <p className="rounded-2xl border border-ink/10 bg-sand/60 p-4 text-sm text-ink/80">Status: {jobStatus}</p> : null}
          </div>
        </article>

        <article className="rounded-3xl border border-ink/10 bg-white/80 p-6 shadow-sm">
          <h2 className="font-display text-2xl font-semibold">Available models</h2>
          <div className="mt-4 grid gap-3">
            {models.map((entry) => (
              <div key={entry.name} className="rounded-2xl border border-ink/10 bg-sand/60 p-4 text-sm">
                <p className="font-medium">{entry.name}</p>
                <p className="text-ink/70">Precision: {entry.precision}</p>
                <p className="text-ink/70">VRAM: {entry.vram_gb.toFixed(1)} GB</p>
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}