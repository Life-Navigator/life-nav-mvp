'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Compass,
  ArrowRight,
  ShieldAlert,
  Sparkles,
  Target,
  TrendingUp,
  AlertTriangle,
  Loader2,
} from 'lucide-react';

// Executive summary — the trust-first dashboard hero. 100% real data from /api/life/my-life
// (vision · what-matters · readiness · next-best-action · constraints) + /api/goals (goal progress).
// Every section has an HONEST empty state — never a fabricated number, risk, or recommendation.

interface MyLife {
  life_vision?: {
    life_vision?: string | null;
    primary_objective?: string | null;
    confidence_pct?: number;
    discovery_completion_pct?: number;
  };
  what_matters_most?: {
    primary_objective?: string | null;
    reasoning?: string | null;
    depends_on?: string[];
    risks?: string[];
    opportunities?: string[];
    supporting_objectives?: string[];
  };
  life_readiness?: {
    overall?: number | null;
    status?: string;
    domains?: { domain: string; progress: number; status: string; gap?: string }[];
  };
  next_best_action?: {
    kind?: string;
    label?: string;
    title?: string;
    why?: string | null;
    recommended_action?: string | null;
    expected_benefit?: string | null;
    needed_to_act?: string | null;
    confidence_pct?: number;
  } | null;
  constraints?: { label: string; detail?: string | null; source?: string }[];
  has_discovery?: boolean;
}
interface Goal {
  id: string;
  title?: string;
  category?: string;
  status?: string;
  progress_percent?: number | null;
  target_value?: number | null;
  current_value?: number | null;
}

const STATUS_COLOR: Record<string, string> = {
  green: 'text-emerald-600',
  on_track: 'text-emerald-600',
  yellow: 'text-amber-600',
  orange: 'text-amber-600',
  red: 'text-rose-600',
  at_risk: 'text-rose-600',
};

