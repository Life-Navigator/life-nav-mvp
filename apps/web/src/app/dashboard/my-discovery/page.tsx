'use client';

// My Discovery (Sprint 47) — one place to see how complete the user's life model is, per domain:
// coverage %, status, missing inputs, what each domain unlocks, and the resulting recommendation /
// scenario / decision-brain quality. Canonical source: /v1/life/discovery/coverage.

import Link from 'next/link';
import React, { useEffect, useState } from 'react';
import { useLifeModelRevision } from '@/lib/lifeModel/refreshBus';

interface Domain {
  domain: string;
  label: string;
  coverage_pct: number;
  status: 'not_started' | 'started' | 'partial' | 'complete' | 'deprioritized';
  confidence_pct: number;
  missing: string[];
  unlocks: string[];
  cta: string | null;
}
interface Coverage {
  overall_coverage_pct: number;
  domains: Domain[];
  recommendation_quality: string;
  scenario_quality: string;
  decision_brain_quality: string;
}

const STATUS: Record<string, { label: string; color: string }> = {
  complete: { label: 'Complete', color: 'bg-emerald-500' },
  partial: { label: 'Partial', color: 'bg-amber-500' },
  started: { label: 'Started', color: 'bg-sky-500' },
  // The coverage API also emits "deprioritized" (e.g. education when the user deferred school) — must be
  // handled or the whole page crashes on that domain. Unknown statuses fall back to not_started (never throw).
  deprioritized: { label: 'Sufficient for now', color: 'bg-gray-400' },
  not_started: { label: 'Not started', color: 'bg-gray-300' },
};
const statusOf = (s: string) => STATUS[s] || STATUS.not_started;

export default function MyDiscoveryPage() {
  const [d, setD] = useState<Coverage | null>(null);
  const [loading, setLoading] = useState(true);
  // Re-fetch coverage when the life model changes (e.g. the user just approved a goal in the advisor),
  // so this page advances live instead of only on reload.
  const rev = useLifeModelRevision();
  useEffect(() => {
    let on = true;
    fetch('/api/life/discovery-coverage', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((x) => {
        if (!on) return;
        setD(x);
        setLoading(false);
      })
      .catch(() => on && setLoading(false));
    return () => {
      on = false;
    };
  }, [rev]);

  if (loading) return <div className="max-w-4xl mx-auto px-4 py-8 text-gray-500">Loading…</div>;
  if (!d?.domains)
    return <div className="max-w-4xl mx-auto px-4 py-8 text-gray-500">No discovery data yet.</div>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900">My Discovery</h1>
      <p className="text-sm text-gray-500 mt-1">
        How complete your life model is — and what each domain unlocks as you fill it in.
      </p>

      <section className="mt-4 rounded-2xl border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-5">
        <div className="flex flex-wrap gap-6">
          <Stat label="Overall coverage" value={`${d.overall_coverage_pct}%`} />
          <Stat label="Recommendation quality" value={d.recommendation_quality} />
          <Stat label="Scenario quality" value={d.scenario_quality} />
          <Stat label="Decision Brain quality" value={d.decision_brain_quality} />
        </div>
      </section>

      <div className="mt-5 space-y-3">
        {d.domains.map((dm) => (
          <section
            key={dm.domain}
            className="rounded-xl border border-gray-100 bg-white shadow-sm p-5"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-900">
                {dm.label || dm.domain} Discovery
              </h2>
              <span className="flex items-center gap-2 text-xs text-gray-500">
                <span className={`w-2 h-2 rounded-full ${statusOf(dm.status).color}`} />
                {statusOf(dm.status).label} · {dm.coverage_pct}%
              </span>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-gray-100 overflow-hidden">
              <div className="h-full bg-indigo-500" style={{ width: `${dm.coverage_pct}%` }} />
            </div>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              {(dm.missing?.length ?? 0) > 0 && (
                <div>
                  <div className="text-[11px] uppercase text-rose-600 font-semibold">Missing</div>
                  <div className="text-gray-700">
                    {(dm.missing || []).map((m) => m.replace(/_/g, ' ')).join(' · ')}
                  </div>
                </div>
              )}
              {(dm.unlocks?.length ?? 0) > 0 && (
                <div>
                  <div className="text-[11px] uppercase text-emerald-600 font-semibold">
                    Unlocks
                  </div>
                  <div className="text-gray-700">{(dm.unlocks || []).join(' · ')}</div>
                </div>
              )}
            </div>
            {dm.cta && (
              <Link href={dm.cta} className="mt-3 inline-block text-sm text-indigo-600 font-medium">
                Continue {dm.label} discovery →
              </Link>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase text-gray-400 font-semibold">{label}</div>
      <div className="text-xl font-bold text-gray-900">{value}</div>
    </div>
  );
}
