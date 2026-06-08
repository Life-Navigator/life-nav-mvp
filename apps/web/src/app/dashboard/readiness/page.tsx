'use client';

// Life Readiness — the executive command center. One screen explaining the user's whole-life
// status: the Life Readiness Index + per-domain readiness (GREEN/YELLOW/ORANGE/RED with
// progress / gap / confidence / timeline / recommendations) + cross-domain goal status.
// Grounded in the live domain data; no data reads as "get started", never a fake green.

import React, { useEffect, useState } from 'react';

type Status = 'green' | 'yellow' | 'orange' | 'red';
interface DomainReadiness {
  domain: string;
  status: Status;
  progress: number;
  gap: string;
  confidence: number;
  timeline: string;
  recommendations: { title: string; priority: string }[];
}
interface Goal {
  domain: string;
  title: string;
  status: Status;
  target_date?: string | null;
  timeline: string;
}
interface Readiness {
  index: { score: number; status: Status; headline: string; weakest_domain?: string | null };
  domains: DomainReadiness[];
  goals: Goal[];
  generated_at?: string;
}

const COLOR: Record<Status, { bg: string; text: string; ring: string; dot: string }> = {
  green: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    ring: 'border-emerald-500',
    dot: 'bg-emerald-500',
  },
  yellow: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    ring: 'border-amber-400',
    dot: 'bg-amber-400',
  },
  orange: {
    bg: 'bg-orange-50',
    text: 'text-orange-700',
    ring: 'border-orange-500',
    dot: 'bg-orange-500',
  },
  red: { bg: 'bg-rose-50', text: 'text-rose-700', ring: 'border-rose-500', dot: 'bg-rose-500' },
};
const LABEL: Record<string, string> = {
  finance: 'Finance',
  health: 'Health',
  career: 'Career',
  education: 'Education',
  family: 'Family',
  decision: 'Decision Confidence',
};

export default function ReadinessPage() {
  const [r, setR] = useState<Readiness | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch('/api/readiness')
      .then(async (res) => (res.ok ? ((await res.json()) as Readiness) : null))
      .then((d) => {
        if (active) {
          setR(d);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setR(null);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading)
    return (
      <div className="max-w-6xl mx-auto px-4 py-8 text-gray-500">Loading your life readiness…</div>
    );
  if (!r)
    return (
      <div className="max-w-6xl mx-auto px-4 py-8 text-gray-500">
        Readiness unavailable right now.
      </div>
    );

  const idx = r.index;
  const ic = COLOR[idx.status];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900">Life Readiness</h1>
      <p className="text-sm text-gray-500 mt-1">
        Your whole-life status at a glance — grounded in your own data.
      </p>

      {/* Index */}
      <div className={`mt-5 rounded-xl border-2 ${ic.ring} ${ic.bg} p-6 flex items-center gap-6`}>
        <div
          className={`w-24 h-24 rounded-full border-4 ${ic.ring} flex items-center justify-center bg-white`}
        >
          <span className={`text-3xl font-extrabold ${ic.text}`}>{idx.score}</span>
        </div>
        <div>
          <div className={`text-xs uppercase tracking-wide font-semibold ${ic.text}`}>
            Life Readiness Index · {idx.status}
          </div>
          <div className="text-lg font-semibold text-gray-900 mt-1">{idx.headline}</div>
          {idx.weakest_domain && (
            <div className="text-sm text-gray-500 mt-1">
              Focus area: <b>{LABEL[idx.weakest_domain] ?? idx.weakest_domain}</b>
            </div>
          )}
        </div>
      </div>

      {/* Domain cards */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {r.domains.map((d) => {
          const c = COLOR[d.status];
          return (
            <div key={d.domain} className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className={`h-1.5 ${c.dot}`} />
              <div className="p-5">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-gray-900">{LABEL[d.domain] ?? d.domain}</h2>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${c.bg} ${c.text} font-semibold uppercase`}
                  >
                    {d.status}
                  </span>
                </div>
                <div className="mt-3 h-2 rounded-full bg-gray-100">
                  <div
                    className={`h-2 rounded-full ${c.dot}`}
                    style={{ width: `${d.progress}%` }}
                  />
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {d.progress}% ready · confidence {Math.round(d.confidence * 100)}%
                </div>
                <p className="text-sm text-gray-700 mt-2">
                  <b>Gap:</b> {d.gap}
                </p>
                <p className="text-xs text-gray-500 mt-1">⏱ {d.timeline}</p>
                {d.recommendations.length > 0 && (
                  <ul className="mt-2 text-xs text-gray-600 list-disc list-inside">
                    {d.recommendations.slice(0, 2).map((rec, i) => (
                      <li key={i}>{rec.title}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Goals */}
      {r.goals.length > 0 && (
        <div className="mt-6 bg-white rounded-lg shadow-md p-5">
          <h2 className="font-semibold text-gray-800 mb-3">Goal status</h2>
          <div className="space-y-2">
            {r.goals.map((g, i) => {
              const c = COLOR[g.status];
              return (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span className={`inline-block w-2.5 h-2.5 rounded-full ${c.dot}`} />
                    <span className="text-gray-800">{g.title}</span>
                    <span className="text-xs text-gray-400">({LABEL[g.domain] ?? g.domain})</span>
                  </span>
                  <span className="text-xs text-gray-500">{g.timeline}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {r.generated_at && (
        <div className="mt-6 text-xs text-gray-400">
          As of {new Date(r.generated_at).toLocaleString()}
        </div>
      )}
    </div>
  );
}
