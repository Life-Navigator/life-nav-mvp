'use client';

/**
 * Pilot Analytics Dashboard (admin-only) — aggregates the existing pilot feedback instruments
 * against the Pilot Success Gates. Reads the EXISTING rollup at /api/admin/pilot-analytics
 * (proxied to Core API /v1/admin/pilot-analytics). Counts/rates only — no PII, no user content.
 *
 * Honesty rules:
 *  - When total_feedback_rows is 0, or a given metric has no responses, we show "No responses yet"
 *    — NEVER a fabricated number and NEVER a fake gate pass.
 *  - Response counts are shown on every gate so thin data is obvious.
 *  - A 403 from the proxy renders an "admin only" state (the endpoint is admin-gated upstream).
 */

import React, { useEffect, useState } from 'react';

// ---- Upstream payload shape (subset we read) -------------------------------------------------

interface Averages {
  narrative_accuracy?: number;
  trust?: number;
  understanding?: number;
  personalization?: number;
  usefulness?: number;
  actionability?: number;
  recommendation_quality?: number;
  return_intent?: number;
  would_pay?: number;
  recommend_to_clients?: number;
  solves_problem?: number;
}

interface Instruments {
  averages?: Averages;
  response_counts?: Record<string, number>;
  insight_rate?: number | null;
  insight_responses?: number;
  holy_shit_rate?: number | null;
  holy_shit_responses?: number;
  total_feedback_rows?: number;
}

interface PilotAnalytics {
  advisor?: { total_turns?: number; enhanced_turns?: number; enhanced_rate?: number | null };
  safety?: { safety_fallback_turns?: number };
  feedback?: { nps_score?: number | null; nps_responses?: number };
  instruments?: Instruments;
}

// ---- Gate definitions ------------------------------------------------------------------------
// kind 'score10' → 0-10 average, gate is a minimum (>); 'rate' → 0-1 fraction, gate is %.

type GateKind = 'score10' | 'rate';

interface GateDef {
  key: string;
  label: string;
  kind: GateKind;
  /** Gate threshold. score10: raw 0-10. rate: fraction 0-1 (display as %). */
  threshold: number;
  thresholdLabel: string;
}

const PRIMARY_GATES: GateDef[] = [
  {
    key: 'narrative_accuracy',
    label: 'Narrative Accuracy',
    kind: 'score10',
    threshold: 8.5,
    thresholdLabel: '> 8.5',
  },
  { key: 'trust', label: 'Trust', kind: 'score10', threshold: 8.0, thresholdLabel: '> 8.0' },
  {
    key: 'recommendation_quality',
    label: 'Recommendation Quality',
    kind: 'score10',
    threshold: 8.0,
    thresholdLabel: '> 8.0',
  },
  {
    key: 'return_intent',
    label: 'Return Intent',
    kind: 'score10',
    threshold: 8.0,
    thresholdLabel: '> 8.0',
  },
  {
    key: 'nps',
    label: 'Net Promoter Score',
    kind: 'score10',
    threshold: 50,
    thresholdLabel: '> 50',
  }, // special-cased below
  {
    key: 'insight_rate',
    label: 'Insight Rate',
    kind: 'rate',
    threshold: 0.7,
    thresholdLabel: '> 70%',
  },
  {
    key: 'holy_shit_rate',
    label: 'Holy-Shit Rate',
    kind: 'rate',
    threshold: 0.5,
    thresholdLabel: '> 50%',
  },
];

const SECONDARY: { key: keyof Averages; label: string }[] = [
  { key: 'understanding', label: 'Understanding' },
  { key: 'personalization', label: 'Personalization' },
  { key: 'usefulness', label: 'Usefulness' },
  { key: 'actionability', label: 'Actionability' },
  { key: 'would_pay', label: 'Would Pay' },
  { key: 'recommend_to_clients', label: 'Recommend to Clients' },
  { key: 'solves_problem', label: 'Solves Problem' },
];

// ---- Presentational atoms --------------------------------------------------------------------

function fmtScore(v: number | null | undefined): string {
  return v === null || v === undefined ? '—' : v.toFixed(1);
}
function fmtPct(v: number | null | undefined): string {
  return v === null || v === undefined ? '—' : `${Math.round(v * 100)}%`;
}

