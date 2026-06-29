'use client';

// Health & Wellness — body-composition-first, grounded in the SHARED domain-summary contract
// (GET /v1/life/domain-summary?domain=health), the same truth the Health card + Health Advisor use. When body
// composition facts exist, the page leads with the Fitness Baseline; sleep/activity are supporting gaps, never
// the primary state. Wellness guidance only; never medical advice. No fake data / no fabricated zeros.

import Link from 'next/link';
import { useEffect, useState } from 'react';

interface HealthRec {
  id: string;
  title: string;
  why_it_matters: string;
  priority?: 'high' | 'medium' | 'low';
}
interface HealthVM {
  data?: { safety_boundaries?: { disclaimer_text?: string }[] } | null;
  recommendations?: HealthRec[];
}
interface DomainSummary {
  facts?: Record<string, string | number>;
  missing_items?: string[];
  goals?: string[];
  next_best_action?: { label?: string; href?: string } | null;
  advisor_prompt_hint?: string | null;
}

const DISCLAIMER =
  'This is general wellness guidance, not medical advice. Consult a licensed clinician for medical concerns.';

// Descriptive copy for the supporting gaps the shared contract reports.
const MISSING_DESC: { match: string; title: string; body: string }[] = [
  {
    match: 'waist',
    title: 'Waist measurement',
    body: 'Helps track fat loss when scale weight stays stable.',
  },
  {
    match: 'training',
    title: 'Current training routine',
    body: 'Helps build a realistic recomposition plan.',
  },
  { match: 'lift', title: 'Starting lifts', body: 'Helps measure strength progress.' },
  { match: 'cardio', title: 'Cardio benchmark', body: 'Helps track conditioning improvements.' },
  { match: 'sleep', title: 'Sleep average', body: 'Helps connect recovery to progress.' },
  {
    match: 'injur',
    title: 'Injuries / limitations',
    body: 'Helps keep the plan safe and realistic.',
  },
  {
    match: 'nutrition',
    title: 'Nutrition baseline',
    body: 'Helps connect intake to your recomposition goal.',
  },
];
function describeMissing(item: string): { title: string; body: string } {
  const hit = MISSING_DESC.find((d) => item.toLowerCase().includes(d.match));
  return hit
    ? { title: hit.title, body: hit.body }
    : { title: item, body: 'Add this to sharpen your plan.' };
}

const ADVISOR_HREF = '/dashboard/advisor?agent=health_advisor';

export default function WellnessPage() {
  const [summary, setSummary] = useState<DomainSummary | null>(null);
  const [vm, setVm] = useState<HealthVM | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch('/api/life/domain-summary?domain=health', { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      fetch('/api/health/summary')
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ]).then(([s, v]) => {
      if (!active) return;
      setSummary(s);
      setVm(v);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const facts = (summary?.facts || {}) as Record<string, string | number>;
  const hasBodyComp = Object.keys(facts).length > 0;
  const missing = summary?.missing_items || [];
  const disclaimer = vm?.data?.safety_boundaries?.[0]?.disclaimer_text || DISCLAIMER;
  const recs = vm?.recommendations || [];
  const nba =
    summary?.next_best_action?.label &&
    summary.next_best_action.label.toLowerCase() !== 'add progress metrics'
      ? summary.next_best_action.label
      : summary?.advisor_prompt_hint ||
        'Add your current weekly training routine and waist measurement — those two inputs make the recomposition plan much more accurate.';

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Health &amp; Wellness
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Wellness coaching grounded in your own data.
          </p>
        </div>
        <Link
          href={ADVISOR_HREF}
          className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Talk to Health Advisor
        </Link>
      </div>

      <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-200">
        {disclaimer}
      </div>

      {loading ? (
        <div className="mt-8 text-gray-500">Loading your wellness summary…</div>
      ) : !hasBodyComp ? (
        // TRUE empty state — only when there is genuinely no health baseline.
        <div className="mt-8 rounded-xl border border-gray-200 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Add your health baseline
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-gray-500 dark:text-gray-400">
            Start with height, weight, primary goal, activity level, and sleep average.
          </p>
          <Link
            href={ADVISOR_HREF}
            className="mt-4 inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Build your baseline with the Health Advisor
          </Link>
        </div>
      ) : (
        <>
          {/* PRIMARY: Body Composition / Fitness Baseline */}
          <section className="mt-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              Body Composition / Fitness Baseline
            </h2>
            <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
              {Object.entries(facts).map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs uppercase tracking-wide text-gray-400">{k}</dt>
                  <dd className="text-lg font-semibold text-gray-900 dark:text-white">
                    {String(v)}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
              Data status: body composition captured
              {missing.length ? ' · sleep/activity still missing' : ''}
            </p>
          </section>

          {/* NEXT BEST ACTION */}
          <section className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-800 dark:bg-indigo-900/20">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-indigo-500 dark:text-indigo-300">
              Next best action
            </div>
            <p className="mt-0.5 text-sm font-medium text-gray-800 dark:text-gray-100">{nba}</p>
          </section>

          {/* WHAT WE STILL NEED — one clear section, no duplicate Add Sleep/Activity cards */}
          {missing.length > 0 && (
            <section className="mt-6">
              <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                What we still need
              </h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                To make your health plan more useful, add these next.
              </p>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {missing.map((item) => {
                  const d = describeMissing(item);
                  return (
                    <div
                      key={item}
                      className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
                    >
                      <p className="font-medium text-gray-800 dark:text-gray-100">{d.title}</p>
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{d.body}</p>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Evidence-backed recommendations (secondary, only if present) */}
          {recs.length > 0 && (
            <section className="mt-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <h2 className="mb-4 text-lg font-semibold text-gray-800 dark:text-gray-100">
                Recommended next moves
              </h2>
              <div className="space-y-4">
                {recs.map((rec) => (
                  <div key={rec.id} className="border-l-4 border-emerald-600 pl-4 py-1">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">{rec.title}</h3>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                      {rec.why_it_matters}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
