'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

interface VersionRow {
  id: string;
  version_index: number;
  label: string;
  horizon_years: number;
  status: string;
  ran_at: string | null;
}
interface OutputRow {
  scenario_version_id: string;
  final_net_worth: number | null;
  final_debt: number | null;
  final_annual_income: number | null;
  emergency_fund_months_final: number | null;
  health_cost_exposure_final: number | null;
  retirement_ready: boolean | null;
  rationale: string | null;
  risks: unknown;
  upside_factors: unknown;
}
interface MetricRow {
  scenario_version_id: string;
  at_month: number;
  metric_key: string;
  metric_value: number;
}
interface ScenarioDetail {
  scenario: { id: string; title: string; status: string; metadata: any };
  versions: VersionRow[];
  outputs: OutputRow[];
  metrics: MetricRow[];
  comparisons: Array<{
    id: string;
    version_a_id: string;
    version_b_id: string;
    comparison_summary: string;
  }>;
}

const LABEL_HUMAN: Record<string, string> = {
  current_behavior: 'Current behavior',
  conservative: 'Conservative',
  balanced: 'Balanced',
  aggressive_upside: 'Aggressive upside',
  goal_optimized: 'Goal-optimized',
};
const LABEL_COLOR: Record<string, string> = {
  current_behavior: '#64748b',
  conservative: '#0ea5e9',
  balanced: '#2563eb',
  aggressive_upside: '#dc2626',
  goal_optimized: '#16a34a',
};

function fmtUsd(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return Math.round(n).toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
}

