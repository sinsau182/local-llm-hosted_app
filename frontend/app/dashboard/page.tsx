"use client";

import { useEffect, useState } from "react";

import { MetricCard } from "@/components/dashboard/metric-card";
import { apiClient } from "@/lib/api/client";

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
    <section className="space-y-6">
      <h1 className="font-display text-4xl font-semibold">Operations Dashboard</h1>
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard title="Queue Depth" value={queue === null ? "-" : String(queue)} hint="Global inference queue" />
        <MetricCard title="VRAM Used" value={vramUsed === null ? "-" : `${vramUsed.toFixed(1)} GB`} hint="Current LPDDR allocation" />
        <MetricCard title="VRAM Total" value={vramTotal === null ? "-" : `${vramTotal.toFixed(1)} GB`} hint="iGPU addressable pool" />
      </div>
    </section>
  );
}
