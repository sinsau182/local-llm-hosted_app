"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api/client";
import { useSessionStore } from "@/lib/store/session";

export default function StoragePage() {
  const email = useSessionStore((state) => state.email) ?? "user@example.com";
  const userId = useSessionStore((state) => state.userId) ?? "00000000-0000-0000-0000-000000000001";
  const [quota, setQuota] = useState<{ storage_quota_bytes: number; storage_used_bytes: number; storage_available_bytes: number } | null>(null);
  const [files, setFiles] = useState<Array<{ id: string; media_type: string; file_path: string; size_bytes: number }>>([]);

  useEffect(() => {
    void Promise.all([apiClient.getQuota(userId), apiClient.getFiles(userId)]).then(([quotaResponse, filesResponse]) => {
      setQuota(quotaResponse);
      setFiles(filesResponse.items);
    });
  }, [userId]);

  async function deleteArtifact(id: string) {
    await apiClient.deleteFile(userId, id);
    const response = await apiClient.getFiles(userId);
    setFiles(response.items);
  }

  return (
    <section className="space-y-8">
      <div className="space-y-3">
        <p className="text-xs uppercase tracking-[0.18em] text-ink/50">Storage</p>
        <h1 className="font-display text-4xl font-semibold">Quota and artifact inventory</h1>
        <p className="max-w-3xl text-sm text-ink/70 md:text-base">
          Storage is scoped to the active user and the media path layout defined in the architecture summary.
        </p>
      </div>

      <article className="rounded-3xl border border-ink/10 bg-white/80 p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-ink/10 bg-sand/60 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-ink/50">User</p>
            <p className="mt-2 font-medium">{email}</p>
            <p className="text-sm text-ink/70">{userId}</p>
          </div>
          <div className="rounded-2xl border border-ink/10 bg-sand/60 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-ink/50">Quota</p>
            <p className="mt-2 font-medium">{quota ? `${(quota.storage_quota_bytes / 1024 / 1024 / 1024).toFixed(1)} GB` : "-"}</p>
          </div>
          <div className="rounded-2xl border border-ink/10 bg-sand/60 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-ink/50">Available</p>
            <p className="mt-2 font-medium">{quota ? `${(quota.storage_available_bytes / 1024 / 1024 / 1024).toFixed(1)} GB` : "-"}</p>
          </div>
        </div>
      </article>

      <article className="rounded-3xl border border-ink/10 bg-white/80 p-6 shadow-sm">
        <h2 className="font-display text-2xl font-semibold">Artifacts</h2>
        <div className="mt-4 grid gap-3">
          {files.map((file) => (
            <div key={file.id} className="flex flex-col gap-3 rounded-2xl border border-ink/10 bg-sand/60 p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-medium">{file.id}</p>
                <p className="text-sm text-ink/70">{file.media_type} · {file.file_path}</p>
                <p className="text-sm text-ink/60">{(file.size_bytes / 1024 / 1024).toFixed(2)} MB</p>
              </div>
              <Button type="button" onClick={() => void deleteArtifact(file.id)}>Delete</Button>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}