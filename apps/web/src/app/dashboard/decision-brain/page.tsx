'use client';

// Explainable Decision Brain (Sprint 36) — the decision sits at the center; weighted factors orbit
// it (size = weight, color = direction). Click any node to inspect why it's there and how it's
// weighted. Missing-info, excluded evidence, and the tools used are all shown — nothing hidden.
// Premium 2D radial (SVG), dark-first. (Not a 3D WebGL scene — an honest, fast, legible model.)

import React, { useCallback, useEffect, useState } from 'react';

interface Factor {
  id: string;
  label: string;
  weight: number;
  direction: 'positive' | 'negative' | 'neutral';
  confidence: number;
  source: string;
  detail: string;
  tool?: string;
}
interface Brain {
  decision_label: string;
  center: { label: string };
  factors: Factor[];
  missing_information: { label: string; detail: string }[];
  excluded_evidence: { label: string; reason: string }[];
  tools: { label: string; output: string }[];
  recommendation: {
    verdict: string;
    summary: string;
    positive_weight: number;
    negative_weight: number;
    explanation: string;
  };
}

const DIR = {
  positive: { stroke: '#34d399', fill: 'rgba(52,211,153,0.15)', text: '#6ee7b7' },
  negative: { stroke: '#fb7185', fill: 'rgba(251,113,133,0.15)', text: '#fda4af' },
  neutral: { stroke: '#94a3b8', fill: 'rgba(148,163,184,0.12)', text: '#cbd5e1' },
};
const VERDICT: Record<string, string> = {
  supported: 'text-emerald-400',
  conditional: 'text-amber-400',
  not_yet: 'text-rose-400',
};

