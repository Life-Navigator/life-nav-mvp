'use client';

// Life Intelligence (Sprint 35) — the dashboard begins with the user's LIFE MODEL, not domains:
// vision, primary objective + confidence, themes, constraints, opportunities, objective conflicts,
// and discovery-health prompts. Renders nothing until discovery exists (MissionControl guides that).

import Link from 'next/link';
import React, { useEffect, useState } from 'react';

interface Snapshot {
  life_vision: string | null;
  primary_objective: {
    title: string;
    confidence: number | null;
    reasoning?: string;
    themes?: string[];
  } | null;
  top_themes: string[];
  top_opportunities: string[];
  active_constraints: { label: string; detail?: string }[];
  objectives: { title: string; confidence: number | null }[];
}
interface Plan {
  conflicts: { between: string[]; type: string; reason: string; suggested_focus: string }[];
}
interface Health {
  model_quality: number;
  prompts: string[];
  missing_areas: string[];
}

export default function LifeIntelligence() {
  const [s, setS] = useState<Snapshot | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let on = true;
    Promise.all([
      fetch('/api/life/snapshot')
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      fetch('/api/life/plan')
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      fetch('/api/life/health')
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ]).then(([snap, pl, h]) => {
      if (!on) return;
      setS(snap);
      setPlan(pl);
      setHealth(h);
      setLoaded(true);
    });
    return () => {
      on = false;
    };
  }, []);

  if (!loaded || !s || !s.objectives?.length) return null; // no discovery yet → MissionControl handles onboarding
  const po = s.primary_objective;

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500">Your Life Model</h2>
        <Link href="/dashboard/discover" className="text-xs text-indigo-600">
          Refine →
        </Link>
      </div>

      <div className="mt-2 grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Vision + primary objective */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          {s.life_vision && <div className="text-sm text-gray-700 italic">“{s.life_vision}”</div>}
          {po && (
            <div className="mt-3">
              <div className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold">
                Primary objective
              </div>
              <div className="text-lg font-bold text-gray-900">
                {po.title}
                <span className="ml-2 text-xs font-normal text-gray-400">
                  confidence {Math.round((po.confidence ?? 0) * 100)}%
                </span>
              </div>
              {po.reasoning && <div className="text-xs text-gray-500 mt-0.5">{po.reasoning}</div>}
            </div>
          )}
          {s.top_themes?.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {s.top_themes.map((t) => (
                <span
                  key={t}
                  className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 capitalize"
                >
                  {t.replace('_', ' ')}
                </span>
              ))}
            </div>
          )}
          {s.objectives.length > 1 && (
            <div className="mt-3 text-xs text-gray-500">
              Also active:{' '}
              {s.objectives
                .slice(1)
                .map((o) => o.title)
                .join(' · ')}
            </div>
          )}
        </div>

        {/* Discovery health */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold">
            Life model coverage
          </div>
          <div className="text-2xl font-extrabold text-gray-900 mt-1">
            {Math.round((health?.model_quality ?? 0) * 100)}%
          </div>
          {health?.prompts?.slice(0, 2).map((p, i) => (
            <Link
              key={i}
              href="/dashboard/discover"
              className="block text-xs text-amber-700 hover:underline mt-1"
            >
              {p}
            </Link>
          ))}
        </div>
      </div>

      {/* Constraints + opportunities + conflicts */}
      {s.active_constraints?.length || s.top_opportunities?.length || plan?.conflicts?.length ? (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          {s.active_constraints?.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <h3 className="text-xs font-bold text-rose-700 uppercase">Constraints</h3>
              {s.active_constraints.map((c) => (
                <div key={c.label} className="text-sm text-gray-700 mt-1">
                  {c.label}
                  <span className="block text-xs text-gray-400">{c.detail}</span>
                </div>
              ))}
            </div>
          )}
          {s.top_opportunities?.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <h3 className="text-xs font-bold text-emerald-700 uppercase">Opportunities</h3>
              {s.top_opportunities.map((o) => (
                <div key={o} className="text-sm text-gray-700 mt-1">
                  {o}
                </div>
              ))}
            </div>
          )}
          {plan?.conflicts && plan.conflicts.length > 0 && (
            <div className="bg-white rounded-xl border border-amber-200 shadow-sm p-4">
              <h3 className="text-xs font-bold text-amber-700 uppercase">Competing objectives</h3>
              {plan.conflicts.map((c, i) => (
                <div key={i} className="text-sm text-gray-700 mt-1">
                  {c.between.join(' vs ')}{' '}
                  <span className="block text-xs text-gray-400">
                    {c.reason} Focus: {c.suggested_focus}.
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
