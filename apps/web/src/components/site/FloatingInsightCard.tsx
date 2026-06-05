import type { ReactNode } from 'react';

/**
 * Glass "insight" card — a synthetic product moment (e.g. "Grounded in your
 * data", a net-worth delta, a recommendation). Dark variant for the hero,
 * light for body sections.
 */
export default function FloatingInsightCard({
  eyebrow,
  title,
  detail,
  icon,
  tone = 'dark',
  className = '',
  spark,
}: {
  eyebrow?: string;
  title: string;
  detail?: string;
  icon?: ReactNode;
  tone?: 'dark' | 'light';
  className?: string;
  spark?: boolean;
}) {
  const glass = tone === 'dark' ? 'glass-dark text-white' : 'glass text-[var(--brand-ink)]';
  const muted = tone === 'dark' ? 'text-white/55' : 'text-[var(--brand-muted)]';
  return (
    <div className={`rounded-2xl p-4 ${glass} ${className}`}>
      <div className="flex items-start gap-3">
        {icon && (
          <div
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
              tone === 'dark' ? 'bg-white/10' : 'bg-[var(--brand-accent-soft)]'
            } text-[var(--brand-accent)]`}
          >
            {icon}
          </div>
        )}
        <div className="min-w-0">
          {eyebrow && (
            <div className="flex items-center gap-1.5 text-[0.7rem] font-medium uppercase tracking-wider text-[var(--brand-accent)]">
              {spark && <span className="h-1.5 w-1.5 rounded-full bg-[var(--brand-accent)]" />}
              {eyebrow}
            </div>
          )}
          <div className="mt-0.5 text-sm font-semibold leading-snug">{title}</div>
          {detail && <div className={`mt-1 text-xs leading-relaxed ${muted}`}>{detail}</div>}
        </div>
      </div>
    </div>
  );
}
