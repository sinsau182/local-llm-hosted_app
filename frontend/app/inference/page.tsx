"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { ApiError, apiClient } from "@/lib/api/client";
import type { SearchResult } from "@/lib/types/api";

export default function InferencePage() {
  const [models, setModels] = useState<Array<{ name: string; precision: string; vram_gb: number }>>([]);
  const [prompt, setPrompt] = useState("Write a Python function to reverse a linked list.");
  const [chatOutput, setChatOutput] = useState<string>("");
  const [routedModel, setRoutedModel] = useState<string>("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [jobId, setJobId] = useState("");
  const [jobStatus, setJobStatus] = useState("");
  const [mediaType, setMediaType] = useState<"image" | "video">("image");
  const [mediaPrompt, setMediaPrompt] = useState("Generate a cinematic product hero image with teal lighting.");
  const [model, setModel] = useState("");
  const [mediaJob, setMediaJob] = useState("");

  const [docText, setDocText] = useState("");
  const [docMeta, setDocMeta] = useState("");
  const [addedDocId, setAddedDocId] = useState("");
  const [isAddingDoc, setIsAddingDoc] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [apiError, setApiError] = useState("");

  function setFriendlyError(error: unknown) {
    if (error instanceof ApiError) {
      setApiError(error.message);
      return;
    }

    setApiError(error instanceof Error ? error.message : "Unexpected request failure.");
  }

  useEffect(() => {
    void apiClient
      .getModels()
      .then((response) => {
        setModels(response.models);
        setApiError("");
      })
      .catch((error) => {
        setModels([]);
        setFriendlyError(error);
      });
  }, []);

  useEffect(() => {
    if (models.length === 0) {
      return;
    }

    setModel((currentModel) => {
      if (models.some((entry) => entry.name === currentModel)) {
        return currentModel;
      }

      return models[0].name;
    });
  }, [models]);

  async function submitChat() {
    setIsChatLoading(true);
    setRoutedModel("");
    setApiError("");
    try {
      const response = await apiClient.chat({ prompt, model, max_tokens: 2000 });
      setChatOutput(response.output);
      setRoutedModel(response.routed_model);
    } catch (error) {
      setChatOutput("");
      setFriendlyError(error);
    } finally {
      setIsChatLoading(false);
    }
  }

  async function submitMedia() {
    setApiError("");
    try {
      const response = await apiClient.submitMedia({ prompt: mediaPrompt, media_type: mediaType, model });
      setMediaJob(response.job_id);
    } catch (error) {
      setFriendlyError(error);
    }
  }

  async function addDocument() {
    setIsAddingDoc(true);
    setAddedDocId("");
    setApiError("");
    try {
      let metadata: Record<string, string> = {};
      if (docMeta.trim()) {
        try { metadata = JSON.parse(docMeta) as Record<string, string>; } catch { metadata = { note: docMeta }; }
      }
      const response = await apiClient.addDocument({ text: docText, metadata });
      setAddedDocId(response.doc_id);
      setDocText("");
    } catch (error) {
      setFriendlyError(error);
    } finally {
      setIsAddingDoc(false);
    }
  }

  async function runSearch() {
    setIsSearching(true);
    setSearchResults([]);
    setApiError("");
    try {
      const response = await apiClient.search({ query: searchQuery, n_results: 5 });
      setSearchResults(response.results);
    } catch (error) {
      setFriendlyError(error);
    } finally {
      setIsSearching(false);
    }
  }

  async function loadJob() {
    setApiError("");
    try {
      const response = await apiClient.getJob(jobId);
      setJobStatus(response.status);
    } catch (error) {
      setFriendlyError(error);
    }
  }

  return (
    <section className="space-y-8">
      <div className="space-y-3">
        <p className="text-xs uppercase tracking-[0.18em] text-ink/50">Inference</p>
        <h1 className="font-display text-4xl font-semibold">Chat, media, and model routing</h1>
        <p className="max-w-3xl text-sm text-ink/70 md:text-base">
          This page maps directly to the architecture endpoints for chat, media generation, jobs, and model inventory.
        </p>
        {apiError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {apiError}
          </div>
        ) : null}
        <div>
          <a
            href="https://breachlabz-nucbox-evo-x2.tailcf3262.ts.net:4443/"
            target="_blank"
            rel="noreferrer"
            className="inline-flex rounded-xl border border-ink/20 bg-white px-4 py-2 text-sm font-medium text-ink transition hover:bg-sand/70"
          >
            Open in new tab
          </a>
        </div>
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
              <select
                className="w-full rounded-xl border border-ink/20 px-3 py-2"
                value={model}
                disabled={models.length === 0}
                onChange={(event) => setModel(event.target.value)}
              >
                {models.length === 0 ? (
                  <option value="">Loading models...</option>
                ) : (
                  models.map((entry) => (
                    <option key={entry.name} value={entry.name}>
                      {entry.name === "auto" ? "Auto (smart routing)" : entry.name}
                    </option>
                  ))
                )}
              </select>
            </label>
            <Button type="button" disabled={isChatLoading} onClick={() => void submitChat()}>
              {isChatLoading ? "Generating..." : "Run chat"}
            </Button>
            {isChatLoading ? (
              <p className="rounded-2xl border border-ink/10 bg-sand/60 p-4 text-sm text-ink/70">Generating response from the model...</p>
            ) : chatOutput ? (
              <div className="space-y-2">
                {routedModel ? (
                  <p className="text-xs text-ink/50">
                    Routed to: <span className="font-mono font-medium text-ink/70">{routedModel}</span>
                  </p>
                ) : null}
                <p className="rounded-2xl border border-ink/10 bg-sand/60 p-4 text-sm text-ink/80">{chatOutput}</p>
              </div>
            ) : null}
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

      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.18em] text-ink/50">Semantic Search</p>
        <h2 className="font-display text-2xl font-semibold">ChromaDB · qwen3-embedding-8b</h2>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-3xl border border-ink/10 bg-white/80 p-6 shadow-sm">
          <h2 className="font-display text-xl font-semibold">Index a document</h2>
          <div className="mt-4 space-y-3 text-sm">
            <label className="block">
              <span className="mb-1 block text-ink/70">Text</span>
              <textarea
                className="min-h-28 w-full rounded-xl border border-ink/20 px-3 py-2"
                placeholder="Paste any text to index..."
                value={docText}
                onChange={(e) => setDocText(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-ink/70">Metadata (optional JSON or plain note)</span>
              <input
                className="w-full rounded-xl border border-ink/20 px-3 py-2"
                placeholder='{"source": "docs", "topic": "ai"}'
                value={docMeta}
                onChange={(e) => setDocMeta(e.target.value)}
              />
            </label>
            <Button type="button" disabled={isAddingDoc || !docText.trim()} onClick={() => void addDocument()}>
              {isAddingDoc ? "Embedding & indexing..." : "Add to index"}
            </Button>
            {addedDocId ? (
              <p className="rounded-2xl border border-ink/10 bg-sand/60 p-3 text-ink/70">
                Indexed · <span className="font-mono text-xs">{addedDocId}</span>
              </p>
            ) : null}
          </div>
        </article>

        <article className="rounded-3xl border border-ink/10 bg-white/80 p-6 shadow-sm">
          <h2 className="font-display text-xl font-semibold">Semantic search</h2>
          <div className="mt-4 space-y-3 text-sm">
            <label className="block">
              <span className="mb-1 block text-ink/70">Query</span>
              <input
                className="w-full rounded-xl border border-ink/20 px-3 py-2"
                placeholder="What are you looking for?"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void runSearch(); }}
              />
            </label>
            <Button type="button" disabled={isSearching || !searchQuery.trim()} onClick={() => void runSearch()}>
              {isSearching ? "Searching..." : "Search"}
            </Button>
            {searchResults.length > 0 ? (
              <div className="space-y-2">
                {searchResults.map((r) => (
                  <div key={r.doc_id} className="rounded-2xl border border-ink/10 bg-sand/60 p-3">
                    <p className="text-ink/80">{r.text.slice(0, 200)}{r.text.length > 200 ? "…" : ""}</p>
                    <div className="mt-1 flex gap-3 text-xs text-ink/50">
                      <span>distance: {r.distance.toFixed(4)}</span>
                      {Object.entries(r.metadata).map(([k, v]) => (
                        <span key={k}>{k}: {v}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
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
                <p className="font-medium">{entry.name === "auto" ? "Auto (smart routing)" : entry.name}</p>
                {entry.name === "auto" ? (
                  <p className="text-ink/70">Routes by keyword: code → qwen3-coder-next · reasoning → qwen3.6-27b · default → qwen3.5-9b</p>
                ) : (
                  <>
                    <p className="text-ink/70">Precision: {entry.precision}</p>
                    <p className="text-ink/70">VRAM: {entry.vram_gb.toFixed(1)} GB</p>
                  </>
                )}
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}