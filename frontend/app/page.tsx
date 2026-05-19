import Link from "next/link";

export default function HomePage() {
  return (
    <section className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
      <div className="space-y-6">
        <p className="inline-block rounded-full border border-ink/20 bg-white/70 px-3 py-1 text-xs uppercase tracking-[0.15em]">
          Strix Halo Runtime Console
        </p>
        <h1 className="max-w-2xl font-display text-4xl font-semibold leading-tight md:text-6xl">
          AI Inference Platform for local orchestration, storage, and runtime control.
        </h1>
        <p className="max-w-2xl text-base text-ink/80 md:text-lg">
          The UI is now shaped around the target architecture: auth, live system telemetry, inference jobs,
          storage management, and an endpoint map for the FastAPI gateway.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/login" className="rounded-xl bg-ink px-5 py-3 text-sand">
            Login
          </Link>
          <Link href="/dashboard" className="rounded-xl border border-ink/20 bg-white px-5 py-3">
            Open Dashboard
          </Link>
        </div>
      </div>

      <div className="grid gap-4 rounded-3xl border border-ink/10 bg-white/80 p-6 shadow-sm">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-ink/50">Architecture focus</p>
          <p className="mt-2 font-display text-2xl">Four-layer runtime stack</p>
        </div>
        <div className="grid gap-3 text-sm text-ink/75">
          <div className="rounded-2xl border border-ink/10 bg-sand/70 p-4">
            UI: Next.js dashboard, session state, typed API client.
          </div>
          <div className="rounded-2xl border border-ink/10 bg-sand/70 p-4">
            API: FastAPI auth, inference, storage, and system endpoints.
          </div>
          <div className="rounded-2xl border border-ink/10 bg-sand/70 p-4">
            Data: PostgreSQL, pgvector, Redis, and sharded media paths.
          </div>
          <div className="rounded-2xl border border-ink/10 bg-sand/70 p-4">
            Runtime: Ollama, ComfyUI, and telemetry adapters.
          </div>
        </div>
      </div>
    </section>
  );
}
