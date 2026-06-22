'use client';

// FinancialResolverPanel (Sprint 45C) — renders ONLY canonical resolver data with a source label,
// confidence band, missing-input states, and a click-to-inspect lineage drawer. The truth layer
// for Investments + Retirement: if we know it, we show where it came from; if we don't, we say so.

import Link from 'next/link';
import React, { useEffect, useState } from 'react';

interface Field {
  value: number | string | null;
  present: boolean;
  source: string;
  confidence: number;
  confidence_band: string;
  origin: string | null;
  prompt?: string | null;
  unlocks: string[];
}
interface Resolved {
  inputs: Record<string, Field>;
  last_updated: string | null;
}

const SRC_COLOR: Record<string, string> = {
  'Plaid sandbox persona': 'bg-sky-50 text-sky-700 border-sky-100',
  'Uploaded document': 'bg-violet-50 text-violet-700 border-violet-100',
  'Advisor onboarding': 'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 border-indigo-100',
  'User-entered': 'bg-emerald-50 text-emerald-700 border-emerald-100',
  'Deterministic tool run': 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 border-amber-100',
  Missing: 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 border-rose-100',
};
const BAND_COLOR: Record<string, string> = {
  High: 'text-emerald-600',
  Medium: 'text-amber-600',
  Low: 'text-rose-600',
};
const money = (v: number | string | null) =>
  `$${Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

function fmt(key: string, v: number | string | null): string {
  if (v == null) return '—';
  if (
    key.endsWith('_rate') ||
    key === 'retirement_contribution_rate' ||
    key === 'employer_match_rate'
  )
    return `${v}%`;
  if (key === 'debt_apr') return `${(Number(v) * 100).toFixed(1)}%`;
  if (typeof v === 'string') return v;
  return money(v);
}
const LABELS: Record<string, string> = {
  investment_balance: 'Investment balance',
  cash_balance: 'Cash balance',
  retirement_balance: 'Retirement balance',
  income: 'Income',
  retirement_contribution_rate: '401(k) contribution',
  employer_match_rate: 'Employer match',
  debt_total: 'Total debt',
  debt_apr: 'Debt APR',
  risk_profile: 'Risk profile',
  time_horizon: 'Time horizon',
  housing_target: 'Home price target',
};

interface Projection {
  available: boolean;
  source: string;
  tool_run_id?: string;
  outputs?: {
    projected_assets: number;
    target_nest_egg: number;
    funding_gap: number;
    readiness_ratio: number | null;
    on_track: boolean;
    years_to_retirement: number;
  };
  inputs_used?: Record<string, number | null>;
  assumptions?: string[];
  limitations?: string[];
  confidence?: number;
  confidence_band?: string;
  missing?: { input: string; prompt: string }[];
  message?: string;
}

export default function FinancialResolverPanel({
  title,
  keys,
  withProjection = false,
}: {
  title: string;
  keys: string[];
  withProjection?: boolean;
}) {
  const [r, setR] = useState<Resolved | null>(null);
  const [loading, setLoading] = useState(true);
  const [drawer, setDrawer] = useState<{ key: string; field: Field } | null>(null);
  const [proj, setProj] = useState<Projection | null>(null);
  const [age, setAge] = useState('');

  const loadProjection = (currentAge?: string) => {
    if (!withProjection) return;
    const qs = currentAge ? `?current_age=${encodeURIComponent(currentAge)}` : '';
    fetch(`/api/finance/retirement-projection${qs}`)
      .then((x) => (x.ok ? x.json() : null))
      .then(setProj)
      .catch(() => {});
  };

  useEffect(() => {
    fetch('/api/finance/resolved-inputs')
      .then((x) => (x.ok ? x.json() : null))
      .then((d) => {
        setR(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
    loadProjection();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading)
    return (
      <div className="rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 text-gray-400 dark:text-gray-500">
        Loading canonical data…
      </div>
    );
  if (!r?.inputs) return null;
  const updated = r.last_updated ? new Date(r.last_updated).toLocaleDateString() : 'recently';

  return (
    <section className="rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100">{title}</h2>
        <span className="text-[11px] text-gray-400 dark:text-gray-500">Updated: {updated}</span>
      </div>
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {keys.map((key) => {
          const f = r.inputs[key];
          if (!f) return null;
          if (!f.present) {
            return (
              <div
                key={key}
                className="rounded-lg border border-rose-100 bg-rose-50 dark:bg-rose-950/30 p-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-800 dark:text-gray-100">
                    {LABELS[key] ?? key}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">
                    Missing
                  </span>
                </div>
                {f.prompt && (
                  <div className="text-xs text-gray-600 dark:text-gray-300 mt-1">{f.prompt}</div>
                )}
                {f.unlocks?.length > 0 && (
                  <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                    Unlocks: {f.unlocks.join(' · ')}
                  </div>
                )}
                <Link
                  href="/dashboard/advisor"
                  className="text-xs text-indigo-600 font-medium mt-1 inline-block"
                >
                  Provide this →
                </Link>
              </div>
            );
          }
          return (
            <button
              key={key}
              onClick={() => setDrawer({ key, field: f })}
              className="text-left rounded-lg border border-gray-100 dark:border-gray-700 p-3 hover:shadow-sm"
            >
              <div className="text-[11px] uppercase tracking-wide text-gray-400 dark:text-gray-500 font-semibold">
                {LABELS[key] ?? key}
              </div>
              <div className="text-xl font-bold text-gray-900 dark:text-gray-100">
                {fmt(key, f.value)}
              </div>
              <div className="mt-1 flex items-center gap-2">
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full border ${SRC_COLOR[f.source] ?? 'bg-gray-50 dark:bg-gray-900/40 text-gray-600 dark:text-gray-300 border-gray-100 dark:border-gray-700'}`}
                >
                  {f.source}
                </span>
                <span
                  className={`text-[10px] font-semibold ${BAND_COLOR[f.confidence_band] ?? 'text-gray-500 dark:text-gray-400'}`}
                >
                  {f.confidence_band} confidence
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {withProjection && proj && (
        <div className="mt-4 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100">
              Projected retirement assets
            </h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full border bg-amber-100 text-amber-700 border-amber-200 dark:border-amber-800">
              {proj.available ? 'Source: Deterministic tool run' : 'Source: Missing'}
            </span>
          </div>
          {proj.available && proj.outputs ? (
            <>
              <div className="text-3xl font-extrabold text-gray-900 dark:text-gray-100 mt-1">
                {money(proj.outputs.projected_assets)}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-300 mt-0.5">
                {proj.outputs.on_track
                  ? 'On track'
                  : `Funding gap ${money(proj.outputs.funding_gap)}`}{' '}
                · {proj.outputs.years_to_retirement} years to retirement · {proj.confidence_band}{' '}
                confidence
              </div>
              {proj.assumptions && proj.assumptions.length > 0 && (
                <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-2">
                  Assumptions: {proj.assumptions.join(' · ')}
                </div>
              )}
              {proj.limitations && proj.limitations.length > 0 && (
                <div className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">
                  {proj.limitations.join(' ')}
                </div>
              )}
              <div className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 font-mono">
                Tool run: {proj.tool_run_id?.slice(0, 8)}
              </div>
            </>
          ) : (
            <div className="mt-1">
              <div className="text-sm text-gray-700 dark:text-gray-300">
                {proj.message || 'A required input is missing.'}
              </div>
              <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                Missing: {(proj.missing || []).map((m) => m.input).join(', ')}
              </div>
              {(proj.missing || []).some((m) => m.input === 'current_age') && (
                <div className="mt-2 flex gap-2">
                  <input
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    placeholder="Your age"
                    inputMode="numeric"
                    className="w-24 rounded-md border border-gray-200 dark:border-gray-700 px-2 py-1 text-sm"
                  />
                  <button
                    onClick={() => loadProjection(age)}
                    disabled={!age}
                    className="px-3 py-1 rounded-md bg-indigo-600 text-white text-sm font-medium disabled:opacity-40"
                  >
                    Run projection
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {drawer && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          onClick={() => setDrawer(null)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900 dark:text-gray-100">
                {LABELS[drawer.key] ?? drawer.key}
              </h3>
              <button
                onClick={() => setDrawer(null)}
                className="text-gray-400 dark:text-gray-500 text-xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="text-2xl font-extrabold text-gray-900 dark:text-gray-100 mt-2">
              {fmt(drawer.key, drawer.field.value)}
            </div>
            <dl className="mt-3 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">Source</dt>
                <dd className="font-medium">{drawer.field.source}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">Origin</dt>
                <dd className="font-mono text-xs">{drawer.field.origin}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">Confidence</dt>
                <dd className="font-medium">
                  {drawer.field.confidence_band} ({Math.round(drawer.field.confidence * 100)}%)
                </dd>
              </div>
              {drawer.field.unlocks?.length > 0 && (
                <div className="flex justify-between">
                  <dt className="text-gray-500 dark:text-gray-400">Powers</dt>
                  <dd className="text-right">{drawer.field.unlocks.join(', ')}</dd>
                </div>
              )}
            </dl>
            <div className="mt-3 text-xs text-gray-400 dark:text-gray-500">
              This value is read from Supabase — LifeNavigator renders it, it doesn&apos;t create
              it.
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
