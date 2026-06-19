import type { QwenModel } from "@/config/app-config";
import { LiteLlmLaunchButton } from "@/components/litellm-launcher";
import { LibreChatLaunchButton } from "@/components/librechat-launcher";

const cardClass =
  "group flex flex-col gap-2 rounded-2xl border border-ink/10 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-600 hover:shadow-md";

function CardBody({ model }: { model: QwenModel }) {
  return (
    <>
      <span className="font-display text-lg font-semibold text-ink">{model.label}</span>
      <span className="text-sm text-ink/60">{model.description ?? model.detail}</span>
      <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-cyan-700 opacity-0 transition group-hover:opacity-100">
        {model.launcher ? "Log in & open →" : "Open →"}
      </span>
    </>
  );
}

/**
 * Shown on the home page when the chat console is disabled via the master
 * config. Lists every local model runner as a clickable card that opens the
 * localhost port serving that model. Entries flagged `autoLogin` log straight
 * into LiteLLM using the configured credentials instead.
 */
export function ModelLauncher({ models }: { models: QwenModel[] }) {
  return (
    <section className="mx-auto max-w-4xl space-y-8 py-6">
      <div className="flex flex-col gap-3 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700">Local model runners</p>
        <h1 className="font-display text-3xl font-semibold text-ink sm:text-4xl">Pick a model to open</h1>
        <p className="mx-auto max-w-2xl text-sm text-ink/70">
          The chat console is currently turned off. Select any local Qwen runner below to open its native
          chat UI on the port serving that model.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {models.map((model) =>
          model.launcher === "litellm" ? (
            <LiteLlmLaunchButton key={model.href} className={cardClass} target={model.href}>
              <CardBody model={model} />
            </LiteLlmLaunchButton>
          ) : model.launcher === "librechat" ? (
            <LibreChatLaunchButton key={model.href} className={cardClass} target={model.href}>
              <CardBody model={model} />
            </LibreChatLaunchButton>
          ) : (
            <a
              key={model.href}
              href={model.href}
              target="_blank"
              rel="noreferrer"
              className={cardClass}
            >
              <CardBody model={model} />
            </a>
          ),
        )}
      </div>
    </section>
  );
}
