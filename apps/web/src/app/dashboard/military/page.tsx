'use client';

// Military / VA Pack (Sprint 20) — service / transition / GI Bill / VA-benefits readiness from
// uploaded DD214, VA award letters, LES, retirement statements. Informational — verify with the
// VA / a VSO. Not an official benefits determination.

import React, { useEffect, useState } from 'react';

type Status = 'green' | 'yellow' | 'orange' | 'red';
interface Pillar {
  pillar: string;
  status: Status;
  score: number;
  in_place?: string[];
  missing?: string[] | string;
  recommendation?: string;
  honorable?: boolean;
  branch?: string;
  disability_rating?: number | null;
  eligible?: boolean | null;
  benefit?: string;
}
interface Pack {
  is_service_connected: boolean;
  military_index: number;
  military_status: Status;
  weakest_pillar: string;
  military_readiness: Pillar;
  transition_readiness: Pillar;
  gi_bill_readiness: Pillar;
  va_benefits_readiness: Pillar;
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
        {p.branch && (
          <div className="text-sm text-gray-600 mt-1">
            {p.branch}
            {p.honorable ? ' · Honorable ✓' : ''}
          </div>
        )}
        {p.disability_rating != null && (
          <div className="text-sm text-gray-600 mt-1">VA rating {p.disability_rating}%</div>
        )}
        {p.eligible === true && (
          <div className="text-sm text-emerald-700 mt-1">Likely eligible ✓</div>
        )}
        {p.benefit && <div className="text-xs text-gray-500 mt-1">{p.benefit}</div>}
        {Array.isArray(p.in_place) && p.in_place.length > 0 && (
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

export default function MilitaryPage() {
  const [o, setO] = useState<Pack | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let on = true;
    fetch('/api/military/pack')
      .then(async (r) => (r.ok ? ((await r.json()) as Pack) : null))
      .then((x) => {
        if (on) {
          setO(x);
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
      <div className="max-w-5xl mx-auto px-4 py-8 text-gray-500">
        Assessing your military & VA pack…
      </div>
    );
  if (!o)
    return <div className="max-w-5xl mx-auto px-4 py-8 text-gray-500">Unavailable right now.</div>;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900">Military / VA Pack</h1>
      <p className="text-sm text-gray-500 mt-1">
        Service, transition, GI Bill & VA-benefits readiness — from your service documents.
      </p>

      <div
        className={`mt-5 rounded-xl border-2 ${RING[o.military_status]} p-6 flex items-center gap-5`}
      >
        <div
          className={`w-20 h-20 rounded-full border-4 ${RING[o.military_status]} flex items-center justify-center bg-white`}
        >
          <span className={`text-2xl font-extrabold ${TXT[o.military_status]}`}>
            {o.military_index}
          </span>
        </div>
        <div>
          <div
            className={`text-xs uppercase tracking-wide font-semibold ${TXT[o.military_status]}`}
          >
            Military Readiness · {o.military_status}
          </div>
          <div className="text-lg font-semibold text-gray-900 mt-1">
            Start with: {o.weakest_pillar}
          </div>
          {!o.is_service_connected && (
            <div className="text-sm text-gray-500 mt-1">
              Upload a DD214 to unlock your benefits picture.
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <PillarCard p={o.military_readiness} />
        <PillarCard p={o.transition_readiness} />
        <PillarCard p={o.gi_bill_readiness} />
        <PillarCard p={o.va_benefits_readiness} />
      </div>

      {o.missing_documents.length > 0 && (
        <div className="mt-4 rounded-md border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-800">
          Upload to complete your pack: {o.missing_documents.join(', ')}.
        </div>
      )}
      <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
        {o.boundary.disclaimer_text}
      </div>
    </div>
  );
}
