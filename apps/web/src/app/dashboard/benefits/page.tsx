'use client';

// Compensation & Benefits Intelligence (Sprint 12) — synthesized from the user's uploaded
// documents: total comp, five-year value, benefit valuation, retirement + insurance impact, and
// FSA/HSA optimization tied to their own healthcare spend. Cited; not tax advice.

import React, { useEffect, useState } from 'react';

interface Analysis {
  source_documents: string[];
  total_compensation: {
    base: number;
    bonus: number;
    signing_bonus: number;
    equity_annualized: number;
    employer_benefits: number;
    total: number;
  };
  five_year_value: { by_year: { year: number; total: number }[]; cumulative: number };
  benefit_valuation: { benefit: string; annual_value: number; basis: string }[];
  retirement_impact: Record<string, unknown> & { missing?: string };
  insurance_impact: { life?: Record<string, unknown>; disability?: Record<string, unknown> };
  fsa_hsa: Record<string, unknown> & {
    prompt?: string;
    fsa?: Record<string, unknown>;
    hsa?: Record<string, unknown>;
    annual_net_worth_effect?: number;
  };
  missing_documents: string[];
  boundary: { disclaimer_text: string };
  confidence: { score: number; basis: string };
}

const money = (v: unknown) => (typeof v === 'number' ? `$${Math.round(v).toLocaleString()}` : '—');

export default function BenefitsPage() {
  const [a, setA] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let on = true;
    fetch('/api/benefits/analysis')
      .then(async (r) => (r.ok ? ((await r.json()) as Analysis) : null))
      .then((d) => {
        if (on) {
          setA(d);
          setLoading(false);
        }
      })
      .catch(() => {
        if (on) {
          setLoading(false);
        }
      });
    return () => {
      on = false;
    };
  }, []);

  if (loading)
    return (
      <div className="max-w-5xl mx-auto px-4 py-8 text-gray-500">
        Analyzing your compensation &amp; benefits…
      </div>
    );
  if (!a)
    return <div className="max-w-5xl mx-auto px-4 py-8 text-gray-500">Unavailable right now.</div>;

  const tc = a.total_compensation;
  const fh = a.fsa_hsa;
  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900">Compensation &amp; Benefits</h1>
      <p className="text-sm text-gray-500 mt-1">
        Synthesized from your documents:{' '}
        {a.source_documents.join(', ') || 'none yet — upload an offer letter & benefits package'}.
      </p>

      <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Total Compensation" value={money(tc.total)} sub={`base ${money(tc.base)}`} />
        <Stat label="Bonus + Equity" value={money(tc.bonus + tc.equity_annualized)} />
        <Stat label="Employer Benefits" value={money(tc.employer_benefits)} />
        <Stat label="5-Year Value" value={money(a.five_year_value.cumulative)} />
      </div>

      {a.benefit_valuation.length > 0 && (
        <Card title="Benefit Valuation">
          {a.benefit_valuation.map((b, i) => (
            <Row key={i} l={b.benefit} r={`${money(b.annual_value)}/yr`} sub={b.basis} />
          ))}
        </Card>
      )}

      <Card title="Retirement Impact">
        {a.retirement_impact.missing ? (
          <p className="text-sm text-amber-700">{String(a.retirement_impact.missing)}</p>
        ) : (
          <>
            <Row l="Annual contribution + match" r={money(a.retirement_impact.annual_total)} />
            <Row
              l="Employer match (free money)"
              r={`${money(a.retirement_impact.annual_employer_match)}/yr`}
            />
            <Row
              l="Projected addition by retirement"
              r={money(a.retirement_impact.projected_addition_at_retirement)}
            />
          </>
        )}
      </Card>

      <Card title="Insurance Impact">
        {a.insurance_impact.life?.missing ? (
          <p className="text-sm text-amber-700">{String(a.insurance_impact.life.missing)}</p>
        ) : (
          <Row
            l="Life coverage vs need (10× income)"
            r={`${money(a.insurance_impact.life?.coverage)} / ${money(a.insurance_impact.life?.need_10x_income)}`}
            sub={
              a.insurance_impact.life?.status === 'gap'
                ? `gap ${money(a.insurance_impact.life?.gap)}`
                : 'adequate ✓'
            }
          />
        )}
        {a.insurance_impact.disability?.missing ? (
          <p className="text-sm text-amber-700 mt-1">
            {String(a.insurance_impact.disability.missing)}
          </p>
        ) : (
          <Row
            l="Disability income replacement"
            r={`${String(a.insurance_impact.disability?.income_replacement_pct ?? '—')}%`}
          />
        )}
      </Card>

      <Card title="FSA / HSA Optimization">
        {fh.prompt ? (
          <p className="text-sm text-amber-700">{String(fh.prompt)}</p>
        ) : (
          <>
            <Row
              l="Annual healthcare spend"
              r={money(fh.annual_healthcare_spend)}
              sub={String((fh as Record<string, unknown>).spend_source ?? '')}
            />
            {fh.fsa && (
              <Row
                l="FSA tax savings"
                r={`${money((fh.fsa as Record<string, unknown>).annual_tax_savings)}/yr`}
                sub={`fund ~${money((fh.fsa as Record<string, unknown>).recommended_contribution)}`}
              />
            )}
            {fh.hsa && (
              <Row
                l="HSA tax savings + employer"
                r={money((fh.hsa as Record<string, unknown>).annual_tax_savings)}
                sub={`+${money((fh.hsa as Record<string, unknown>).employer_contribution)} employer · 20yr growth ${money((fh.hsa as Record<string, unknown>)['20yr_tax_free_growth_on_investable'])}`}
              />
            )}
            <Row l="Annual net-worth effect" r={money(fh.annual_net_worth_effect)} />
          </>
        )}
      </Card>

      {a.missing_documents.length > 0 && (
        <div className="mt-4 rounded-md border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-800">
          Upload these to sharpen the analysis: {a.missing_documents.join(', ')}.
        </div>
      )}
      <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
        {a.boundary.disclaimer_text}
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-lg shadow-md p-5">
      <div className="text-xs uppercase tracking-wide text-gray-400">{label}</div>
      <div className="text-xl font-bold text-gray-900 mt-1">{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    </div>
  );
}
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4 bg-white rounded-lg shadow-md p-5">
      <h2 className="font-semibold text-gray-800 mb-2">{title}</h2>
      {children}
    </div>
  );
}
function Row({ l, r, sub }: { l: string; r: string; sub?: string }) {
  return (
    <div className="flex items-center justify-between py-1 text-sm border-b border-gray-50 last:border-0">
      <span className="text-gray-600">
        {l}
        {sub && <span className="text-gray-400"> · {sub}</span>}
      </span>
      <span className="font-semibold text-gray-900">{r}</span>
    </div>
  );
}
