"use client";

import type { FormEvent, KeyboardEvent, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { ModelLauncher } from "@/components/model-launcher";
import { LiteLlmLaunchButton } from "@/components/litellm-launcher";
import { LibreChatLaunchButton } from "@/components/librechat-launcher";
import { appConfig } from "@/config/app-config";
import { ApiError, apiClient } from "@/lib/api/client";

type ModelEntry = {
  name: string;
  precision: string;
  vram_gb: number;
};

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
  model?: string;
};

const directModelHints: Record<string, string> = {
  "qwen3-coder-next": "Code, debugging, refactors",
  "qwen3.6-27b": "Reasoning, analysis, planning",
  "qwen3.5-9b": "Fast general chat",
};

const nativeModelUis = appConfig.models;

const chatStorageKey = "breachlabz-chat-messages";
const welcomeMessages: ChatMessage[] = [
  {
    id: "welcome",
    role: "assistant",
    content:
      "Hi, I am ready to route through LiteLLM or talk directly to any of the three local models. Send a prompt and I will show which model answered.",
    model: "auto",
  },
];

function modelLabel(name: string) {
  return name === "auto" ? "LiteLLM auto router" : name;
}

function modelDescription(entry: ModelEntry) {
  if (entry.name === "auto") {
    return "Routes each prompt to the best local model.";
  }

  return directModelHints[entry.name] ?? `${entry.precision} precision, ${entry.vram_gb.toFixed(1)} GB VRAM`;
}

function renderInlineMarkdown(text: string): ReactNode[] {
  const tokens = text.split(/(`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_)/g);

  return tokens.map((token, index) => {
    if (token.startsWith("`") && token.endsWith("`")) {
      return (
        <code key={index} className="rounded bg-ink/10 px-1.5 py-0.5 font-mono text-[0.92em] text-ink">
          {token.slice(1, -1)}
        </code>
      );
    }

    if ((token.startsWith("**") && token.endsWith("**")) || (token.startsWith("__") && token.endsWith("__"))) {
      return <strong key={index}>{token.slice(2, -2)}</strong>;
    }

    if ((token.startsWith("*") && token.endsWith("*")) || (token.startsWith("_") && token.endsWith("_"))) {
      return <em key={index}>{token.slice(1, -1)}</em>;
    }

    return token;
  });
}

function MarkdownMessage({ content, inverted = false }: { content: string; inverted?: boolean }) {
  const lines = content.split(/\r?\n/);
  const elements: ReactNode[] = [];
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let codeBlock: { language: string; lines: string[] } | null = null;

  function flushParagraph() {
    if (paragraph.length === 0) {
      return;
    }

    elements.push(
      <p key={`p-${elements.length}`} className="whitespace-pre-wrap">
        {renderInlineMarkdown(paragraph.join(" "))}
      </p>,
    );
    paragraph = [];
  }

  function flushList() {
    if (!list) {
      return;
    }

    const ListTag = list.ordered ? "ol" : "ul";
    elements.push(
      <ListTag
        key={`list-${elements.length}`}
        className={`space-y-1 pl-5 ${list.ordered ? "list-decimal" : "list-disc"}`}
      >
        {list.items.map((item, index) => (
          <li key={`${item}-${index}`}>{renderInlineMarkdown(item)}</li>
        ))}
      </ListTag>,
    );
    list = null;
  }

  function flushCodeBlock() {
    if (!codeBlock) {
      return;
    }

    elements.push(
      <pre
        key={`code-${elements.length}`}
        className="overflow-x-auto rounded-xl bg-ink px-3 py-3 text-xs leading-5 text-zinc-100"
      >
        {codeBlock.language ? <div className="mb-2 text-[0.7rem] uppercase text-zinc-400">{codeBlock.language}</div> : null}
        <code>{codeBlock.lines.join("\n")}</code>
      </pre>,
    );
    codeBlock = null;
  }

  lines.forEach((line) => {
    const fenceMatch = line.match(/^```([\w-]*)\s*$/);
    if (fenceMatch) {
      if (codeBlock) {
        flushCodeBlock();
        return;
      }

      flushParagraph();
      flushList();
      codeBlock = { language: fenceMatch[1] ?? "", lines: [] };
      return;
    }

    if (codeBlock) {
      codeBlock.lines.push(line);
      return;
    }

    if (!line.trim()) {
      flushParagraph();
      flushList();
      return;
    }

    const headingMatch = line.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph();
      flushList();
      const level = headingMatch[1].length;
      const className = level <= 2 ? "font-display text-lg font-semibold" : "font-semibold";
      elements.push(
        <div key={`h-${elements.length}`} className={className}>
          {renderInlineMarkdown(headingMatch[2])}
        </div>,
      );
      return;
    }

    if (/^(-{3,}|\*{3,})$/.test(line.trim())) {
      flushParagraph();
      flushList();
      elements.push(<hr key={`hr-${elements.length}`} className="border-ink/10" />);
      return;
    }

    const quoteMatch = line.match(/^>\s?(.+)$/);
    if (quoteMatch) {
      flushParagraph();
      flushList();
      elements.push(
        <blockquote key={`quote-${elements.length}`} className="border-l-2 border-cyan-600 pl-3 text-ink/70">
          {renderInlineMarkdown(quoteMatch[1])}
        </blockquote>,
      );
      return;
    }

    const orderedMatch = line.match(/^\d+\.\s+(.+)$/);
    if (orderedMatch) {
      flushParagraph();
      if (!list || !list.ordered) {
        flushList();
        list = { ordered: true, items: [] };
      }
      list.items.push(orderedMatch[1]);
      return;
    }

    const bulletMatch = line.match(/^[-*]\s+(.+)$/);
    if (bulletMatch) {
      flushParagraph();
      if (!list || list.ordered) {
        flushList();
        list = { ordered: false, items: [] };
      }
      list.items.push(bulletMatch[1]);
      return;
    }

    flushList();
    paragraph.push(line);
  });

  flushCodeBlock();
  flushParagraph();
  flushList();

  return <div className={`space-y-3 ${inverted ? "text-white" : "text-ink"}`}>{elements}</div>;
}

