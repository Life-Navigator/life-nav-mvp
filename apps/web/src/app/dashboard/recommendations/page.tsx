'use client';

// Recommendation Roadmap (Sprint 28) — Now / Next / Later, not an unordered list. One highest-
// leverage action, then the next, then later. Each card is quantified (current→target→impact) with
// the visible priority formula + lifecycle actions. Same OS the dashboard/chat/reports/graph read.

import React, { useCallback, useEffect, useState } from 'react';

interface Formula {
  impact: number;
  confidence: number;
  urgency: number;
  evidence_strength: number;
  effort: number;
  priority_score: number;
}
interface Action {
  id: string;
  title: string;
  rec_type: string;
  source_module: string;
  confidence: number | null;
  current_state?: string | null;
  target_state?: string | null;
  delta?: string | null;
  quantified_impact?: Record<string, unknown>;
  why: string;
  recommended_action?: string;
  expected_benefit?: string;
  finding?: string;
  formula?: Formula;
  merged_from?: string[];
  impacted_domains?: string[];
}
interface Conflict {
  type: string;
  resource: string;
  reason: string;
  suggested_sequence: string[];
}
interface Roadmap {
  now: Action[];
  next: Action[];
  later: Action[];
  blocked_by: { id: string; title: string; why: string }[];
  conflicts: Conflict[];
  why_now?: string;
  note: string;
}

const TYPE: Record<string, string> = {
  ACTION: 'bg-indigo-100 text-indigo-700',
  RISK: 'bg-rose-100 text-rose-700',
  OPPORTUNITY: 'bg-emerald-100 text-emerald-700',
  DEPENDENCY: 'bg-amber-100 text-amber-700',
  INFORMATION: 'bg-gray-100 text-gray-600',
};

