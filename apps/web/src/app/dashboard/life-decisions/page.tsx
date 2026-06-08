'use client';

// Life Decisions — the cross-domain Decision Engine surface. Ask "Should I…?", and the
// engine resolves it across Finance/Health/Career/Education/Family into worst/expected/best
// scenarios + cited evidence + tradeoffs + confidence + a governance boundary. No uncited
// answer; if evidence is missing the engine returns a missing-data prompt (stored=false).

import React, { useState } from 'react';

interface Scenario {
  label: string;
  outcome?: string;
  value?: number | null;
  probability?: number;
}
interface Decision {
  question: string;
  decision_type: string;
  title: string;
  description: string;
  confidence: number;
  affected_domains: string[];
  scenarios_json: Scenario[];
  evidence_json: {
    metric_name: string;
    metric_value: unknown;
    source_table: string;
    explanation?: string;
  }[];
  assumptions_json: { assumption_text: string }[];
  tradeoffs_json: { option_a?: string; option_b?: string; benefit?: string; cost?: string }[];
  governance_verdict: {
    boundary_type?: string;
    disclaimer_text?: string;
    escalation_path?: string;
  };
}
interface DecisionResult {
  stored: boolean;
  reason?: string;
  decision: Decision;
}

const EXAMPLES = [
  'Should I get an MBA or invest the money instead?',
  'Should I take the new job offer?',
  'How should I fund college for my kids?',
  'Should I delay retirement?',
];

const fmt = (v: number | null | undefined) =>
  v == null
    ? '—'
    : new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
      }).format(v);

export default function LifeDecisionsPage() {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DecisionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ask = async (q: string) => {
    const text = q.trim();
    if (!text) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const r = await fetch('/api/decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: text }),
      });
      if (!r.ok) {
        setError('Could not generate a decision right now.');
      } else {
        setResult((await r.json()) as DecisionResult);
      }
    } catch {
      setError('Could not generate a decision right now.');
    } finally {
      setLoading(false);
    }
  };

  const d = result?.decision;
  const boundary = d?.governance_verdict;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900">Life Decisions</h1>
      <p className="text-sm text-gray-500 mt-1">
        Ask a "Should I…?" question — answered across your whole financial, career, education, and
        family picture.
      </p>

      <div className="mt-5 flex gap-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && ask(question)}
          placeholder="Should I get an MBA or invest the money?"
          className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm"
        />
        <button
          onClick={() => ask(question)}
          disabled={loading}
          className="px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium disabled:opacity-50"
        >
          {loading ? 'Thinking…' : 'Decide'}
        </button>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            onClick={() => {
              setQuestion(ex);
              ask(ex);
            }}
            className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200"
          >
            {ex}
          </button>
        ))}
      </div>

      {error && <div className="mt-6 text-rose-700 text-sm">{error}</div>}

      {result && !result.stored && (
        <div className="mt-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {result.decision?.description ||
            'Not enough data yet — add the relevant domain data to evaluate this decision.'}
        </div>
      )}

      {d && result?.stored && (
        <div className="mt-6 space-y-5">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">{d.title}</h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                confidence {Math.round((d.confidence || 0) * 100)}%
              </span>
            </div>
            <p className="text-sm text-gray-700 mt-2">{d.description}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {d.affected_domains.map((dm) => (
                <span
                  key={dm}
                  className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600"
                >
                  {dm}
                </span>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {d.scenarios_json.map((s) => (
              <div key={s.label} className="bg-white p-5 rounded-lg shadow-md">
                <div className="text-xs uppercase tracking-wide text-gray-400">{s.label}</div>
                <div className="text-lg font-bold text-gray-900 mt-1">{fmt(s.value)}</div>
                {s.probability != null && (
                  <div className="text-xs text-gray-400">
                    ~{Math.round(s.probability * 100)}% likely
                  </div>
                )}
                {s.outcome && <div className="text-sm text-gray-600 mt-1">{s.outcome}</div>}
              </div>
            ))}
          </div>

          {d.evidence_json.length > 0 && (
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="font-semibold text-gray-800 mb-2">Evidence</h3>
              <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                {d.evidence_json.map((e, i) => (
                  <li key={i}>
                    <b>{e.metric_name}:</b> {String(e.metric_value)}{' '}
                    <span className="text-gray-400">({e.source_table})</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {d.tradeoffs_json.length > 0 && (
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h3 className="font-semibold text-gray-800 mb-2">Tradeoffs</h3>
              {d.tradeoffs_json.map((t, i) => (
                <p key={i} className="text-sm text-gray-700">
                  {t.option_a} vs {t.option_b} — {t.benefit} (cost: {t.cost})
                </p>
              ))}
            </div>
          )}

          {d.assumptions_json.length > 0 && (
            <div className="text-xs text-gray-500">
              Assumptions: {d.assumptions_json.map((a) => a.assumption_text).join(' · ')}
            </div>
          )}

          <div className="rounded-md border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-800">
            {boundary?.disclaimer_text ?? 'Decision support, not financial, legal, or tax advice.'}
          </div>
        </div>
      )}
    </div>
  );
}