/**
 * A gate card. When there are no responses for the metric, renders the honest empty state and is
 * never scored as a pass/fail. Otherwise shows value, threshold, response count, and pass/fail.
 */
function GateCard({
  label,
  display,
  thresholdLabel,
  responses,
  pass,
}: {
  label: string;
  display: string;
  thresholdLabel: string;
  responses: number;
  pass: boolean | null;
}) {
  const hasData = responses > 0 && pass !== null;
  const tone = !hasData
    ? 'border-slate-200 bg-white'
    : pass
      ? 'border-emerald-300 bg-emerald-50'
      : 'border-rose-300 bg-rose-50';
  const valueTone = !hasData ? 'text-slate-300' : pass ? 'text-emerald-700' : 'text-rose-700';

  return (
    <div data-testid={`gate-${label}`} className={`rounded-xl border p-5 shadow-sm ${tone}`}>
      <div className="flex items-start justify-between">
        <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          gate {thresholdLabel}
        </span>
      </div>
      {hasData ? (
        <>
          <div className={`mt-2 text-3xl font-bold ${valueTone}`}>{display}</div>
          <div className="mt-1 flex items-center justify-between text-xs">
            <span className={`font-semibold ${pass ? 'text-emerald-600' : 'text-rose-600'}`}>
              {pass ? 'PASS' : 'BELOW GATE'}
            </span>
            <span className="text-slate-400">
              {responses} {responses === 1 ? 'response' : 'responses'}
            </span>
          </div>
        </>
      ) : (
        <>
          <div className="mt-2 text-base font-medium text-slate-400">No responses yet</div>
          <div className="mt-1 text-xs text-slate-400">Awaiting pilot feedback</div>
        </>
      )}
    </div>
  );
}

function SecondaryStat({
  label,
  value,
  responses,
}: {
  label: string;
  value: string;
  responses: number;
}) {
  const hasData = responses > 0;
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</div>
      {hasData ? (
        <>
          <div className="mt-1 text-xl font-semibold text-slate-800">{value}</div>
          <div className="text-[11px] text-slate-400">{responses} resp.</div>
        </>
      ) : (
        <div className="mt-1 text-sm text-slate-300">No responses yet</div>
      )}
    </div>
  );
}

// ---- Page ------------------------------------------------------------------------------------

