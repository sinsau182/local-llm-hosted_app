"use client";

import { useEffect, useState } from "react";

import { MetricCard } from "@/components/dashboard/metric-card";
import { apiClient } from "@/lib/api/client";

export default function SystemPage() {
  const [vram, setVram] = useState<{ vram_total_gb: number; vram_used_gb: number; temperature_c: number; bandwidth_utilization_percent: number } | null>(null);
  const [queue, setQueue] = useState<{ global_queue_depth: number; active_ollama_workers: number; active_comfyui_workers: number } | null>(null);

  useEffect(() => {
    void Promise.all([apiClient.getVram(), apiClient.getQueue()]).then(([vramResponse, queueResponse]) => {
      setVram(vramResponse);
      setQueue(queueResponse);
    });
  }, []);

  return (
    <section className="space-y-8">
      <div className="space-y-3">
        <p className="text-xs uppercase tracking-[0.18em] text-ink/50">System</p>
        <h1 className="font-display text-4xl font-semibold">Telemetry and worker status</h1>
        <p className="max-w-3xl text-sm text-ink/70 md:text-base">
          Real system data is currently backed by the scaffold services, but the page wiring is ready for the ROCm and queue adapters.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="VRAM Used" value={vram === null ? "-" : `${vram.vram_used_gb.toFixed(1)} GB`} hint="Current allocation" />
        <MetricCard title="VRAM Total" value={vram === null ? "-" : `${vram.vram_total_gb.toFixed(1)} GB`} hint="Addressable pool" />
        <MetricCard title="Temperature" value={vram === null ? "-" : `${vram.temperature_c.toFixed(1)}°C`} hint="Thermal reading" />
        <MetricCard title="Bandwidth" value={vram === null ? "-" : `${vram.bandwidth_utilization_percent.toFixed(1)}%`} hint="Memory traffic" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-3xl border border-ink/10 bg-white/80 p-6 shadow-sm">
          <h2 className="font-display text-2xl font-semibold">Queue status</h2>
          <div className="mt-4 grid gap-3 text-sm text-ink/75">
            <div className="rounded-2xl border border-ink/10 bg-sand/60 p-4">Global queue depth: {queue?.global_queue_depth ?? "-"}</div>
            <div className="rounded-2xl border border-ink/10 bg-sand/60 p-4">Ollama workers: {queue?.active_ollama_workers ?? "-"}</div>
            <div className="rounded-2xl border border-ink/10 bg-sand/60 p-4">ComfyUI workers: {queue?.active_comfyui_workers ?? "-"}</div>
          </div>
        </article>

        <article className="rounded-3xl border border-ink/10 bg-white/80 p-6 shadow-sm">
          <h2 className="font-display text-2xl font-semibold">Execution notes</h2>
          <ul className="mt-4 space-y-2 text-sm text-ink/75">
            <li>• VRAM and queue endpoints are isolated behind the API gateway.</li>
            <li>• Worker counts will become meaningful once the background queue is connected.</li>
            <li>• This page is the dashboard-facing landing spot for telemetry adapters.</li>
          </ul>
        </article>
      </div>
    </section>
  );
}