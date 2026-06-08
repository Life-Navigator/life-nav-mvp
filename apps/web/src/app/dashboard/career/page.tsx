'use client';

// Career Intelligence — render-only view of the Core API Career DomainViewModel
// (via /api/career/summary). Every compensation figure is a CITED market band (no
// fantasy salaries); absent data renders as missing-data prompts, never fake numbers.
// No internals (Qdrant/Neo4j/GraphRAG/worker) are shown.

import React, { useEffect, useState } from 'react';

interface Band {
  low: number | null;
  median: number | null;
  high: number | null;
  currency: string;
  source: string;
  confidence: number;
  as_of?: string | null;
}
interface CareerRec {
  id: string;
  title: string;
  why_it_matters: string;
  evidence: { statement: string }[];
  priority: 'high' | 'medium' | 'low';
}
interface CareerVM {
  domain: string;
  data: {
    current_state: {
      title?: string;
      employer?: string;
      industry?: string;
      seniority?: string;
      years_experience?: number;
    } | null;
    target_state: { role?: string; target_comp_median?: number; goal?: string } | null;
    market_position: {
      demand_level?: string;
      growth_outlook?: number | null;
      competition_level?: string;
      source?: string | null;
    } | null;
    compensation: {
      current_estimated_market_value: Band | null;
      target_estimated_market_value: Band | null;
      recorded_comp_median: number | null;
    };
    skill_gaps: { skill?: string; target_role?: string; severity?: string }[];
    safety_boundaries: { boundary_type: string; disclaimer_text: string }[];
    missing_data_prompts?: string[];
  };
  recommendations: CareerRec[];
  missing: string[];
  freshness: { as_of?: string };
  confidence: { score: number; basis: string };
}

const PROMPT_COPY: Record<string, { title: string; body: string }> = {
  career_profiles: {
    title: 'Build your career profile',
    body: 'Add your current role, employer, and experience to see your cited market value and growth paths.',
  },
  job_targets: {
    title: 'Set a target role',
    body: 'Add a target role to compare compensation and surface the skills that close the gap.',
  },
  compensation_records: {
    title: 'Add your compensation',
    body: 'Add your current pay to compare against cited market bands and spot underpayment.',
  },
  compensation_bands: {
    title: 'Market data coming online',
    body: 'We cite OEWS compensation bands for your role to estimate your market value.',
  },
};

const fmt = (n: number | null | undefined, ccy = 'USD') =>
  n == null
    ? '—'
    : new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: ccy,
        maximumFractionDigits: 0,
      }).format(n);

export default function CareerPage() {
  const [vm, setVm] = useState<CareerVM | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch('/api/career/summary')
      .then(async (r) => (r.ok ? ((await r.json()) as CareerVM) : null))
      .then((d) => {
        if (active) {
          setVm(d);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setVm(null);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const boundary = vm?.data.safety_boundaries?.[0];
  const cur = vm?.data.compensation?.current_estimated_market_value ?? null;
  const tgt = vm?.data.compensation?.target_estimated_market_value ?? null;
  const missing = vm?.missing ?? [];

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900">Career Intelligence</h1>
      <p className="text-sm text-gray-500 mt-1">
        Compensation, skills, and growth — grounded in cited market data.
      </p>

      <div className="mt-4 rounded-md border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
        {boundary?.disclaimer_text ??
          'Career coaching grounded in cited market data — not a guarantee of hire or compensation.'}
      </div>

      {loading ? (
        <div className="mt-8 text-gray-500">Loading your career intelligence…</div>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-lg font-semibold text-gray-700">Your market value</h2>
              {cur && cur.median != null ? (
                <>
                  <div className="text-2xl font-bold text-gray-900 mt-2">
                    {fmt(cur.median, cur.currency)}
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    Range {fmt(cur.low, cur.currency)}–{fmt(cur.high, cur.currency)} · {cur.source}
                  </div>
                </>
              ) : (
                <Prompt field="career_profiles" />
              )}
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-lg font-semibold text-gray-700">Target role</h2>
              {vm?.data.target_state?.role ? (
                <>
                  <div className="text-xl font-semibold text-gray-900 mt-2">
                    {vm.data.target_state.role}
                  </div>
                  {tgt && tgt.median != null && (
                    <div className="text-sm text-gray-500 mt-1">
                      Market median {fmt(tgt.median, tgt.currency)}
                    </div>
                  )}
                </>
              ) : (
                <Prompt field="job_targets" />
              )}
            </div>
          </div>

          {vm?.data.market_position &&
            vm.data.market_position.demand_level &&
            vm.data.market_position.demand_level !== 'unknown' && (
              <div className="mt-6 bg-white p-6 rounded-lg shadow-md">
                <h2 className="text-lg font-semibold text-gray-700">Market position</h2>
                <div className="text-sm text-gray-600 mt-2">
                  Demand: <b>{vm.data.market_position.demand_level}</b> · Competition:{' '}
                  <b>{vm.data.market_position.competition_level}</b>
                  {vm.data.market_position.source ? ` · ${vm.data.market_position.source}` : ''}
                </div>
              </div>
            )}

          {vm && vm.data.skill_gaps.length > 0 && (
            <div className="mt-6 bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-lg font-semibold text-gray-700">Skill gaps to your target</h2>
              <ul className="mt-2 flex flex-wrap gap-2">
                {vm.data.skill_gaps.map((g, i) => (
                  <li
                    key={i}
                    className="text-sm px-3 py-1 rounded-full bg-amber-100 text-amber-800"
                  >
                    {g.skill}
                    {g.severity ? ` · ${g.severity}` : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {vm && vm.recommendations.length > 0 && (
            <div className="mt-6 bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Recommended moves</h2>
              <div className="space-y-4">
                {vm.recommendations.map((rec) => (
                  <div key={rec.id} className="border-l-4 border-sky-600 pl-4 py-2">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-gray-900">{rec.title}</h3>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-sky-100 text-sky-700">
                        {rec.priority}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{rec.why_it_matters}</p>
                    {rec.evidence.length > 0 && (
                      <ul className="list-disc list-inside text-sm text-gray-700 mt-2">
                        {rec.evidence.map((e, i) => (
                          <li key={i}>{e.statement}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {missing.length > 0 && (
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              {missing.map((field) => (
                <div key={field} className="bg-white p-5 rounded-lg shadow-md text-center">
                  <Prompt field={field} />
                </div>
              ))}
            </div>
          )}

          {vm && (
            <div className="mt-8 text-xs text-gray-400">
              Confidence: {vm.confidence.basis}
              {vm.freshness.as_of
                ? ` · as of ${new Date(vm.freshness.as_of).toLocaleDateString()}`
                : ''}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Prompt({ field }: { field: string }) {
  const copy = PROMPT_COPY[field] ?? {
    title: `Add your ${field.replace(/_/g, ' ')}`,
    body: 'Add your career data to unlock cited intelligence.',
  };
  return (
    <div className="text-center py-2">
      <p className="font-medium text-gray-700">{copy.title}</p>
      <p className="text-sm text-gray-500 mt-1">{copy.body}</p>
    </div>
  );
}