function ReadinessRing({ score, status }: { score: number | null; status?: string }) {
  const pct = score ?? 0;
  const r = 52;
  const c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;
  const stroke = pct >= 70 ? '#10b981' : pct >= 40 ? '#f59e0b' : '#f43f5e';
  return (
    <div className="relative h-32 w-32 shrink-0">
      <svg viewBox="0 0 120 120" className="h-32 w-32 -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="#e5e7eb" strokeWidth="10" />
        {score != null && (
          <circle
            cx="60"
            cy="60"
            r={r}
            fill="none"
            stroke={stroke}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${c}`}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-3xl font-bold text-gray-900">
          {score != null ? Math.round(score) : '—'}
        </div>
        <div className="text-[10px] uppercase tracking-wide text-gray-400">Readiness</div>
      </div>
    </div>
  );
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-gray-200/80 bg-white p-5 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

function SectionHead({
  icon: Icon,
  title,
  tint,
}: {
  icon: React.ElementType;
  title: string;
  tint: string;
}) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <Icon className={`h-4 w-4 ${tint}`} />
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
    </div>
  );
}

function EmptyLine({ text }: { text: string }) {
  return <p className="text-sm leading-relaxed text-gray-400">{text}</p>;
}

export default function ExecutiveSummary() {
  const [ml, setMl] = useState<MyLife | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let on = true;
    Promise.all([
      fetch('/api/life/my-life', { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      fetch('/api/goals?limit=6', { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ]).then(([m, g]) => {
      if (!on) return;
      setMl(m || {});
      setGoals(Array.isArray(g?.goals) ? g.goals : []);
      setLoading(false);
    });
    return () => {
      on = false;
    };
  }, []);

  if (loading) {
    return (
      <Card className="flex items-center justify-center gap-2 py-10 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin text-indigo-500" /> Loading your life summary…
      </Card>
    );
  }

  const v = ml?.life_vision || {};
  const wm = ml?.what_matters_most || {};
  const rd = ml?.life_readiness || {};
  const nba = ml?.next_best_action;
  const hasDiscovery = ml?.has_discovery;

  // Honest empty state — no discovery yet → guide to the advisor, no fabricated metrics.
  if (!hasDiscovery && !v.life_vision && !v.primary_objective) {
    return (
      <Card className="bg-gradient-to-br from-indigo-50 to-white">
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-100">
              <Compass className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Let&apos;s build your life model</h2>
              <p className="mt-0.5 max-w-xl text-sm text-gray-600">
                Your executive summary — vision, priorities, risks, and readiness — appears here
                once you talk to your advisor. Nothing here is generated until it&apos;s grounded in
                what you tell us.
              </p>
            </div>
          </div>
          <Link
            href="/dashboard/advisor?onboarding=1"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            Talk to your advisor <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Hero: readiness ring + vision */}
      <Card className="bg-gradient-to-br from-white to-indigo-50/40">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <ReadinessRing score={rd.overall ?? null} status={rd.status} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-indigo-500">
              <Compass className="h-3.5 w-3.5" /> Your north star
            </div>
            {v.life_vision ? (
              <p className="mt-1 text-lg font-semibold leading-snug text-gray-900">
                “{v.life_vision}”
              </p>
            ) : (
              <EmptyLine text="Your vision will appear here after discovery." />
            )}
            {v.primary_objective && (
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <span className="font-medium text-gray-700">{v.primary_objective}</span>
                {typeof v.confidence_pct === 'number' && (
                  <span className="text-xs text-gray-400">· {v.confidence_pct}% confidence</span>
                )}
                {typeof v.discovery_completion_pct === 'number' && (
                  <span className="text-xs text-gray-400">
                    · {v.discovery_completion_pct}% discovered
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Next best action */}
      {nba && nba.title && (
        <Card className="border-indigo-200 bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-md">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-indigo-100">
                <Sparkles className="h-3.5 w-3.5" /> {nba.label || 'Your next best action'}
              </div>
              <h3 className="mt-1 text-lg font-bold leading-snug">{nba.title}</h3>
              {nba.why && <p className="mt-1 text-sm text-indigo-100">{nba.why}</p>}
              {nba.kind === 'priority_issue' && nba.needed_to_act && (
                <p className="mt-2 rounded-lg bg-white/10 px-3 py-2 text-xs text-indigo-50">
                  To make this actionable: {nba.needed_to_act}
                </p>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
                {nba.expected_benefit && (
                  <span className="rounded-full bg-white/15 px-2.5 py-1 font-medium">
                    {nba.expected_benefit}
                  </span>
                )}
                {typeof nba.confidence_pct === 'number' && (
                  <span className="text-indigo-100">{nba.confidence_pct}% confidence</span>
                )}
              </div>
            </div>
            <Link
              href="/dashboard/recommendations"
              className="hidden shrink-0 items-center gap-1 rounded-lg bg-white/15 px-3 py-1.5 text-xs font-semibold hover:bg-white/25 sm:inline-flex"
            >
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </Card>
      )}

      {/* Priorities · Risks · Opportunities */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <SectionHead icon={Target} title="Priorities" tint="text-indigo-500" />
          {wm.supporting_objectives?.length || wm.depends_on?.length ? (
            <ul className="space-y-1.5 text-sm text-gray-700">
              {(wm.supporting_objectives || []).slice(0, 3).map((o, i) => (
                <li key={`o${i}`} className="flex gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400" />
                  {o}
                </li>
              ))}
              {(wm.depends_on || []).slice(0, 3).map((d, i) => (
                <li key={`d${i}`} className="flex gap-2 text-gray-500">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-300" />
                  {d}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyLine text="Your priorities appear as the advisor learns what matters most to you." />
          )}
        </Card>

        <Card>
          <SectionHead icon={ShieldAlert} title="Risks" tint="text-rose-500" />
          {wm.risks?.length ? (
            <ul className="space-y-1.5 text-sm text-gray-700">
              {wm.risks.slice(0, 4).map((r, i) => (
                <li key={i} className="flex gap-2">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-400" />
                  {r}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyLine text="No risks identified yet — they surface from your real situation, not assumptions." />
          )}
        </Card>

        <Card>
          <SectionHead icon={TrendingUp} title="Opportunities" tint="text-emerald-500" />
          {wm.opportunities?.length ? (
            <ul className="space-y-1.5 text-sm text-gray-700">
              {wm.opportunities.slice(0, 4).map((o, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                  {o}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyLine text="Opportunities appear as we understand your finances, career, and goals." />
          )}
        </Card>
      </div>

      {/* Goal progress + domain readiness */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <SectionHead icon={Target} title="Goal progress" tint="text-violet-500" />
            <Link
              href="/goals/create"
              className="text-xs font-medium text-indigo-600 hover:underline"
            >
              Manage
            </Link>
          </div>
          {goals.length ? (
            <ul className="space-y-3">
              {goals.slice(0, 5).map((g) => {
                const pct =
                  g.progress_percent != null
                    ? Math.round(g.progress_percent)
                    : g.target_value && g.current_value != null
                      ? Math.round((g.current_value / g.target_value) * 100)
                      : null;
                return (
                  <li key={g.id}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="truncate font-medium text-gray-800">
                        {g.title || 'Goal'}
                      </span>
                      <span className="ml-2 shrink-0 text-xs text-gray-400">
                        {pct != null ? `${pct}%` : g.status || ''}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500"
                        style={{ width: `${pct ?? 0}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="flex flex-col items-start gap-2">
              <EmptyLine text="No goals yet. Set one and track real progress here." />
              <Link
                href="/goals/create"
                className="text-xs font-semibold text-indigo-600 hover:underline"
              >
                Set your first goal →
              </Link>
            </div>
          )}
        </Card>

        <Card>
          <SectionHead icon={Compass} title="Domain readiness" tint="text-blue-500" />
          {rd.domains?.length ? (
            <ul className="space-y-2.5">
              {rd.domains.slice(0, 6).map((d) => (
                <li key={d.domain}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="capitalize text-gray-700">{d.domain}</span>
                    <span
                      className={`text-xs font-medium ${STATUS_COLOR[d.status] || 'text-gray-400'}`}
                    >
                      {d.progress}%
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${d.progress}%`,
                        background:
                          d.progress >= 70 ? '#10b981' : d.progress >= 40 ? '#f59e0b' : '#f43f5e',
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyLine text="Readiness fills in as you connect data across your domains." />
          )}
        </Card>
      </div>
    </div>
  );
}
