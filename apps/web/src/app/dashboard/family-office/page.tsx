'use client';

// Family Office (Sprint 18) — estate / trust / beneficiary / survivor / legacy readiness, from
// the Family domain + uploaded will/trust/estate documents. Each pillar G/Y/O/R with what's in
// place, what's missing, the next step. Attorney-required boundary on everything. Not legal advice.

import React, { useEffect, useState } from 'react';

type Status = 'green' | 'yellow' | 'orange' | 'red';
interface Pillar {
  pillar: string;
  status: Status;
  score: number;
  in_place?: string[];
  missing?: string[] | string;
  recommendation?: string;
  has_trust?: boolean;
  warranted?: boolean;
  covered?: boolean;
  coverage_gap?: number;
}
interface Office {
  legacy_index: number;
  legacy_status: Status;
  dependents: number;
  estate_readiness: Pillar;
  trust_readiness: Pillar;
  beneficiary_readiness: Pillar;
  survivor_planning: Pillar;
  legacy_readiness: Pillar;
  missing_documents: string[];
  boundary: { disclaimer_text: string };
}
const RING: Record<Status, string> = {
  green: 'border-emerald-500',
  yellow: 'border-amber-400',
  orange: 'border-orange-500',
  red: 'border-rose-500',
};
const TXT: Record<Status, string> = {
  green: 'text-emerald-700',
  yellow: 'text-amber-700',
  orange: 'text-orange-700',
  red: 'text-rose-700',
};

function PillarCard({ p }: { p: Pillar }) {
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className={`border-t-4 ${RING[p.status]} p-5`}>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">{p.pillar}</h2>
          <span className={`text-2xl font-extrabold ${TXT[p.status]}`}>{p.score}</span>
        </div>
        {p.in_place && p.in_place.length > 0 && (
          <div className="mt-2 text-sm text-emerald-700">✓ {p.in_place.join(' · ')}</div>
        )}
        {Array.isArray(p.missing) && p.missing.length > 0 && (
          <div className="mt-1 text-sm text-rose-600">Missing: {p.missing.join(' · ')}</div>
        )}
        {typeof p.missing === 'string' && (
          <div className="mt-1 text-sm text-amber-700">{p.missing}</div>
        )}
        {p.recommendation && <p className="text-xs text-gray-500 mt-2">{p.recommendation}</p>}
      </div>
    </div>
  );
}

export default function FamilyOfficePage() {
  const [o, setO] = useState<Office | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let on = true;
    fetch('/api/family/office')
      .then(async (r) => (r.ok ? ((await r.json()) as Office) : null))
      .then((d) => {
        if (on) {
          setO(d);
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
      <div className="max-w-5xl mx-auto px-4 py-8 text-gray-500">Assessing your family office…</div>
    );
  if (!o)
    return <div className="max-w-5xl mx-auto px-4 py-8 text-gray-500">Unavailable right now.</div>;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900">Family Office</h1>
      <p className="text-sm text-gray-500 mt-1">
        Estate, trust, beneficiary, survivor & legacy readiness — grounded in your documents.
      </p>

      <div
        className={`mt-5 rounded-xl border-2 ${RING[o.legacy_status]} p-6 flex items-center gap-5`}
      >
        <div
          className={`w-20 h-20 rounded-full border-4 ${RING[o.legacy_status]} flex items-center justify-center bg-white`}
        >
          <span className={`text-2xl font-extrabold ${TXT[o.legacy_status]}`}>
            {o.legacy_index}
          </span>
        </div>
        <div>
          <div className={`text-xs uppercase tracking-wide font-semibold ${TXT[o.legacy_status]}`}>
            Legacy Readiness · {o.legacy_status}
          </div>
          <div className="text-lg font-semibold text-gray-900 mt-1">
            {o.legacy_readiness.recommendation}
          </div>
          {o.legacy_readiness &&
            (o.legacy_readiness as Pillar & { weakest_pillar?: string }).weakest_pillar && (
              <div className="text-sm text-gray-500 mt-1">
                Start with:{' '}
                <b>{(o.legacy_readiness as Pillar & { weakest_pillar?: string }).weakest_pillar}</b>
              </div>
            )}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <PillarCard p={o.estate_readiness} />
        <PillarCard p={o.trust_readiness} />
        <PillarCard p={o.beneficiary_readiness} />
        <PillarCard p={o.survivor_planning} />
      </div>

      {o.missing_documents.length > 0 && (
        <div className="mt-4 rounded-md border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-800">
          Upload these to complete your family office: {o.missing_documents.join(', ')}.
        </div>
      )}
      <div className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800">
        {o.boundary.disclaimer_text}
      </div>
    </div>
  );
}
