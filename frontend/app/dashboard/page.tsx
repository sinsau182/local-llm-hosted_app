"use client";

import { useEffect, useState } from "react";

import { MetricCard } from "@/components/dashboard/metric-card";
import { apiClient } from "@/lib/api/client";
import Link from "next/link";

const endpointGroups = [
  {
    title: "Auth",
    endpoints: ["POST /api/v1/auth/login", "POST /api/v1/auth/refresh", "GET /api/v1/auth/me"],
  },
  {
    title: "Inference",
    endpoints: ["POST /api/v1/inference/chat", "POST /api/v1/inference/media", "GET /api/v1/inference/jobs/{id}", "GET /api/v1/inference/models"],
  },
  {
    title: "Storage",
    endpoints: ["GET /api/v1/storage/quota", "GET /api/v1/storage/files", "DELETE /api/v1/storage/files/{id}"],
  },
  {
    title: "System",
    endpoints: ["GET /api/v1/sys/vram", "GET /api/v1/sys/queue"],
  },
];

const architectureLayers = [
  {
    title: "UI",
    description: "Next.js dashboard with session state and typed API access.",
  },
  {
    title: "API",
    description: "FastAPI gateway for auth, inference, storage, and system telemetry.",
  },
  {
    title: "Data",
    description: "PostgreSQL + pgvector and Redis for jobs, cache, and metadata.",
  },
  {
    title: "Runtime",
    description: "Ollama, ComfyUI, and media worker adapters for local inference.",
  },
];

export default function DashboardPage() {
  const [queue, setQueue] = useState<number | null>(null);
  const [vramUsed, setVramUsed] = useState<number | null>(null);
  const [vramTotal, setVramTotal] = useState<number | null>(null);

  useEffect(() => {
    async function load() {
      const [vram, queueStats] = await Promise.all([apiClient.getVram(), apiClient.getQueue()]);
      setVramUsed(vram.vram_used_gb);
      setVramTotal(vram.vram_total_gb);
      setQueue(queueStats.global_queue_depth);
    }
    void load();
  }, []);

  return (
    <section className="space-y-8">
      <div className="flex flex-col gap-3">
        <p className="text-xs uppercase tracking-[0.18em] text-ink/50">Operations dashboard</p>
        <h1 className="font-display text-4xl font-semibold">Runtime control center</h1>
        <p className="max-w-3xl text-sm text-ink/70 md:text-base">
          This view now mirrors the system architecture summary: telemetry, endpoint coverage, storage pathing,
          and the major platform layers in one place.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard title="Queue Depth" value={queue === null ? "-" : String(queue)} hint="Global inference queue" />
        <MetricCard title="VRAM Used" value={vramUsed === null ? "-" : `${vramUsed.toFixed(1)} GB`} hint="Current LPDDR allocation" />
        <MetricCard title="VRAM Total" value={vramTotal === null ? "-" : `${vramTotal.toFixed(1)} GB`} hint="iGPU addressable pool" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <article className="rounded-3xl border border-ink/10 bg-white/80 p-6 shadow-sm">
          <h2 className="font-display text-2xl font-semibold">Platform layers</h2>
          <div className="mt-4 grid gap-3">
            {architectureLayers.map((layer) => (
              <div key={layer.title} className="rounded-2xl border border-ink/10 bg-sand/60 p-4">
                <p className="font-medium">{layer.title}</p>
                <p className="mt-1 text-sm text-ink/70">{layer.description}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-3xl border border-ink/10 bg-white/80 p-6 shadow-sm">
          <h2 className="font-display text-2xl font-semibold">Endpoint scaffold</h2>
          <div className="mt-4 grid gap-4 text-sm text-ink/75">
            {endpointGroups.map((group) => (
              <div key={group.title} className="rounded-2xl border border-ink/10 bg-sand/60 p-4">
                <p className="font-medium text-ink">{group.title}</p>
                <ul className="mt-2 space-y-1">
                  {group.endpoints.map((endpoint) => (
                    <li key={endpoint}>{endpoint}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </article>
      </div>

      <article className="rounded-3xl border border-ink/10 bg-white/80 p-6 shadow-sm">
        <h2 className="font-display text-2xl font-semibold">Storage layout</h2>
        <p className="mt-3 max-w-4xl text-sm text-ink/70 md:text-base">
          Media jobs are expected under /data/media/{`{user_id}`}/{`{date}`}/{`{job_uuid}`}, with quota-aware controls and async job execution.
        </p>
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <Link href="/inference" className="rounded-xl border border-ink/20 bg-white px-4 py-2">Open inference</Link>
          <Link href="/storage" className="rounded-xl border border-ink/20 bg-white px-4 py-2">Open storage</Link>
          <Link href="/system" className="rounded-xl border border-ink/20 bg-white px-4 py-2">Open system</Link>
        </div>
      </article>
    </section>
  );
}
