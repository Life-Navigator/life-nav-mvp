import type { ReactNode } from 'react';

export default function ScenarioCard({
  domain,
  title,
  detail,
  metric,
  icon,
}: {
  domain: string;
  title: string;
  detail: string;
  metric?: string;
  icon: ReactNode;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-[var(--brand-line)] bg-[var(--brand-paper)] p-6 transition-all hover:-translate-y-1 [box-shadow:var(--brand-elev)]">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-[var(--brand-accent)] opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-[0.12]"
      />
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--brand-ink)] text-[var(--brand-paper)]">
          {icon}
        </div>
        <div className="text-xs font-medium uppercase tracking-wider text-[var(--brand-accent)]">
          {domain}
        </div>
      </div>
      <h3 className="mt-4 text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-[var(--brand-muted)]">{detail}</p>
      {metric && (
        <div className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[var(--brand-accent-soft)] px-2.5 py-1 text-xs font-medium text-[var(--brand-accent)]">
          {metric}
        </div>
      )}
    </div>
  );
}
