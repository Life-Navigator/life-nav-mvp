'use client';

// Family — render-only view of the Core API Family DomainViewModel (via /api/family/summary).
// Protection / readiness / college are grounded in your data; absent values render as
// missing-data prompts, never fake. Estate & guardianship carry a legal boundary (attorney
// escalation) — this is not legal advice. No internals exposed.

import React, { useEffect, useState } from 'react';

interface Rec {
  id: string;
  title: string;
  why_it_matters: string;
  evidence: { statement: string }[];
  priority: 'high' | 'medium' | 'low';
}
interface FamilyVM {
  domain: string;
  data: {
    protection: {
      life_coverage: number | null;
      life_insurance_need: number | null;
      coverage_gap: number | null;
      income_basis: number | null;
      income_source: string | null;
    };
    readiness: {
      dependents: number;
      guardianship_status: string | null;
      estate: {
        has_will?: boolean;
        has_poa?: boolean;
        has_beneficiaries?: boolean;
        status?: string;
      } | null;
    };
    college: {
      target_year?: number;
      projected_cost?: number | null;
      saved_amount?: number | null;
      funding_gap?: number | null;
    }[];
    safety_boundaries: { boundary_type: string; disclaimer_text: string }[];
    missing_data_prompts?: string[];
  };
  recommendations: Rec[];
  missing: string[];
  freshness: { as_of?: string };
  confidence: { score: number; basis: string };
}

const PROMPT_COPY: Record<string, { title: string; body: string }> = {
  dependents: {
    title: 'Add your household',
    body: 'Add dependents, a spouse/partner, and coverage to see protection gaps and readiness.',
  },
  insurance_profiles: {
    title: 'Add your coverage',
    body: 'Add your life/disability coverage to compare against an income-replacement need.',
  },
  estate_plans: {
    title: 'Track estate readiness',
    body: 'Note your will / POA / beneficiaries. Not legal advice — an attorney completes these.',
  },
  career_profiles: {
    title: 'Add your income basis',
    body: 'Add your role so we can estimate an income-replacement need (cited market value).',
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
const yn = (b: boolean | undefined) => (b ? '✓' : '✗');

export default function FamilyPage() {
  const [vm, setVm] = useState<FamilyVM | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch('/api/family/summary')
      .then(async (r) => (r.ok ? ((await r.json()) as FamilyVM) : null))
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

  const prot = vm?.data.protection;
  const ready = vm?.data.readiness;
  const college = vm?.data.college ?? [];
  const legal = vm?.data.safety_boundaries?.find((b) => b.boundary_type === 'legal');
  const missing = vm?.missing ?? [];

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Family &amp; Protection</h1>
        <a
          href="/api/reports/family/pdf"
          className="text-sm px-3 py-1.5 rounded-md border border-rose-600 text-rose-700 hover:bg-rose-50"
        >
          Download PDF
        </a>
      </div>
      <p className="text-sm text-gray-500 mt-1">
        Protection, readiness, and college — grounded in your own data.
      </p>

      <div className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
        {legal?.disclaimer_text ??
          'Planning guidance, not legal or financial advice. Consult an attorney for wills, guardianship, and estate documents.'}
      </div>

      {loading ? (
        <div className="mt-8 text-gray-500">Loading your family summary…</div>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-lg font-semibold text-gray-700">Life-insurance protection</h2>
              {prot && prot.life_insurance_need != null ? (
                <>
                  <div className="text-sm text-gray-600 mt-2">
                    Coverage {fmt(prot.life_coverage)} · Need {fmt(prot.life_insurance_need)}
                  </div>
                  {prot.coverage_gap != null && prot.coverage_gap > 0 ? (
                    <div className="mt-2 text-lg font-bold text-rose-700">
                      Gap {fmt(prot.coverage_gap)}
                    </div>
                  ) : (
                    <div className="mt-2 text-lg font-bold text-emerald-700">Covered ✓</div>
                  )}
                  <div className="text-xs text-gray-400 mt-1">
                    Need = 10× income ({fmt(prot.income_basis)}, {prot.income_source}) + debts
                  </div>
                </>
              ) : (
                <Prompt field="insurance_profiles" />
              )}
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-lg font-semibold text-gray-700">Readiness</h2>
              {ready && (ready.dependents > 0 || ready.estate) ? (
                <div className="text-sm text-gray-600 mt-2 space-y-1">
                  <div>
                    Dependents: <b>{ready.dependents}</b>
                  </div>
                  <div>
                    Guardianship: <b>{ready.guardianship_status ?? 'undesignated'}</b>
                  </div>
                  {ready.estate && (
                    <div>
                      Estate — will {yn(ready.estate.has_will)} · POA {yn(ready.estate.has_poa)} ·
                      beneficiaries {yn(ready.estate.has_beneficiaries)}
                    </div>
                  )}
                </div>
              ) : (
                <Prompt field="dependents" />
              )}
            </div>
          </div>

          {college.length > 0 && (
            <div className="mt-6 bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-lg font-semibold text-gray-700">College funding</h2>
              <div className="mt-2 space-y-1 text-sm text-gray-600">
                {college.map((c, i) => (
                  <div key={i}>
                    {c.target_year}: projected {fmt(c.projected_cost)} · saved {fmt(c.saved_amount)}
                    {c.funding_gap != null && c.funding_gap > 0 && (
                      <span className="text-rose-700 font-semibold">
                        {' '}
                        · gap {fmt(c.funding_gap)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {vm && vm.recommendations.length > 0 && (
            <div className="mt-6 bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Protect &amp; plan</h2>
              <div className="space-y-4">
                {vm.recommendations.map((rec) => (
                  <div key={rec.id} className="border-l-4 border-rose-600 pl-4 py-2">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-gray-900">{rec.title}</h3>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">
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
    body: 'Add your family data to unlock protection insights.',
  };
  return (
    <div className="text-center py-2">
      <p className="font-medium text-gray-700">{copy.title}</p>
      <p className="text-sm text-gray-500 mt-1">{copy.body}</p>
    </div>
  );
}
