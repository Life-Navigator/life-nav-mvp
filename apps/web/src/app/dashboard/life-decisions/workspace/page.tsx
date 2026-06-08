'use client';

// Decision Workspace (Sprint 14) — pick a preset life decision; LifeNavigator assembles a
// workspace: tradeoffs, evidence, confidence, and the projected READINESS IMPACT (how it moves
// the Life Readiness Index + each domain). Ties decisions to the readiness command center.

import React, { useEffect, useState } from 'react';

type Status = 'green' | 'yellow' | 'orange' | 'red';
interface Preset {
  decision_type: string;
  label: string;
  question: string;
  affected_domains: string[];
}
interface DomainDelta {
  domain: string;
  current: number;
  projected: number;
  delta: number;
  direction: string;
  rationale: string;
}
interface Workspace {
  decision_type: string;
  label: string;
  question: string;
  verdict?: string;
  confidence?: number;
  scenarios: { label: string; value?: number | null }[];
  tradeoffs: { option_a?: string; option_b?: string; benefit?: string; cost?: string }[];
  evidence: { metric_name?: string; metric_value?: unknown; source_table?: string }[];
  readiness_impact: {
    current_index: number;
    current_status: Status;
    projected_index: number;
    projected_status: Status;
    index_delta: number;
    domain_deltas: DomainDelta[];
    note: string;
  };
  next_steps: string[];
  boundary?: { disclaimer_text?: string };
}

const COLOR: Record<Status, string> = {
  green: 'text-emerald-600',
  yellow: 'text-amber-600',
  orange: 'text-orange-600',
  red: 'text-rose-600',
};
const money = (v: unknown) => (typeof v === 'number' ? `$${Math.round(v).toLocaleString()}` : '—');

export default function WorkspacePage() {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [ws, setWs] = useState<Workspace | null>(null);
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState('');

  useEffect(() => {
    fetch('/api/decision/workspace').then(async (r) =>
      r.ok ? setPresets((await r.json()).types || []) : null
    );
  }, []);

  const open = async (decision_type: string) => {
    setBusy(true);
    setActive(decision_type);
    setWs(null);
    try {
      const r = await fetch('/api/decision/workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision_type }),
      });
      if (r.ok) setWs(await r.json());
    } finally {
      setBusy(false);
    }
  };

  const ri = ws?.readiness_impact;
  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900">Decision Workspace</h1>
      <p className="text-sm text-gray-500 mt-1">
        Pick a decision — see the tradeoffs, the evidence, and how it moves your Life Readiness.
      </p>

      <div className="mt-5 grid grid-cols-2 md:grid-cols-5 gap-3">
        {presets.map((p) => (
          <button
            key={p.decision_type}
            onClick={() => open(p.decision_type)}
            disabled={busy}
            className={`rounded-lg border p-4 text-center text-sm font-medium transition ${active === p.decision_type ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-gray-200 bg-white text-gray-700 hover:border-indigo-300'}`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {busy && <div className="mt-6 text-gray-500">Building your decision workspace…</div>}

      {ws && ri && (
        <div className="mt-6 space-y-5">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                {ws.label}: {ws.question}
              </h2>
              {ws.confidence != null && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                  confidence {Math.round(ws.confidence * 100)}%
                </span>
              )}
            </div>
            {ws.verdict && <p className="text-sm text-gray-700 mt-2">{ws.verdict}</p>}
          </div>

          {/* Readiness impact — the cohesive piece */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="font-semibold text-gray-800 mb-3">
              Readiness Impact <span className="text-xs text-gray-400">(projected)</span>
            </h3>
            <div className="flex items-center gap-4">
              <div className="text-center">
                <div className={`text-3xl font-extrabold ${COLOR[ri.current_status]}`}>
                  {ri.current_index}
                </div>
                <div className="text-xs text-gray-400">today</div>
              </div>
              <div className="text-2xl text-gray-300">→</div>
              <div className="text-center">
                <div className={`text-3xl font-extrabold ${COLOR[ri.projected_status]}`}>
                  {ri.projected_index}
                </div>
                <div className="text-xs text-gray-400">after this decision</div>
              </div>
              <div
                className={`ml-2 text-sm font-semibold ${ri.index_delta >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}
              >
                {ri.index_delta >= 0 ? '+' : ''}
                {ri.index_delta} index
              </div>
            </div>
            <div className="mt-4 space-y-2">
              {ri.domain_deltas.map((d) => (
                <div key={d.domain} className="text-sm">
                  <div className="flex items-center justify-between">
                    <span className="capitalize text-gray-700">{d.domain}</span>
                    <span className={d.delta >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                      {d.current} → {d.projected} ({d.delta >= 0 ? '+' : ''}
                      {d.delta})
                    </span>
                  </div>
                  <div className="text-xs text-gray-400">{d.rationale}</div>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-3">{ri.note}</p>
          </div>

          {ws.scenarios.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {ws.scenarios.map((s) => (
                <div key={s.label} className="bg-white rounded-lg shadow-md p-4">
                  <div className="text-xs uppercase tracking-wide text-gray-400">{s.label}</div>
                  <div className="text-lg font-bold text-gray-900 mt-1">{money(s.value)}</div>
                </div>
              ))}
            </div>
          )}

          {ws.tradeoffs.length > 0 && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="font-semibold text-gray-800 mb-2">Tradeoffs</h3>
              {ws.tradeoffs.map((t, i) => (
                <p key={i} className="text-sm text-gray-700">
                  {t.option_a} vs {t.option_b} — {t.benefit} (cost: {t.cost})
                </p>
              ))}
            </div>
          )}

          {ws.evidence.length > 0 && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="font-semibold text-gray-800 mb-2">Evidence</h3>
              <ul className="list-disc list-inside text-sm text-gray-700">
                {ws.evidence.map((e, i) => (
                  <li key={i}>
                    {e.metric_name}: {String(e.metric_value)}{' '}
                    <span className="text-gray-400">({e.source_table})</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {ws.next_steps.length > 0 && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="font-semibold text-gray-800 mb-2">Next steps</h3>
              <ul className="list-disc list-inside text-sm text-gray-700">
                {ws.next_steps.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="rounded-md border border-indigo-200 bg-indigo-50 px-4 py-3 text-xs text-indigo-800">
            {ws.boundary?.disclaimer_text ??
              'Decision support, not financial, legal, or tax advice.'}
          </div>
        </div>
      )}
    </div>
  );
}
