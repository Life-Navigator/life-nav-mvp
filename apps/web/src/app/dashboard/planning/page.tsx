'use client';

// Advanced Financial Planning (Sprint 16) — retirement readiness + Monte Carlo + goal funding +
// Social Security + insurance optimization + withdrawal planning. Built on the user's documents
// + finance data; probabilistic, with stated assumptions. Not investment/tax advice.

import React, { useEffect, useState } from 'react';

interface Plan {
  available: boolean;
  prompt?: string;
  inputs?: {
    income: number;
    current_retirement_assets: number;
    annual_contribution: number;
    years_to_retirement: number;
    expected_return: number;
    volatility: number;
  };
  retirement_readiness?: {
    target_nest_egg: number;
    projected_median: number;
    readiness_ratio: number | null;
    status: string;
    annual_need: number;
    on_track: boolean;
  };
  monte_carlo?: {
    simulations: number;
    p10: number;
    p50: number;
    p90: number;
    success_probability_vs_target: number;
  };
  goal_funding?: { goal: string; target: number; probability: number; status: string }[];
  social_security?: {
    monthly_at_62: number;
    monthly_at_67: number;
    monthly_at_70: number;
    optimal_claim_age: number;
    rationale: string;
    source: string;
  };
  insurance_optimization?: { life?: Record<string, unknown> };
  withdrawal_planning?: {
    sustainable_annual_withdrawal: number;
    withdrawal_rate: number;
    annual_need: number;
    covers_need: boolean | null;
    shortfall: number;
    strategy: string;
  };
  boundary?: { disclaimer_text: string };
}
const money = (v: unknown) => (typeof v === 'number' ? `$${Math.round(v).toLocaleString()}` : '—');
const SC: Record<string, string> = {
  green: 'text-emerald-600 bg-emerald-50',
  yellow: 'text-amber-600 bg-amber-50',
  orange: 'text-orange-600 bg-orange-50',
  red: 'text-rose-600 bg-rose-50',
  unknown: 'text-gray-500 bg-gray-50',
};

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg shadow-md p-5">
      <h2 className="font-semibold text-gray-800 mb-2">{title}</h2>
      {children}
    </div>
  );
}
function Row({ l, r }: { l: string; r: string }) {
  return (
    <div className="flex justify-between py-1 text-sm border-b border-gray-50 last:border-0">
      <span className="text-gray-600">{l}</span>
      <span className="font-semibold text-gray-900">{r}</span>
    </div>
  );
}