export default function LifeTrajectoryPage() {
  const [title, setTitle] = useState('My trajectory — 10 year');
  const [horizon, setHorizon] = useState(10);
  const [statedGoal, setStatedGoal] = useState('');
  const [scenarioId, setScenarioId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ScenarioDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Comparison
  const [compareA, setCompareA] = useState<string>('');
  const [compareB, setCompareB] = useState<string>('');

  const createAndRun = async () => {
    setBusy(true);
    setError(null);
    setDetail(null);
    try {
      const createRes = await fetch('/api/simulations/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          horizon_years: horizon,
          stated_goal: statedGoal.trim() || undefined,
        }),
      });
      const createBody = await createRes.json();
      if (!createRes.ok) throw new Error(createBody?.error ?? 'Create failed');
      const sid: string = createBody.scenario_id;

      const runRes = await fetch(`/api/simulations/${sid}/run`, { method: 'POST' });
      const runBody = await runRes.json();
      if (!runRes.ok) throw new Error(runBody?.error ?? 'Run failed');

      const detailRes = await fetch(`/api/simulations/${sid}`);
      const detailBody = await detailRes.json();
      if (!detailRes.ok) throw new Error(detailBody?.error ?? 'Read failed');

      setScenarioId(sid);
      setDetail(detailBody as ScenarioDetail);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'simulation failed');
    } finally {
      setBusy(false);
    }
  };

  const runCompare = async () => {
    if (!scenarioId || !compareA || !compareB || compareA === compareB) return;
    const res = await fetch('/api/simulations/compare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scenario_id: scenarioId,
        version_a_id: compareA,
        version_b_id: compareB,
      }),
    });
    if (res.ok) {
      const refreshed = await fetch(`/api/simulations/${scenarioId}`);
      const body = await refreshed.json();
      if (refreshed.ok) setDetail(body as ScenarioDetail);
    }
  };

  // Build a chart series from metrics: { at_month, [version_label]: net_worth }
  const chartData = React.useMemo(() => {
    if (!detail) return [] as Array<Record<string, number | string>>;
    const labelById = new Map(detail.versions.map((v) => [v.id, v.label]));
    const monthly = new Map<number, Record<string, number | string>>();
    for (const m of detail.metrics) {
      if (m.metric_key !== 'net_worth') continue;
      const point = monthly.get(m.at_month) ?? { at_month: m.at_month };
      const label = labelById.get(m.scenario_version_id) ?? m.scenario_version_id.slice(0, 6);
      point[label] = Math.round(m.metric_value);
      monthly.set(m.at_month, point);
    }
    return [...monthly.values()].sort((a, b) => Number(a.at_month) - Number(b.at_month));
  }, [detail]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-10 px-4">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="space-y-2">
          <Link href="/dashboard" className="text-sm text-blue-600 hover:underline">
            ← Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Life Trajectory</h1>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            We project five paths from your current financial picture: current behavior,
            conservative, balanced, aggressive upside, and a goal-optimized path. The output is a
            scenario, not a guarantee.
          </p>
        </header>

        <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <label className="sm:col-span-2">
              <span className="block text-gray-700 dark:text-gray-200 mb-1">Title</span>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2"
              />
            </label>
            <label>
              <span className="block text-gray-700 dark:text-gray-200 mb-1">Horizon (years)</span>
              <input
                type="number"
                min={1}
                max={60}
                value={horizon}
                onChange={(e) => setHorizon(Math.max(1, Math.min(60, Number(e.target.value || 1))))}
                className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2"
              />
            </label>
            <label className="sm:col-span-3">
              <span className="block text-gray-700 dark:text-gray-200 mb-1">
                Stated goal (optional — biases the goal-optimized path)
              </span>
              <input
                type="text"
                value={statedGoal}
                onChange={(e) => setStatedGoal(e.target.value)}
                placeholder='e.g. "buy a home in 3 years" or "retire early"'
                className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2"
              />
            </label>
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={createAndRun}
              disabled={busy}
              className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm disabled:bg-blue-400"
            >
              {busy ? 'Projecting…' : 'Project all 5 paths'}
            </button>
          </div>
          {error && (
            <div className="rounded border border-red-300 bg-red-50 p-2 text-xs text-red-800">
              {error}
            </div>
          )}
        </section>

        {detail && (
          <>
            <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3">
              <h2 className="font-semibold text-gray-900 dark:text-white">Net worth over time</h2>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="at_month"
                      tickFormatter={(m) => `${Math.round(Number(m) / 12)}y`}
                      label={{ value: 'Years from today', position: 'insideBottom', offset: -2 }}
                    />
                    <YAxis tickFormatter={(v) => `$${Math.round(Number(v) / 1000)}k`} />
                    <Tooltip
                      formatter={(value) => fmtUsd(Number(value))}
                      labelFormatter={(label) => `month ${label}`}
                    />
                    <Legend />
                    {detail.versions.map((v) => (
                      <Line
                        key={v.id}
                        type="monotone"
                        dataKey={v.label}
                        stroke={LABEL_COLOR[v.label] ?? '#000'}
                        dot={false}
                        strokeWidth={2}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {detail.versions.map((v) => {
                const out = detail.outputs.find((o) => o.scenario_version_id === v.id);
                return (
                  <article
                    key={v.id}
                    className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 space-y-2"
                  >
                    <header className="flex items-center justify-between">
                      <h3
                        className="font-semibold"
                        style={{ color: LABEL_COLOR[v.label] ?? '#111827' }}
                      >
                        {LABEL_HUMAN[v.label] ?? v.label}
                      </h3>
                      <span className="text-xs text-gray-500">{v.status}</span>
                    </header>
                    <dl className="text-sm grid grid-cols-2 gap-1">
                      <dt className="text-gray-500">Final net worth</dt>
                      <dd>{fmtUsd(out?.final_net_worth)}</dd>
                      <dt className="text-gray-500">Final debt</dt>
                      <dd>{fmtUsd(out?.final_debt)}</dd>
                      <dt className="text-gray-500">Emergency months</dt>
                      <dd>{out?.emergency_fund_months_final?.toFixed(1) ?? '—'}</dd>
                      <dt className="text-gray-500">Retirement-ready</dt>
                      <dd>{out?.retirement_ready ? 'Yes' : 'No'}</dd>
                    </dl>
                    {out?.rationale && (
                      <p className="text-xs text-gray-600 dark:text-gray-300">{out.rationale}</p>
                    )}
                  </article>
                );
              })}
            </section>

            <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3">
              <h2 className="font-semibold text-gray-900 dark:text-white">Compare two paths</h2>
              <div className="flex flex-wrap gap-2 text-sm items-center">
                <select
                  value={compareA}
                  onChange={(e) => setCompareA(e.target.value)}
                  className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2"
                >
                  <option value="">Pick A…</option>
                  {detail.versions.map((v) => (
                    <option key={v.id} value={v.id}>
                      {LABEL_HUMAN[v.label] ?? v.label}
                    </option>
                  ))}
                </select>
                <span>vs</span>
                <select
                  value={compareB}
                  onChange={(e) => setCompareB(e.target.value)}
                  className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2"
                >
                  <option value="">Pick B…</option>
                  {detail.versions.map((v) => (
                    <option key={v.id} value={v.id}>
                      {LABEL_HUMAN[v.label] ?? v.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={runCompare}
                  disabled={!compareA || !compareB || compareA === compareB}
                  className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm disabled:bg-blue-400"
                >
                  Compare
                </button>
              </div>
              {detail.comparisons.length > 0 && (
                <ul className="text-sm space-y-1">
                  {detail.comparisons.map((c) => (
                    <li
                      key={c.id}
                      className="border border-gray-200 dark:border-gray-700 rounded p-2"
                    >
                      {c.comparison_summary}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <p className="text-xs text-gray-500 dark:text-gray-400">
              <strong>Compliance:</strong> Every line above is a scenario projection, not a
              guarantee, recommendation, or individualized investment advice. Returns are modeled
              deterministically — variance is real and the future is not a draw from a Gaussian.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