function Card({
  a,
  lead,
  onAct,
  busy,
}: {
  a: Action;
  lead?: boolean;
  onAct: (id: string, s: string) => void;
  busy: string;
}) {
  const qi = a.quantified_impact || {};
  return (
    <div
      className={`bg-white rounded-xl border p-5 ${lead ? 'border-indigo-300 shadow-md' : 'border-gray-100 shadow-sm'}`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${TYPE[a.rec_type] ?? TYPE.INFORMATION}`}
        >
          {a.rec_type}
        </span>
        <h3 className="font-semibold text-gray-900">{a.title}</h3>
      </div>
      {(a.current_state || a.target_state) && (
        <div className="mt-2 flex items-center gap-2 text-sm">
          <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700">
            Now: {a.current_state ?? '—'}
          </span>
          <span className="text-gray-400">→</span>
          <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700">
            Target: {a.target_state ?? '—'}
          </span>
          {a.delta && <span className="text-emerald-600 font-medium">{a.delta}</span>}
        </div>
      )}
      <p className="text-sm text-gray-600 mt-2">{a.why}</p>
      {a.recommended_action && (
        <p className="text-sm text-gray-700 mt-1">
          <b>Do:</b> {a.recommended_action}
        </p>
      )}
      {(qi.financial_impact_annual || qi.readiness_after) && (
        <p className="text-sm text-emerald-700 mt-1">
          {qi.financial_impact_annual
            ? `+$${Number(qi.financial_impact_annual).toLocaleString()}/yr`
            : ''}
          {qi.readiness_before && qi.readiness_after
            ? `  ·  readiness ${qi.readiness_before} → ${qi.readiness_after}`
            : ''}
        </p>
      )}
      <div className="mt-2 text-xs text-gray-400">
        {a.source_module} · confidence {Math.round((a.confidence ?? 0) * 100)}%
        {a.merged_from?.length ? ` · merged ${a.merged_from.length} related finding(s)` : ''}
        {a.formula
          ? ` · priority ${a.formula.priority_score} = I${a.formula.impact}×C${a.formula.confidence}×U${a.formula.urgency}×E${a.formula.evidence_strength}÷${a.formula.effort}`
          : ''}
      </div>
      <div className="mt-3 flex gap-2 flex-wrap">
        {[
          ['accepted', 'Accept'],
          ['in_progress', 'Start'],
          ['deferred', 'Defer'],
          ['completed', 'Complete'],
          ['dismissed', 'Dismiss'],
        ].map(([s, label]) => (
          <button
            key={s}
            disabled={busy === a.id}
            onClick={() => onAct(a.id, s)}
            className={`text-xs px-2.5 py-1 rounded-md border ${s === 'dismissed' ? 'border-gray-200 text-gray-500' : 'border-indigo-200 text-indigo-700 hover:bg-indigo-50'} disabled:opacity-40`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function RecommendationsPage() {
  const [d, setD] = useState<Roadmap | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    const r = await fetch('/api/recommendations')
      .then((x) => (x.ok ? x.json() : null))
      .catch(() => null);
    setD(r);
    setLoading(false);
  }, []);
  useEffect(() => {
    fetch('/api/recommendations', { method: 'POST' })
      .catch(() => {})
      .finally(load);
  }, [load]);

  const onAct = async (id: string, status: string) => {
    setBusy(id);
    await fetch('/api/recommendations', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    }).catch(() => {});
    await load();
    setBusy('');
  };

  if (loading)
    return <div className="max-w-4xl mx-auto px-4 py-8 text-gray-500">Building your roadmap…</div>;
  if (!d)
    return <div className="max-w-4xl mx-auto px-4 py-8 text-gray-500">Unavailable right now.</div>;

  const empty = !d.now.length && !d.next.length && !d.later.length;
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900">Your Roadmap</h1>
      <p className="text-sm text-gray-500 mt-1">
        Do <b>Now</b> first, then <b>Next</b>, then <b>Later</b> — your highest-leverage actions in
        sequence.
      </p>

      {d.conflicts.length > 0 && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {d.conflicts.map((c, i) => (
            <div key={i}>
              {c.reason}{' '}
              <span className="text-amber-600">Order: {c.suggested_sequence.join(' → ')}</span>
            </div>
          ))}
        </div>
      )}

      {empty ? (
        <div className="mt-6 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-800">
          No actions yet — upload a document (offer letter, 401k, benefits) and your roadmap appears
          here.
        </div>
      ) : (
        <>
          {d.now.length > 0 && (
            <section className="mt-6">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-bold uppercase tracking-wide text-indigo-600">
                  Now
                </span>
                {d.why_now && <span className="text-xs text-gray-400">— {d.why_now}</span>}
              </div>
              <div className="space-y-3">
                {d.now.map((a) => (
                  <Card key={a.id} a={a} lead onAct={onAct} busy={busy} />
                ))}
              </div>
            </section>
          )}
          {d.next.length > 0 && (
            <section className="mt-6">
              <div className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">
                Next
              </div>
              <div className="space-y-3">
                {d.next.map((a) => (
                  <Card key={a.id} a={a} onAct={onAct} busy={busy} />
                ))}
              </div>
            </section>
          )}
          {d.later.length > 0 && (
            <section className="mt-6">
              <div className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">
                Later
              </div>
              <div className="space-y-3">
                {d.later.map((a) => (
                  <Card key={a.id} a={a} onAct={onAct} busy={busy} />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {d.blocked_by.length > 0 && (
        <section className="mt-6">
          <div className="text-xs font-bold uppercase tracking-wide text-amber-600 mb-2">
            Unlock more by uploading
          </div>
          <div className="space-y-2">
            {d.blocked_by.map((b) => (
              <a
                key={b.id}
                href="/dashboard/documents"
                className="block bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 text-sm text-amber-800 hover:bg-amber-100"
              >
                {b.title} <span className="text-amber-600">— {b.why}</span>
              </a>
            ))}
          </div>
        </section>
      )}
      <p className="mt-6 text-xs text-gray-400">{d.note}</p>
    </div>
  );
}
