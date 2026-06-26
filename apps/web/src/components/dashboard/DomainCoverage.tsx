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
  status: 'not_started' | 'started' | 'partial' | 'complete' | 'deprioritized';
  confidence_pct: number;
  facts?: Record<string, string | number>;
  missing: string[];
  unlocks: string[];
  cta: string | null;
}

const STATUS: Record<string, { label: string; color: string }> = {
  complete: { label: 'Complete', color: 'bg-emerald-500' },
  partial: { label: 'In progress', color: 'bg-amber-500' },
  started: { label: 'Started', color: 'bg-sky-500' },
  deprioritized: { label: 'Sufficient for now', color: 'bg-gray-400' },
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
  const factEntries = Object.entries(data.facts || {}).filter(([, v]) => v != null && v !== '');
  const hasFacts = factEntries.length > 0;
  const missing = (data.missing || []).map((m) => m.replace(/_/g, ' ')).slice(0, 4);

  return (
    <div className="py-1">
      {/* PRIMARY: concrete known facts (like Financial Overview) — not a progress bar. */}
      {hasFacts ? (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
          {factEntries.slice(0, 6).map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs text-gray-500 dark:text-gray-400">{k}</dt>
              <dd className="text-sm font-semibold text-gray-900 dark:text-white">{String(v)}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
          <div className="h-full bg-indigo-500" style={{ width: `${data.coverage_pct}%` }} />
        </div>
      )}

      {missing.length > 0 && (
        <p className="mt-3 text-xs text-gray-600 dark:text-gray-300">
          <span className="text-rose-600 font-semibold">Missing:</span> {missing.join(' · ')}
        </p>
      )}

      {data.cta && (
        <Link
          href={data.cta}
          className="mt-3 inline-block text-sm font-medium text-indigo-600 dark:text-indigo-400"
        >
          {hasFacts ? `View ${data.label} details →` : `Continue ${data.label} discovery →`}
        </Link>
      )}

      {/* SECONDARY: coverage/confidence as small metadata, not the headline. */}
      <div className="mt-3 flex items-center gap-1.5 text-[11px] text-gray-400 dark:text-gray-500">
        <span className={`w-1.5 h-1.5 rounded-full ${st.color}`} /> {st.label}
        {data.coverage_pct ? ` · ${data.coverage_pct}%` : ''}
        {data.confidence_pct ? ` · ${data.confidence_pct}% conf` : ''}
      </div>
    </div>
  );
}
