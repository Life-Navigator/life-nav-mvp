'use client';

// Compact per-domain discovery-coverage block for the dashboard domain cards. Canonical source is
// /api/life/discovery-coverage (the SAME endpoint /dashboard/my-discovery uses — no duplicate logic).
// Replaces the generic "No X data / Enter Data" empty cards with coverage %, status, missing input,
// unlocks, and a next-action CTA.

import Link from 'next/link';

export interface DomainCoverageData {
  domain: string;
  label: string;
  coverage_pct: number;
  status: 'not_started' | 'started' | 'partial' | 'complete';
  confidence_pct: number;
  missing: string[];
  unlocks: string[];
  cta: string | null;
}

const STATUS: Record<string, { label: string; color: string }> = {
  complete: { label: 'Complete', color: 'bg-emerald-500' },
  partial: { label: 'Partial', color: 'bg-amber-500' },
  started: { label: 'Started', color: 'bg-sky-500' },
  not_started: { label: 'Not started', color: 'bg-gray-300' },
};

export default function DomainCoverage({
  data,
  fallbackHref = '/dashboard/advisor',
  fallbackLabel = 'Continue Discovery',
}: {
  data?: DomainCoverageData | null;
  fallbackHref?: string;
  fallbackLabel?: string;
}) {
  // No coverage info yet → honest CTA into discovery (never a generic empty card with fake actions).
  if (!data) {
    return (
      <div className="text-center py-6">
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">Not enough information yet.</p>
        <Link
          href={fallbackHref}
          className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
        >
          {fallbackLabel}
        </Link>
      </div>
    );
  }

  const st = STATUS[data.status] || STATUS.not_started;
  const topMissing = data.missing?.[0]?.replace(/_/g, ' ');

  return (
    <div className="py-2">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-500 dark:text-gray-400">Coverage</span>
        <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
          <span className={`w-2 h-2 rounded-full ${st.color}`} /> {st.label} · {data.coverage_pct}%
          {data.confidence_pct ? ` · ${data.confidence_pct}% conf` : ''}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
        <div className="h-full bg-indigo-500" style={{ width: `${data.coverage_pct}%` }} />
      </div>
      {topMissing && (
        <p className="mt-2 text-xs text-gray-600 dark:text-gray-300">
          <span className="text-rose-600 font-semibold">Missing:</span> {topMissing}
        </p>
      )}
      {data.unlocks?.length > 0 && (
        <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">
          <span className="text-emerald-600 font-semibold">Unlocks:</span>{' '}
          {data.unlocks.slice(0, 2).join(' · ')}
        </p>
      )}
      {data.cta && (
        <Link
          href={data.cta}
          className="mt-3 inline-block text-sm text-indigo-600 dark:text-indigo-400 font-medium"
        >
          Continue {data.label} discovery →
        </Link>
      )}
    </div>
  );
}