export default function PlanningPage() {
  const [p, setP] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let on = true;
    fetch('/api/finance/plan')
      .then(async (r) => (r.ok ? ((await r.json()) as Plan) : null))
      .then((d) => {
        if (on) {
          setP(d);
          setLoading(false);
        }
      })
      .catch(() => {
        if (on) setLoading(false);
      });
    return () => {
      on = false;
    };
  }, []);

  if (loading)
    return (
      <div className="max-w-5xl mx-auto px-4 py-8 text-gray-500">Running your financial plan…</div>
    );
  if (!p)
    return <div className="max-w-5xl mx-auto px-4 py-8 text-gray-500">Unavailable right now.</div>;
  if (!p.available)
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900">Financial Plan</h1>
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {p.prompt}
        </div>
      </div>
    );

  const rr = p.retirement_readiness!;
  const mc = p.monte_carlo!;
  const max = Math.max(mc.p90, rr.target_nest_egg, 1);
  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900">Advanced Financial Plan</h1>
      <p className="text-sm text-gray-500 mt-1">
        Retirement readiness, Monte Carlo, Social Security, insurance & withdrawal — built on your
        data.
      </p>

      {/* Retirement readiness + Monte Carlo */}
      <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={`rounded-lg shadow-md p-5 ${SC[rr.status] ?? SC.unknown}`}>
          <div className="text-xs uppercase tracking-wide opacity-70">Retirement Readiness</div>
          <div className="text-3xl font-extrabold mt-1">
            {rr.readiness_ratio != null ? `${Math.round(rr.readiness_ratio * 100)}%` : '—'}
          </div>
          <div className="text-xs mt-1">{rr.on_track ? 'On track ✓' : 'Below target'}</div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-5">
          <div className="text-xs uppercase tracking-wide text-gray-400">Monte Carlo success</div>
          <div className="text-3xl font-extrabold text-gray-900 mt-1">
            {Math.round(mc.success_probability_vs_target * 100)}%
          </div>
          <div className="text-xs text-gray-400 mt-1">
            {mc.simulations.toLocaleString()} simulations
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-5">
          <div className="text-xs uppercase tracking-wide text-gray-400">Target nest egg</div>
          <div className="text-2xl font-bold text-gray-900 mt-1">{money(rr.target_nest_egg)}</div>
          <div className="text-xs text-gray-400 mt-1">need {money(rr.annual_need)}/yr</div>
        </div>
      </div>

      {/* Monte Carlo distribution */}
      <div className="mt-4">
        <Card title="Projected balance at retirement (Monte Carlo)">
          {[
            ['Pessimistic (p10)', mc.p10],
            ['Median (p50)', mc.p50],
            ['Optimistic (p90)', mc.p90],
          ].map(([lab, v]) => (
            <div key={lab as string} className="mt-2">
              <div className="flex justify-between text-sm text-gray-700">
                <span>{lab}</span>
                <span className="font-semibold">{money(v)}</span>
              </div>
              <div className="h-2 rounded-full bg-gray-100 mt-0.5">
                <div
                  className="h-2 rounded-full bg-indigo-500"
                  style={{ width: `${((v as number) / max) * 100}%` }}
                />
              </div>
            </div>
          ))}
          <div className="mt-2 text-xs text-gray-400">
            Target {money(rr.target_nest_egg)} ·{' '}
            {Math.round(mc.success_probability_vs_target * 100)}% of paths reach it.
          </div>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        {p.social_security && (
          <Card title="Social Security">
            <Row l="At 62" r={`${money(p.social_security.monthly_at_62)}/mo`} />
            <Row l="At 67 (full)" r={`${money(p.social_security.monthly_at_67)}/mo`} />
            <Row l="At 70" r={`${money(p.social_security.monthly_at_70)}/mo`} />
            <Row l="Optimal claim age" r={String(p.social_security.optimal_claim_age)} />
            <p className="text-xs text-gray-400 mt-2">
              {p.social_security.rationale} · {p.social_security.source}
            </p>
          </Card>
        )}
        {p.withdrawal_planning && (
          <Card title="Withdrawal Planning">
            <Row
              l="Sustainable annual withdrawal"
              r={money(p.withdrawal_planning.sustainable_annual_withdrawal)}
            />
            <Row
              l="Withdrawal rate"
              r={`${Math.round(p.withdrawal_planning.withdrawal_rate * 100)}%`}
            />
            <Row
              l="Covers your need?"
              r={
                p.withdrawal_planning.covers_need
                  ? 'Yes ✓'
                  : `No (short ${money(p.withdrawal_planning.shortfall)})`
              }
            />
            <p className="text-xs text-gray-400 mt-2">{p.withdrawal_planning.strategy}</p>
          </Card>
        )}
        {p.insurance_optimization?.life && (
          <Card title="Insurance Optimization">
            <Row
              l="Current coverage"
              r={money((p.insurance_optimization.life as Record<string, unknown>).current)}
            />
            <Row
              l="Recommended"
              r={money((p.insurance_optimization.life as Record<string, unknown>).recommended)}
            />
            <Row
              l="Action"
              r={String(
                (p.insurance_optimization.life as Record<string, unknown>).action ??
                  (p.insurance_optimization.life as Record<string, unknown>).missing ??
                  '—'
              )}
            />
          </Card>
        )}
        {p.goal_funding && p.goal_funding.length > 0 && (
          <Card title="Goal Funding Probability">
            {p.goal_funding.map((g, i) => (
              <Row
                key={i}
                l={`${g.goal} (${money(g.target)})`}
                r={`${Math.round(g.probability * 100)}% ${g.status === 'on_track' ? '✓' : '⚠'}`}
              />
            ))}
          </Card>
        )}
      </div>

      <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
        {p.boundary?.disclaimer_text}
      </div>
    </div>
  );
}