function requestHistory(messages: ChatMessage[]) {
  return messages
    .filter((message) => message.id !== "welcome")
    .filter((message) => !message.id.endsWith("-pending") && !message.id.endsWith("-error"))
    .slice(-16)
    .map((message) => ({ role: message.role, content: message.content }));
}

export default function HomePage() {
  const [models, setModels] = useState<ModelEntry[]>([]);
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>(welcomeMessages);
  const [routedModel, setRoutedModel] = useState<string>("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [mediaType, setMediaType] = useState<"image" | "video">("image");
  const [mediaPrompt, setMediaPrompt] = useState("Generate a cinematic product hero image with teal lighting.");
  const [model, setModel] = useState("auto");
  const [mediaJob, setMediaJob] = useState("");
  const [apiError, setApiError] = useState("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const hasLoadedStoredMessages = useRef(false);

  const selectedModel = useMemo(() => models.find((entry) => entry.name === model), [model, models]);
  const directModels = useMemo(() => models.filter((entry) => entry.name !== "auto"), [models]);

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

      return models.some((entry) => entry.name === "auto") ? "auto" : models[0].name;
    });
  }, [models]);

  useEffect(() => {
    const storedMessages = window.localStorage.getItem(chatStorageKey);
    if (storedMessages) {
      try {
        const parsedMessages = JSON.parse(storedMessages) as ChatMessage[];
        if (Array.isArray(parsedMessages) && parsedMessages.length > 0) {
          setMessages(parsedMessages);
        }
      } catch {
        window.localStorage.removeItem(chatStorageKey);
      }
    }

    hasLoadedStoredMessages.current = true;
  }, []);

  useEffect(() => {
    if (!hasLoadedStoredMessages.current) {
      return;
    }

    window.localStorage.setItem(chatStorageKey, JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  async function submitChat(event?: FormEvent<HTMLFormElement>, selectedModelName = model) {
    event?.preventDefault();

    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt || isChatLoading) {
      return;
    }

    setIsChatLoading(true);
    setRoutedModel("");
    setApiError("");
    setPrompt("");
    setModel(selectedModelName);

    const requestId = crypto.randomUUID();
    const messagesForRequest = requestHistory(messages);
    setMessages((current) => [
      ...current,
      { id: `${requestId}-user`, role: "user", content: trimmedPrompt },
      {
        id: `${requestId}-pending`,
        role: "assistant",
        content: "Thinking...",
        model: selectedModelName,
      },
    ]);

    try {
      const response = await apiClient.chat({
        prompt: trimmedPrompt,
        model: selectedModelName,
        max_tokens: 2000,
        messages: messagesForRequest,
      });
      setRoutedModel(response.routed_model);
      setMessages((current) =>
        current.map((message) =>
          message.id === `${requestId}-pending`
            ? {
                ...message,
                id: `${requestId}-assistant`,
                content: response.output || "The model returned an empty response.",
                model: response.routed_model,
              }
            : message,
        ),
      );
    } catch (error) {
      setFriendlyError(error);
      setMessages((current) =>
        current.map((message) =>
          message.id === `${requestId}-pending`
            ? {
                ...message,
                id: `${requestId}-error`,
                content: "I could not reach the inference endpoint. Check the backend and LiteLLM route, then try again.",
                model: selectedModelName,
              }
            : message,
        ),
      );
    } finally {
      setIsChatLoading(false);
    }
  }

  function onPromptKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submitChat();
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

  if (!appConfig.features.chatPage) {
    return <ModelLauncher models={appConfig.models} />;
  }

  return (
    <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="flex h-[calc(100vh-10rem)] min-h-[38rem] flex-col overflow-hidden rounded-2xl border border-ink/10 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-ink/10 bg-white px-4 py-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-cyan-700">Local chat agent</p>
            <h1 className="font-display text-2xl font-semibold text-ink">BreachLabz LLM Router</h1>
          </div>

          <label className="flex min-w-0 flex-col gap-1 text-sm text-ink/70 sm:min-w-80">
            <span className="font-medium text-ink">Routing mode</span>
            <select
              className="h-11 w-full rounded-lg border border-ink/15 bg-white px-3 text-sm text-ink outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
              value={model}
              disabled={models.length === 0}
              onChange={(event) => setModel(event.target.value)}
            >
              {models.length === 0 ? (
                <option value="">Loading models...</option>
              ) : (
                models.map((entry) => (
                  <option key={entry.name} value={entry.name}>
                    {modelLabel(entry.name)}
                  </option>
                ))
              )}
            </select>
          </label>
        </div>

        {apiError ? (
          <div className="border-b border-red-200 bg-red-50 px-5 py-3 text-sm text-red-800">{apiError}</div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto bg-zinc-50 px-4 py-5 sm:px-6">
          <div className="flex flex-col gap-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[86%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm ${
                  message.role === "user"
                    ? "rounded-br-md bg-ink text-white"
                    : "rounded-bl-md border border-ink/10 bg-white text-ink"
                }`}
              >
                {message.role === "assistant" ? (
                  <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-ink/50">
                    <span className="font-semibold text-cyan-700">Assistant</span>
                    <span>{message.model ? modelLabel(message.model) : "Local model"}</span>
                  </div>
                ) : null}
                <MarkdownMessage content={message.content} inverted={message.role === "user"} />
              </div>
            </div>
          ))}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <form className="border-t border-ink/10 bg-white p-4 sm:p-5" onSubmit={(event) => void submitChat(event)}>
          <div className="flex flex-col gap-3 rounded-xl border border-ink/15 bg-white p-3 focus-within:border-cyan-600 focus-within:ring-2 focus-within:ring-cyan-100">
            <textarea
              className="min-h-20 w-full resize-none border-0 bg-transparent text-sm leading-6 text-ink outline-none placeholder:text-ink/40"
              placeholder="Ask anything. Press Enter to send, Shift+Enter for a new line."
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              onKeyDown={onPromptKeyDown}
            />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs text-ink/50">
                {selectedModel ? modelDescription(selectedModel) : "Connect the backend to load available models."}
                {routedModel ? <span className="ml-2 text-ink/70">Last routed to {routedModel}</span> : null}
              </div>
              <Button className="h-10 px-5" type="submit" disabled={isChatLoading || !prompt.trim()}>
                {isChatLoading ? "Sending..." : "Send"}
              </Button>
            </div>
          </div>
        </form>
      </div>

      <aside className="space-y-5">
        <section className="rounded-2xl border border-ink/10 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase text-cyan-700">Native chat UIs</p>
          <h2 className="font-display text-xl font-semibold">Open model page</h2>
          <div className="mt-4 grid gap-2">
            {nativeModelUis.map((entry) => {
              const cardClass =
                "rounded-xl border border-ink/10 bg-white px-3 py-3 text-left text-sm transition hover:border-cyan-600 hover:bg-cyan-50";
              const body = (
                <>
                  <span className="block font-medium text-ink">{entry.label}</span>
                  <span className="mt-1 block text-xs text-ink/60">{entry.detail}</span>
                </>
              );

              return entry.launcher === "litellm" ? (
                <LiteLlmLaunchButton key={entry.href} className={cardClass} target={entry.href}>
                  {body}
                </LiteLlmLaunchButton>
              ) : entry.launcher === "librechat" ? (
                <LibreChatLaunchButton key={entry.href} className={cardClass} target={entry.href}>
                  {body}
                </LibreChatLaunchButton>
              ) : (
                <a key={entry.href} href={entry.href} target="_blank" rel="noreferrer" className={cardClass}>
                  {body}
                </a>
              );
            })}
          </div>
        </section>

        {/* <section className="rounded-2xl border border-ink/10 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase text-cyan-700">Model control</p>
              <h2 className="font-display text-xl font-semibold">Routing targets</h2>
            </div>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
              {models.length || 0} online
            </span>
          </div>

          <div className="mt-4 grid gap-2">
            {models.map((entry) => (
              <button
                key={entry.name}
                type="button"
                className={`rounded-xl border px-3 py-3 text-left text-sm transition ${
                  model === entry.name
                    ? "border-cyan-600 bg-cyan-50 text-ink"
                    : "border-ink/10 bg-white text-ink hover:border-ink/30"
                }`}
                onClick={() => setModel(entry.name)}
              >
                <span className="block font-medium">{modelLabel(entry.name)}</span>
                <span className="mt-1 block text-xs text-ink/60">{modelDescription(entry)}</span>
              </button>
            ))}
            {models.length === 0 ? <p className="text-sm text-ink/60">No models loaded yet.</p> : null}
          </div>
        </section>

        <section className="rounded-2xl border border-ink/10 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase text-cyan-700">Direct models</p>
          <h2 className="font-display text-xl font-semibold">Three local runners</h2>
          <div className="mt-4 space-y-3 text-sm">
            {directModels.map((entry) => (
              <div key={entry.name} className="grid gap-1 border-b border-ink/10 pb-3 last:border-b-0 last:pb-0">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">{entry.name}</span>
                  <span className="text-xs text-ink/50">{entry.vram_gb.toFixed(1)} GB</span>
                </div>
                <span className="text-xs text-ink/60">{directModelHints[entry.name] ?? entry.precision}</span>
              </div>
            ))}
          </div>
        </section> */}

        <section className="rounded-2xl border border-ink/10 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase text-cyan-700">Media queue</p>
          <h2 className="font-display text-xl font-semibold">Generate asset</h2>
          <div className="mt-4 space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              {(["image", "video"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  className={`rounded-lg border px-3 py-2 capitalize transition ${
                    mediaType === type ? "border-cyan-600 bg-cyan-50 text-cyan-800" : "border-ink/10 bg-white"
                  }`}
                  onClick={() => setMediaType(type)}
                >
                  {type}
                </button>
              ))}
            </div>
            <textarea
              className="min-h-28 w-full resize-none rounded-lg border border-ink/15 bg-white px-3 py-2 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
              value={mediaPrompt}
              onChange={(event) => setMediaPrompt(event.target.value)}
            />
            <Button className="w-full" type="button" onClick={() => void submitMedia()}>
              Queue job
            </Button>
            {mediaJob ? <p className="break-all rounded-lg bg-zinc-50 px-3 py-2 text-xs text-ink/70">Job queued: {mediaJob}</p> : null}
          </div>
        </section>
      </aside>
    </section>
  );
}
