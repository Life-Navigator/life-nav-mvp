'use client';

import Link from 'next/link';
import { SchoolLogo } from '@/components/ui/SchoolLogo';

export interface SnapshotStat {
  label: string;
  value: number;
  href?: string;
}

/**
 * A compact, real-data snapshot strip for a domain overview: an optional hero line
 * (e.g. current role / top degree) plus a grid of counts. When everything is zero it
 * renders an honest empty state with a CTA — never fabricated numbers.
 */
export function DomainSnapshot({
  title,
  hero,
  heroLogoName,
  heroLogoUrl,
  stats,
  emptyTitle,
  emptyHint,
  ctaHref,
  ctaLabel,
}: {
  title: string;
  hero?: string | null;
  heroLogoName?: string;
  heroLogoUrl?: string | null;
  stats: SnapshotStat[];
  emptyTitle: string;
  emptyHint: string;
  ctaHref: string;
  ctaLabel: string;
}) {
  const total = stats.reduce((n, s) => n + (s.value || 0), 0);

  if (total === 0 && !hero) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 text-center">
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">{emptyTitle}</h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{emptyHint}</p>
        <Link
          href={ctaHref}
          className="mt-3 inline-flex items-center rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm px-4 py-2"
        >
          {ctaLabel}
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">{title}</h3>
        <Link href={ctaHref} className="text-sm text-indigo-600 hover:text-indigo-700">
          {ctaLabel} →
        </Link>
      </div>

      {hero && (
        <div className="flex items-center gap-3 mb-4 pb-4 border-b border-slate-100 dark:border-slate-700">
          {heroLogoName && <SchoolLogo name={heroLogoName} logoUrl={heroLogoUrl} size={44} />}
          <p className="text-lg font-semibold text-slate-900 dark:text-white">{hero}</p>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {stats.map((s) => {
          const body = (
            <div className="rounded-xl bg-slate-50 dark:bg-slate-900/40 px-3 py-3 text-center hover:bg-slate-100 dark:hover:bg-slate-900/70 transition-colors">
              <div className="text-2xl font-bold text-slate-900 dark:text-white">{s.value}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{s.label}</div>
            </div>
          );
          return s.href ? (
            <Link key={s.label} href={s.href}>
              {body}
            </Link>
          ) : (
            <div key={s.label}>{body}</div>
          );
        })}
      </div>
    </div>
  );
}
