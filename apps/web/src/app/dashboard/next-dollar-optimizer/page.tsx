'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import type { OptimizerOutput, OptimizerAllocation } from '@/types/optimizer';

interface RunResponse {
  success: boolean;
  run_id: string;
  output: OptimizerOutput;
}

const CATEGORY_LABEL: Record<string, string> = {
  emergency_fund: 'Emergency fund',
  high_interest_debt: 'High-APR debt',
  low_interest_debt: 'Low-APR debt',
  retirement_match: 'Employer 401(k) match',
  retirement_contribution: 'Retirement contribution',
  hsa_contribution: 'HSA contribution',
  taxable_investing: 'Taxable investing',
  education_investment: 'Education investment',
  career_development: 'Career development',
  insurance_gap_coverage: 'Insurance coverage gap',
  health_wellness_investment: 'Health & wellness',
  home_down_payment_fund: 'Home down-payment fund',
  cash_reserve: 'Cash reserve',
};

function fmtUsd(n: number): string {
  return n.toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
}

export default function NextDollarOptimizerPage() {
  const [surplus, setSurplus] = useState<number>(500);
  const [statedGoal, setStatedGoal] = useState<string>('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [decision, setDecision] = useState<'accepted' | 'rejected' | null>(null);

  const runOptimizer = async () => {
    setRunning(true);
    setError(null);
    setResult(null);
    setDecision(null);
    try {
      const res = await fetch('/api/optimizer/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          monthly_surplus: surplus,
          stated_goal: statedGoal.trim() || undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? 'Optimizer failed');
      setResult(body as RunResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'optimizer failed');
    } finally {
      setRunning(false);
    }
  };

  const respond = async (action: 'accept' | 'reject') => {
    if (!result) return;
    const res = await fetch(`/api/optimizer/runs/${result.run_id}/${action}`, {
      method: 'POST',
    });
    if (res.ok) setDecision(action === 'accept' ? 'accepted' : 'rejected');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-10 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <header className="space-y-2">
          <Link href="/dashboard" className="text-sm text-blue-600 hover:underline">
            ← Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Next-Dollar Optimizer
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Tell us how much you have to allocate this month. The optimizer reads your User Graph —
            debts, emergency fund, employer match, insurance gaps, decision preferences, and your
            declared goals — and proposes a split that moves your true goal forward. It's planning
            guidance, not specific investment advice.
          </p>
        </header>

        <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <label>
              <span className="block text-gray-700 dark:text-gray-200 mb-1">
                Monthly surplus (USD)
              </span>
              <input
                type="number"
                min={0}
                step={50}
                value={surplus}
                onChange={(e) => setSurplus(Number(e.target.value || 0))}
                className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2"
              />
            </label>
            <label className="sm:col-span-1">
              <span className="block text-gray-700 dark:text-gray-200 mb-1">
                Stated goal (optional)
              </span>
              <input
                type="text"
                value={statedGoal}
                onChange={(e) => setStatedGoal(e.target.value)}
                placeholder='e.g. "pay off my credit cards" or "save for a house"'
                className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2"
              />
            </label>
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={runOptimizer}
              disabled={running || surplus <= 0}
              className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm disabled:bg-blue-400"
            >
              {running ? 'Running…' : 'Run optimizer'}
            </button>
          </div>
          {error && (
            <div className="rounded border border-red-300 bg-red-50 p-2 text-xs text-red-800">
              {error}
            </div>
          )}
        </section>

        {result && (
          <>
            <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3">
              <h2 className="font-semibold text-gray-900 dark:text-white">Inferred goal</h2>
              <dl className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                <Row label="You stated" value={result.output.stated_goal} />
                <Row label="What this likely means" value={result.output.inferred_true_goal} />
                <Row label="Confidence" value={`${Math.round(result.output.confidence * 100)}%`} />
              </dl>
            </section>

            <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3">
              <h2 className="font-semibold text-gray-900 dark:text-white">
                Recommended allocation
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Of {fmtUsd(result.output.monthly_surplus)} this month:
              </p>
              <ul className="space-y-2">
                {result.output.allocations.map((a) => (
                  <AllocationRow key={a.category} a={a} surplus={result.output.monthly_surplus} />
                ))}
              </ul>
            </section>

            <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-2">
              <h2 className="font-semibold text-gray-900 dark:text-white">Tradeoffs</h2>
              {result.output.tradeoffs.length === 0 ? (
                <p className="text-sm italic text-gray-500">
                  No major pairwise tradeoffs surfaced for this plan.
                </p>
              ) : (
                <ul className="text-sm space-y-1">
                  {result.output.tradeoffs.map((t, i) => (
                    <li key={i}>
                      <span className="font-medium">
                        {CATEGORY_LABEL[t.axis_a]} ↔ {CATEGORY_LABEL[t.axis_b]}
                      </span>
                      : {t.summary}{' '}
                      <span className="text-xs text-gray-500">
                        (
                        {t.favored_axis === 'a'
                          ? `favors ${CATEGORY_LABEL[t.axis_a]}`
                          : t.favored_axis === 'b'
                            ? `favors ${CATEGORY_LABEL[t.axis_b]}`
                            : 'balanced'}
                        )
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-2">
              <h2 className="font-semibold text-gray-900 dark:text-white">Assumptions</h2>
              <ul className="text-xs text-gray-600 dark:text-gray-300 space-y-1">
                {result.output.assumptions.map((a) => (
                  <li key={a.key}>
                    <span className="font-mono">{a.key}</span>: {a.rationale}
                  </li>
                ))}
              </ul>
            </section>

            <section className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 space-y-3">
              <h2 className="font-semibold text-blue-800 dark:text-blue-100">Next best action</h2>
              <p className="text-sm">{result.output.next_best_action}</p>
              {decision === null ? (
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => respond('reject')}
                    className="px-3 py-1.5 text-sm rounded border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200"
                  >
                    Not for me
                  </button>
                  <button
                    type="button"
                    onClick={() => respond('accept')}
                    className="px-3 py-1.5 text-sm rounded bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    Accept this plan
                  </button>
                </div>
              ) : (
                <p className="text-xs text-gray-500">
                  Recorded as <strong>{decision}</strong>. The plan is now in your decision log.
                </p>
              )}
            </section>

            <p className="text-xs text-gray-500 dark:text-gray-400">
              <strong>Compliance:</strong> LifeNavigator does not recommend specific securities or
              provide individualized investment advice. The output above is planning guidance based
              on your declared inputs and the engine's documented assumptions. Discuss
              individualized recommendations with a licensed advisor.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-xs uppercase text-gray-500">{label}</dt>
      <dd className="sm:col-span-2">{value}</dd>
    </>
  );
}

function AllocationRow({ a, surplus }: { a: OptimizerAllocation; surplus: number }) {
  const widthPct = Math.max(2, (a.amount_usd / Math.max(surplus, 1)) * 100);
  return (
    <li className="border border-gray-200 dark:border-gray-700 rounded p-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-gray-900 dark:text-white">
          {CATEGORY_LABEL[a.category]}
        </span>
        <span className="text-gray-700 dark:text-gray-300">
          {fmtUsd(a.amount_usd)}{' '}
          <span className="text-xs text-gray-500">({a.share_pct.toFixed(0)}%)</span>
        </span>
      </div>
      <div className="mt-1 h-2 rounded bg-gray-100 dark:bg-gray-800 overflow-hidden">
        <div className="h-full bg-blue-600" style={{ width: `${Math.min(100, widthPct)}%` }} />
      </div>
      <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">{a.rationale}</p>
    </li>
  );
}
