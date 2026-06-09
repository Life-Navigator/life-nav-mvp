'use client';

// Compare Futures (Sprint 37) — side-by-side competing paths. Per the sprint guardrails this is
// intelligence, not aesthetics: a clean comparison of objective impacts, tradeoffs, confidence,
// and the assumptions that drive each difference. No 3D, no polish — just the comparison.

import React, { useCallback, useEffect, useState } from 'react';

interface Impact {
  objective: string;
  root: string;
  score: number;
  is_primary: boolean;
}
interface Scenario {
  scenario_id: string;
  name: string;
  confidence: number;
  net_objective_score: number;
  objective_impacts: Impact[];
  tradeoffs: { improves: string[]; worsens: string[] };
  assumptions: { key: string; label: string; value: number | string }[];
  missing_inputs: string[];
}
interface Comparison {
  question: string;
  primary_objective: string | null;
  scenarios: Scenario[];
  best_for_primary_objective: string | null;
  tradeoff_summary: string[];
  note: string;
}

const score = (n: number) => (n > 0 ? `+${n}` : `${n}`);
const scoreColor = (n: number) =>
  n > 0 ? 'text-emerald-600' : n < 0 ? 'text-rose-600' : 'text-gray-500';

export default function CompareFuturesPage() {
  const [sets, setSets] = useState<{ key: string; question: string }[]>([]);
  const [setKey, setSetKey] = useState('housing');
  const [data, setData] = useState<Comparison | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/decision/compare-sets')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setSets(d.sets || []))
      .catch(() => {});
  }, []);
  const load = useCallback(async (k: string) => {
    setLoading(true);
    const d = await fetch(`/api/decision/compare/${k}`)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
    setData(d);
    setLoading(false);
  }, []);
  useEffect(() => {
    load(setKey);
  }, [setKey, load]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Compare Futures</h1>
          <p className="text-sm text-gray-500 mt-1">
            See the likely outcomes of each path, then choose — not a single answer.
          </p>
        </div>
        <select
          value={setKey}
          onChange={(e) => setSetKey(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
        >
          {sets.map((s) => (
            <option key={s.key} value={s.key}>
              {s.question}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="mt-8 text-gray-500">Comparing futures…</div>
      ) : !data || !data.scenarios?.length ? (
        <div className="mt-8 text-gray-500">Unavailable — complete discovery first.</div>
      ) : (
        <>
          <div className="mt-4 text-sm text-gray-700">
            <b>{data.question}</b>
            {data.best_for_primary_objective && (
              <span className="ml-2 text-indigo-700">
                Best for your primary objective: {data.best_for_primary_objective}
              </span>
            )}
          </div>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            {data.scenarios.map((s) => (
              <div
                key={s.scenario_id}
                className={`bg-white rounded-xl border p-5 ${s.name === data.best_for_primary_objective ? 'border-indigo-300 ring-1 ring-indigo-200' : 'border-gray-100'}`}
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">{s.name}</h3>
                  <span className="text-xs text-gray-400">
                    conf {Math.round(s.confidence * 100)}%
                  </span>
                </div>
                <div className="mt-3">
                  <div className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold">
                    Objective impact
                  </div>
                  {s.objective_impacts.map((i) => (
                    <div key={i.root} className="flex items-center justify-between text-sm mt-1">
                      <span
                        className={i.is_primary ? 'font-semibold text-gray-900' : 'text-gray-600'}
                      >
                        {i.objective}
                        {i.is_primary ? ' ★' : ''}
                      </span>
                      <span className={`font-semibold ${scoreColor(i.score)}`}>
                        {score(i.score)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 text-sm">
                  <div className="text-emerald-700">
                    <b>Improves:</b> {s.tradeoffs.improves.join(', ')}
                  </div>
                  <div className="text-rose-700 mt-1">
                    <b>Worsens:</b> {s.tradeoffs.worsens.join(', ')}
                  </div>
                </div>
                {s.assumptions.length > 0 && (
                  <div className="mt-3 text-xs text-gray-400">
                    Assumes:{' '}
                    {s.assumptions
                      .map(
                        (a) =>
                          `${a.label} ${typeof a.value === 'number' && a.value < 1 ? `${Math.round(a.value * 100)}%` : a.value}`
                      )
                      .join(' · ')}
                  </div>
                )}
                {s.missing_inputs.length > 0 && (
                  <div className="mt-1 text-xs text-amber-600">
                    Needs: {s.missing_inputs.join(', ')} (would raise confidence)
                  </div>
                )}
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-gray-400">{data.note}</p>
        </>
      )}
    </div>
  );
}
