import Link from "next/link";

export default function HomePage() {
  return (
    <section className="space-y-6">
      <p className="inline-block rounded-full border border-ink/20 bg-white/70 px-3 py-1 text-xs uppercase tracking-[0.15em]">
        Strix Halo Runtime Console
      </p>
      <h1 className="font-display text-4xl font-semibold leading-tight md:text-6xl">
        AI Inference Platform
      </h1>
      <p className="max-w-2xl text-base text-ink/80 md:text-lg">
        FastAPI orchestration, Next.js operations UI, and sharded local media storage with quota-aware controls.
      </p>
      <div className="flex gap-3">
        <Link href="/login" className="rounded-xl bg-ink px-5 py-3 text-sand">
          Login
        </Link>
        <Link href="/dashboard" className="rounded-xl border border-ink/20 bg-white px-5 py-3">
          Open Dashboard
        </Link>
      </div>
    </section>
  );
}
