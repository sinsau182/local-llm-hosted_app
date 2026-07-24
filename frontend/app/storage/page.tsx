"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { ComfyUIBox } from "@/components/comfyui-box";
import { apiClient } from "@/lib/api/client";
import type { Artifact } from "@/lib/types/api";
import { useSessionStore } from "@/lib/store/session";

// Same base the API client uses; content URLs from the API are relative paths.
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://breachlabz-nucbox-evo-x2.tail040b45.ts.net";
const assetUrl = (file: Artifact) => (file.url ? `${API_BASE_URL}${file.url}` : "");

export default function StoragePage() {
  const email = useSessionStore((state) => state.email) ?? "user@example.com";
  const userId = useSessionStore((state) => state.userId) ?? "00000000-0000-0000-0000-000000000001";
  const [quota, setQuota] = useState<{ storage_quota_bytes: number; storage_used_bytes: number; storage_available_bytes: number } | null>(null);
  const [files, setFiles] = useState<Artifact[]>([]);

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
      <ComfyUIBox />
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
        {files.length === 0 ? (
          <p className="mt-4 text-sm text-ink/60">
            No creations yet. Use the “Create with ComfyUI” box above to generate images or videos.
          </p>
        ) : null}
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {files.map((file) => (
            <div key={file.id} className="flex flex-col gap-3 rounded-2xl border border-ink/10 bg-sand/60 p-3">
              <a href={assetUrl(file)} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl bg-ink/5">
                {file.media_type === "video" ? (
                  <video src={assetUrl(file)} controls muted className="aspect-square w-full object-cover" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={assetUrl(file)} alt={file.file_path} className="aspect-square w-full object-cover" />
                )}
              </a>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{file.file_path.split("/").pop()}</p>
                  <p className="text-xs text-ink/60">{file.media_type} · {(file.size_bytes / 1024 / 1024).toFixed(2)} MB</p>
                </div>
                <Button type="button" onClick={() => void deleteArtifact(file.id)}>Delete</Button>
              </div>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}