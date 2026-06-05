import Link from "next/link";

export default function OpenWebUIPage() {
  return (
    <section className="space-y-6">
      <div className="space-y-3">
        <p className="text-xs uppercase tracking-[0.18em] text-ink/50">OpenWebUI</p>
        <h1 className="font-display text-4xl font-semibold">Dedicated local chat workspace</h1>
        <p className="max-w-3xl text-sm text-ink/70 md:text-base">
          This page keeps the embedded OpenWebUI experience separate from the inference controls so it has more room and a cleaner focus.
        </p>
        <div className="flex flex-wrap gap-3">
          <a
            href="https://breachlabz-nucbox-evo-x2.tailcf3262.ts.net:4443/"
            target="_blank"
            rel="noreferrer"
            className="rounded-xl bg-ink px-5 py-3 text-sand"
          >
            Open in new tab
          </a>
          <Link href="/inference" className="rounded-xl border border-ink/20 bg-white px-5 py-3">
            Back to Inference
          </Link>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-ink/10 bg-white/80 shadow-sm">
        <div className="border-b border-ink/10 px-5 py-4">
          <h2 className="font-display text-2xl font-semibold">OpenWebUI</h2>
          <p className="text-sm text-ink/70">Embedded view of the local chat interface.</p>
        </div>
        <iframe
          title="OpenWebUI"
          src="https://breachlabz-nucbox-evo-x2.tailcf3262.ts.net:4443/"
          className="h-[78vh] w-full"
        />
      </div>
    </section>
  );
}