export default function DecisionBrainPage() {
  const [decisions, setDecisions] = useState<{ key: string; label: string }[]>([]);
  const [decision, setDecision] = useState('buy_house');
  const [brain, setBrain] = useState<Brain | null>(null);
  const [sel, setSel] = useState<Factor | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/decision/brain-decisions')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setDecisions(d.decisions || []))
      .catch(() => {});
  }, []);
  const load = useCallback(async (d: string) => {
    setLoading(true);
    setSel(null);
    const b = await fetch(`/api/decision/brain/${d}`)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
    setBrain(b);
    setLoading(false);
  }, []);
  useEffect(() => {
    load(decision);
  }, [decision, load]);

  const W = 720,
    H = 480,
    cx = W / 2,
    cy = H / 2;
  const factors = brain?.factors ?? [];
  const placed = factors.map((f, i) => {
    const angle = (i / Math.max(1, factors.length)) * Math.PI * 2 - Math.PI / 2;
    const r = 150 + (i % 2) * 38;
    return {
      f,
      x: cx + Math.cos(angle) * r,
      y: cy + Math.sin(angle) * r,
      radius: 20 + f.weight * 0.7,
    };
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 px-6 py-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Decision Brain</h1>
            <p className="text-sm text-slate-400 mt-1">
              Every factor that bears on this decision — weighted, directioned, and inspectable.
              Click a node.
            </p>
          </div>
          <select
            value={decision}
            onChange={(e) => setDecision(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm"
          >
            {decisions.map((d) => (
              <option key={d.key} value={d.key}>
                {d.label}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="mt-10 text-slate-500">Modeling the decision…</div>
        ) : !brain || !brain.factors?.length ? (
          <div className="mt-10 text-slate-400">
            Complete discovery and add a document to model this decision.
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* The graph */}
            <div className="lg:col-span-2 rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-900 to-slate-950 p-2 overflow-hidden">
              <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
                {placed.map(({ f, x, y, radius }) => (
                  <line
                    key={`l-${f.id}`}
                    x1={cx}
                    y1={cy}
                    x2={x}
                    y2={y}
                    stroke={DIR[f.direction].stroke}
                    strokeOpacity={0.35}
                    strokeWidth={Math.max(1, f.weight / 10)}
                  />
                ))}
                {/* center decision */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={54}
                  fill="rgba(99,102,241,0.18)"
                  stroke="#818cf8"
                  strokeWidth={2}
                />
                <text
                  x={cx}
                  y={cy - 4}
                  textAnchor="middle"
                  className="fill-indigo-200"
                  style={{ fontSize: 13, fontWeight: 700 }}
                >
                  DECISION
                </text>
                <text
                  x={cx}
                  y={cy + 14}
                  textAnchor="middle"
                  className="fill-slate-300"
                  style={{ fontSize: 10 }}
                >
                  {brain.center.label.slice(0, 22)}
                </text>
                {placed.map(({ f, x, y, radius }) => (
                  <g key={f.id} onClick={() => setSel(f)} style={{ cursor: 'pointer' }}>
                    <circle
                      cx={x}
                      cy={y}
                      r={radius}
                      fill={DIR[f.direction].fill}
                      stroke={DIR[f.direction].stroke}
                      strokeWidth={sel?.id === f.id ? 3 : 1.5}
                    />
                    <text
                      x={x}
                      y={y - 2}
                      textAnchor="middle"
                      style={{ fontSize: 9, fill: DIR[f.direction].text }}
                    >
                      {f.label.slice(0, 14)}
                    </text>
                    <text
                      x={x}
                      y={y + 10}
                      textAnchor="middle"
                      style={{ fontSize: 10, fontWeight: 700, fill: DIR[f.direction].text }}
                    >
                      {f.weight}%
                    </text>
                  </g>
                ))}
              </svg>
            </div>

            {/* Right rail: verdict + drawer + missing + excluded + tools */}
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                <div className="text-[11px] uppercase tracking-wide text-slate-500">
                  Recommendation (an output of the factors)
                </div>
                <div
                  className={`text-lg font-bold mt-1 capitalize ${VERDICT[brain.recommendation.verdict] ?? 'text-slate-200'}`}
                >
                  {brain.recommendation.verdict.replace('_', ' ')}
                </div>
                <div className="text-sm text-slate-300 mt-1">{brain.recommendation.summary}</div>
                <div className="text-xs text-slate-500 mt-2">
                  +{brain.recommendation.positive_weight} supporting · −
                  {brain.recommendation.negative_weight} against
                </div>
              </div>

              {sel ? (
                <div className="rounded-2xl border border-slate-700 bg-slate-900 p-4">
                  <div className="text-[11px] uppercase tracking-wide text-slate-500">
                    Why this factor
                  </div>
                  <div className="font-semibold mt-0.5" style={{ color: DIR[sel.direction].text }}>
                    {sel.label}
                  </div>
                  <div className="text-sm text-slate-300 mt-1">{sel.detail}</div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-400">
                    <div>
                      Weight<div className="text-slate-200 font-semibold">{sel.weight}%</div>
                    </div>
                    <div>
                      Direction
                      <div className="text-slate-200 font-semibold capitalize">{sel.direction}</div>
                    </div>
                    <div>
                      Confidence
                      <div className="text-slate-200 font-semibold">
                        {Math.round(sel.confidence * 100)}%
                      </div>
                    </div>
                    <div>
                      Source<div className="text-slate-200 font-semibold">{sel.source}</div>
                    </div>
                  </div>
                  {sel.tool && (
                    <div className="text-xs text-slate-500 mt-2">Computed by: {sel.tool}</div>
                  )}
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-sm text-slate-500">
                  Click any orbiting node to see why it&apos;s included and how it&apos;s weighted.
                </div>
              )}

              {brain.missing_information.length > 0 && (
                <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                  <div className="text-[11px] uppercase tracking-wide text-slate-500">
                    What we don&apos;t know yet
                  </div>
                  {brain.missing_information.map((m) => (
                    <div key={m.label} className="text-sm text-slate-400 mt-1">
                      ○ {m.label}
                    </div>
                  ))}
                </div>
              )}
              {brain.excluded_evidence.length > 0 && (
                <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                  <div className="text-[11px] uppercase tracking-wide text-slate-500">
                    Considered but not used
                  </div>
                  {brain.excluded_evidence.map((e) => (
                    <div key={e.label} className="text-sm text-slate-400 mt-1">
                      {e.label} <span className="text-slate-600">— {e.reason}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                <div className="text-[11px] uppercase tracking-wide text-slate-500">Tools used</div>
                {brain.tools.map((t) => (
                  <div key={t.label} className="text-sm text-slate-300 mt-1">
                    {t.label} <span className="text-slate-500">· {t.output}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
