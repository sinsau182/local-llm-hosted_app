export function MetricCard({
  title,
  value,
  hint,
}: {
  title: string;
  value: string;
  hint: string;
}) {
  return (
    <article className="rounded-2xl border border-ink/10 bg-white p-4 shadow-sm">
      <h2 className="text-sm uppercase tracking-[0.1em] text-ink/60">{title}</h2>
      <p className="mt-2 font-display text-3xl">{value}</p>
      <p className="mt-1 text-sm text-ink/70">{hint}</p>
    </article>
  );
}
