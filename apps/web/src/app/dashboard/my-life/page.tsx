'use client';

// My Life (Sprint 44) — the flagship Life-OS page. Organized around the user's life, not domains:
// Vision → What Matters Most → Readiness → Next Best Action → Constraints → Recent Intelligence.
// One fetch from the canonical model; every section is source-labeled.

import Link from 'next/link';
import React, { useEffect, useState } from 'react';

type Status = 'green' | 'yellow' | 'orange' | 'red';
interface MyLife {
  has_discovery: boolean;
  life_vision: {
    life_vision: string | null;
    primary_objective: string | null;
    confidence_pct: number;
    discovery_completion_pct: number;
    source: string;
  };
  what_matters_most: {
    primary_objective: string | null;
    reasoning?: string;
    depends_on: string[];
    risks: string[];
    constraints: string[];
    opportunities: string[];
    supporting_objectives: string[];
    source: string;
  };
  life_readiness: {
    overall: number | null;
    status?: Status;
    domains: { domain: string; progress: number; status: Status; gap?: string }[];
    source: string;
  };
  next_best_action: {
    title: string;
    why?: string;
    recommended_action?: string;
    expected_benefit?: string;
    confidence_pct: number;
    quantified_impact?: Record<string, unknown>;
    source: string;
  } | null;
  constraints: { label: string; detail?: string; source: string }[];
  recent_intelligence: { type: string; label: string; when?: string }[];
}

const DOT: Record<Status, string> = {
  green: 'bg-emerald-500',
  yellow: 'bg-amber-400',
  orange: 'bg-orange-500',
  red: 'bg-rose-500',
};
const Src = ({ s }: { s: string }) => (
  <span className="text-[10px] text-gray-400">Source: {s}</span>
);

export default function MyLifePage() {
  const [d, setD] = useState<MyLife | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch('/api/life/my-life')
      .then((r) => (r.ok ? r.json() : null))
      .then((x) => {
        setD(x);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading)
    return <div className="max-w-5xl mx-auto px-4 py-8 text-gray-500">Loading your life…</div>;
  if (!d || !d.has_discovery) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10 text-center">
        <h1 className="text-2xl font-bold text-gray-900">My Life</h1>
        <p className="mt-2 text-gray-600">
          Your life operating system is built from a 5-minute conversation with your advisor.
        </p>
        <Link
          href="/dashboard/advisor"
          className="mt-4 inline-flex px-5 py-2.5 rounded-lg bg-indigo-600 text-white font-medium"
        >
          Talk to your advisor →
        </Link>
      </div>
    );
  }
  const v = d.life_vision;
  const w = d.what_matters_most;
  const r = d.life_readiness;
  const a = d.next_best_action;
  const qi = (a?.quantified_impact || {}) as Record<string, number>;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-5">
      <h1 className="text-2xl font-bold text-gray-900">My Life</h1>

      {/* 1 — Life Vision (north star) */}
      <section className="rounded-2xl border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-6">
        {v.life_vision && <div className="text-lg text-gray-800 italic">“{v.life_vision}”</div>}
        <div className="mt-3 flex flex-wrap gap-6">
          <div>
            <div className="text-[11px] uppercase text-gray-400 font-semibold">
              Primary objective
            </div>
            <div className="text-xl font-bold text-gray-900">{v.primary_objective ?? '—'}</div>
          </div>
          <div>
            <div className="text-[11px] uppercase text-gray-400 font-semibold">Confidence</div>
            <div className="text-xl font-bold text-gray-900">{v.confidence_pct}%</div>
          </div>
          <div>
            <div className="text-[11px] uppercase text-gray-400 font-semibold">Discovery</div>
            <div className="text-xl font-bold text-gray-900">{v.discovery_completion_pct}%</div>
          </div>
        </div>
        <div className="mt-2">
          <Src s={v.source} />
        </div>
      </section>

      {/* 4 — Next Best Action (one) */}
      {a && (
        <section className="rounded-2xl border border-gray-100 bg-white shadow-sm p-6">
          <div className="text-[11px] uppercase tracking-wide text-indigo-500 font-semibold">
            Your next best move
          </div>
          <div className="text-lg font-bold text-gray-900 mt-1">{a.title}</div>
          {a.why && <div className="text-sm text-gray-600 mt-1">{a.why}</div>}
          <div className="mt-2 text-sm text-emerald-700 font-medium">
            {qi.financial_impact_annual
              ? `+$${Number(qi.financial_impact_annual).toLocaleString()}/yr · `
              : ''}
            {qi.retirement_success_before_pct
              ? `retirement success ${qi.retirement_success_before_pct}% → ${qi.retirement_success_after_pct}% · `
              : ''}
            confidence {a.confidence_pct}%
          </div>
          <div className="mt-2">
            <Src s={a.source} />
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* 2 — What Matters Most */}
        <section className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5">
          <h2 className="text-sm font-bold text-gray-800">What matters most</h2>
          <div className="text-lg font-semibold text-gray-900 mt-1">{w.primary_objective}</div>
          {w.reasoning && <div className="text-xs text-gray-500 mt-0.5">{w.reasoning}</div>}
          <div className="mt-2 text-[11px] uppercase text-gray-400 font-semibold">Depends on</div>
          <div className="mt-1 flex flex-wrap gap-1">
            {w.depends_on.map((x) => (
              <span
                key={x}
                className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700"
              >
                {x}
              </span>
            ))}
          </div>
          {w.supporting_objectives.length > 0 && (
            <div className="mt-2 text-xs text-gray-500">
              Also: {w.supporting_objectives.join(' · ')}
            </div>
          )}
          <div className="mt-2">
            <Src s={w.source} />
          </div>
        </section>

        {/* 3 — Life Readiness */}
        <section className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5">
          <h2 className="text-sm font-bold text-gray-800">
            Life readiness{' '}
            <span className="text-gray-400 font-normal">· overall {r.overall ?? '—'}</span>
          </h2>
          <div className="mt-2 space-y-1.5">
            {r.domains.map((dm) => (
              <div key={dm.domain} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 capitalize">
                  <span className={`w-2 h-2 rounded-full ${DOT[dm.status] ?? 'bg-gray-300'}`} />
                  {dm.domain}
                </span>
                <span className="text-gray-500">{dm.progress}%</span>
              </div>
            ))}
            {r.domains.length === 0 && (
              <div className="text-sm text-gray-400">Complete discovery to populate readiness.</div>
            )}
          </div>
          <div className="mt-2">
            <Src s={r.source} />
          </div>
        </section>

        {/* 5 — Constraints */}
        <section className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5">
          <h2 className="text-sm font-bold text-rose-700">What's blocking you</h2>
          <div className="mt-2 space-y-1.5">
            {d.constraints.map((c, i) => (
              <div key={i} className="text-sm text-gray-700">
                {c.label}
                {c.detail ? <span className="block text-xs text-gray-400">{c.detail}</span> : null}
              </div>
            ))}
            {d.constraints.length === 0 && (
              <div className="text-sm text-gray-400">No blockers flagged.</div>
            )}
          </div>
        </section>

        {/* 6 — Recent Intelligence */}
        <section className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5">
          <h2 className="text-sm font-bold text-gray-800">Recent intelligence</h2>
          <div className="mt-2 space-y-1.5">
            {d.recent_intelligence.map((f, i) => (
              <div key={i} className="text-sm text-gray-700">
                • {f.label}
              </div>
            ))}
            {d.recent_intelligence.length === 0 && (
              <div className="text-sm text-gray-400">Your activity will appear here.</div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