export default function PilotAnalyticsPage() {
  const [data, setData] = useState<PilotAnalytics | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'forbidden' | 'error'>('loading');

  useEffect(() => {
    let active = true;
    fetch('/api/admin/pilot-analytics')
      .then(async (r) => {
        if (!active) return;
        if (r.status === 403) {
          setStatus('forbidden');
          return;
        }
        if (!r.ok) {
          setStatus('error');
          return;
        }
        setData((await r.json()) as PilotAnalytics);
        setStatus('ready');
      })
      .catch(() => {
        if (active) setStatus('error');
      });
    return () => {
      active = false;
    };
  }, []);

  if (status === 'loading')
    return (
      <div className="mx-auto max-w-6xl px-4 py-10 text-slate-500" data-testid="pilot-loading">
        Loading pilot analytics…
      </div>
    );

  if (status === 'forbidden')
    return (
      <div className="mx-auto max-w-6xl px-4 py-16" data-testid="pilot-forbidden">
        <h1 className="text-xl font-bold text-slate-900">Admin only</h1>
        <p className="mt-2 text-sm text-slate-500">
          The Pilot Analytics Dashboard is restricted to platform administrators.
        </p>
      </div>
    );

  if (status === 'error' || !data)
    return (
      <div className="mx-auto max-w-6xl px-4 py-16 text-slate-500" data-testid="pilot-error">
        Pilot analytics unavailable. Please try again.
      </div>
    );

  const instruments = data.instruments ?? {};
  const averages = instruments.averages ?? {};
  const counts = instruments.response_counts ?? {};
  const totalRows = instruments.total_feedback_rows ?? 0;

  // Honest top-level empty state: no feedback rows at all.
  const noData = totalRows === 0;

  // Resolve a primary gate into its display value, response count, and pass/fail (null = no data).
  function resolveGate(g: GateDef): { display: string; responses: number; pass: boolean | null } {
    if (g.kind === 'rate') {
      const rate = g.key === 'insight_rate' ? instruments.insight_rate : instruments.holy_shit_rate;
      const responses =
        g.key === 'insight_rate'
          ? (instruments.insight_responses ?? 0)
          : (instruments.holy_shit_responses ?? 0);
      if (responses === 0 || rate === null || rate === undefined)
        return { display: '—', responses, pass: null };
      return { display: fmtPct(rate), responses, pass: rate > g.threshold };
    }
    if (g.key === 'nps') {
      const responses = data.feedback?.nps_responses ?? 0;
      const score = data.feedback?.nps_score;
      if (responses === 0 || score === null || score === undefined)
        return { display: '—', responses, pass: null };
      return { display: String(score), responses, pass: score > g.threshold };
    }
    // score10 instruments (averages map)
    const v = averages[g.key as keyof Averages];
    const responses = counts[g.key] ?? 0;
    if (responses === 0 || v === null || v === undefined)
      return { display: '—', responses, pass: null };
    return { display: fmtScore(v), responses, pass: v > g.threshold };
  }

  const enhancedRate = data.advisor?.enhanced_rate;
  const safetyFallback = data.safety?.safety_fallback_turns ?? 0;
  const totalTurns = data.advisor?.total_turns ?? 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-bold text-slate-900">Pilot Analytics</h1>
        <p className="mt-1 text-sm text-slate-500">
          Pilot Success Gates — aggregate counts and rates only, no user content.
        </p>
      </div>

      {noData ? (
        <div
          className="mt-8 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center"
          data-testid="pilot-empty"
        >
          <div className="text-lg font-semibold text-slate-700">No responses yet</div>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
            No pilot feedback has been collected. Gate pass/fail will appear once participants
            submit instrumented feedback.
          </p>
        </div>
      ) : (
        <p className="mt-4 text-xs text-slate-400" data-testid="pilot-total-rows">
          Based on {totalRows} feedback {totalRows === 1 ? 'row' : 'rows'}.
        </p>
      )}

      {/* Primary success gates */}
      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-teal-700">
        Success Gates
      </h2>
      <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PRIMARY_GATES.map((g) => {
          const r = resolveGate(g);
          return (
            <GateCard
              key={g.key}
              label={g.label}
              display={r.display}
              thresholdLabel={g.thresholdLabel}
              responses={r.responses}
              pass={r.pass}
            />
          );
        })}
      </div>

      {/* Secondary instruments */}
      <h2 className="mt-10 text-sm font-semibold uppercase tracking-wide text-teal-700">
        Secondary Instruments &amp; Executive Value
      </h2>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {SECONDARY.map((s) => (
          <SecondaryStat
            key={s.key}
            label={s.label}
            value={fmtScore(averages[s.key])}
            responses={counts[s.key as string] ?? 0}
          />
        ))}
      </div>

      {/* Advisor + safety telemetry */}
      <h2 className="mt-10 text-sm font-semibold uppercase tracking-wide text-teal-700">
        Advisor &amp; Safety
      </h2>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div
          className="rounded-lg border border-slate-200 bg-white p-4"
          data-testid="advisor-enhanced"
        >
          <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
            Advisor Enhanced Rate
          </div>
          {totalTurns > 0 && enhancedRate !== null && enhancedRate !== undefined ? (
            <>
              <div className="mt-1 text-xl font-semibold text-slate-800">
                {fmtPct(enhancedRate)}
              </div>
              <div className="text-[11px] text-slate-400">{totalTurns} turns</div>
            </>
          ) : (
            <div className="mt-1 text-sm text-slate-300">No responses yet</div>
          )}
        </div>
        <div
          className="rounded-lg border border-slate-200 bg-white p-4"
          data-testid="safety-fallback"
        >
          <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
            Safety Fallback Turns
          </div>
          <div className="mt-1 text-xl font-semibold text-slate-800">{safetyFallback}</div>
          <div className="text-[11px] text-slate-400">deterministic safety net</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
            Total Feedback Rows
          </div>
          <div className="mt-1 text-xl font-semibold text-slate-800">{totalRows}</div>
          <div className="text-[11px] text-slate-400">instrumented responses</div>
        </div>
      </div>
    </div>
  );
}
