'use client';

// Health Overview — rendered by the SHARED DomainOverview (no bespoke Health cards, no placeholder
// charts). /api/health/summary is mapped into the universal CoverageModel; absent data → DomainEmptyState.
// No fake zeros, medications, adherence, or lab results. Includes beta + medical-safety language.
import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  DomainOverview,
  DomainLoadingState,
  DomainErrorState,
  type CoverageModel,
} from '@/components/domain/framework';
import { healthDomain } from '@/components/domain/configs/health';

interface HealthRec {
  title?: string;
}
interface HealthVM {
  data?: {
    avg_sleep_hours?: number | null;
    target_sleep_hours?: number | null;
    nights_logged?: number | null;
    medications_count?: number | null;
    insurance_status?: string | null;
    missing_data_prompts?: string[];
  } | null;
  recommendations?: HealthRec[];
  missing?: string[];
  freshness?: { as_of?: string };
  confidence?: { score: number; basis: string };
  enabled?: boolean;
}

const MISSING_LABEL: Record<string, string> = {
  sleep_logs: 'Sleep / nutrition / exercise habits',
  nutrition_logs: 'Nutrition logs',
  health_goals: 'Health goals',
  fitness_goals: 'Fitness goals',
  medications: 'Medications',
  labs: 'A lab report',
  insurance: 'Insurance info',
};

const HEALTH_UNLOCKS = [
  'Longevity planning',
  'Cost-risk planning',
  'Health trend tracking',
  'Better readiness scoring',
  'Healthcare affordability planning',
];

const DEFAULT_MISSING = [
  'Health goals',
  'Fitness goals',
  'Medications',
  'Lab report',
  'Insurance info',
  'Sleep / nutrition / exercise habits',
];

function toCoverageModel(vm: HealthVM | null): CoverageModel {
  const d = vm?.data ?? null;
  const known: string[] = [];
  if (d?.avg_sleep_hours != null) known.push(`Sleep: ${d.avg_sleep_hours}h avg`);
  if (d?.medications_count != null) known.push(`${d.medications_count} medication(s) tracked`);
  if (d?.insurance_status) known.push(`Insurance: ${d.insurance_status}`);

  const rawMissing = vm?.missing?.length ? vm.missing : (d?.missing_data_prompts ?? []);
  const missing = rawMissing.length
    ? rawMissing.map((m) => MISSING_LABEL[m] ?? m)
    : DEFAULT_MISSING;

  const rawScore = vm?.confidence?.score ?? 0;
  const confidence_pct = rawScore <= 1 ? Math.round(rawScore * 100) : Math.round(rawScore);
  const total = known.length + missing.length;
  const coverage_pct = total ? Math.round((known.length / total) * 100) : 0;
  const asOf = vm?.freshness?.as_of ?? 'Today';

  return {
    coverage_pct,
    confidence_pct,
    known,
    missing,
    unlocks: HEALTH_UNLOCKS,
    next_action: {
      label: known.length ? 'Enter more health info' : 'Continue health discovery',
      href: '/dashboard/healthcare/add',
    },
    last_updated: asOf,
    source: {
      source: 'Health profile / connected data',
      updated: asOf,
      confidence: confidence_pct >= 75 ? 'high' : confidence_pct >= 40 ? 'medium' : 'low',
    },
  };
}

function BetaSafety() {
  return (
    <div className="space-y-2 p-6 pb-0">
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-200">
        <strong>Health is in beta preparation.</strong> You can still upload documents or enter
        goals, but full health analysis is not enabled yet.
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        LifeNavigator is not medical advice. Health features are for organization, planning, and
        discussion with qualified professionals.
      </p>
    </div>
  );
}

export default function HealthOverviewPage() {
  const [vm, setVm] = useState<HealthVM | null>(null);
  // Shared summary contract — same truth as the dashboard card / readiness / advisor (body-comp baseline).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [summary, setSummary] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch('/api/life/domain-summary?domain=health', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setSummary(d))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let active = true;
    fetch('/api/health/summary')
      .then(async (r) =>
        r.ok ? ((await r.json()) as HealthVM) : Promise.reject(new Error('load'))
      )
      .then((d) => {
        if (active) {
          setVm(d);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setError(true);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading)
    return (
      <div>
        <BetaSafety />
        <div className="p-6">
          <DomainLoadingState />
        </div>
      </div>
    );
  if (error)
    return (
      <div>
        <BetaSafety />
        <div className="p-6">
          <DomainErrorState
            message="We couldn't load your health summary just now."
            onRetry={() => window.location.reload()}
          />
        </div>
      </div>
    );

  const sFacts: Record<string, string> = (summary && summary.facts) || {};
  const hasBodyComp = Object.keys(sFacts).length > 0;
  // Prefer the SHARED contract (body-comp baseline + specific missing) so the page agrees with the dashboard.
  const model: CoverageModel = hasBodyComp
    ? {
        coverage_pct: summary.coverage_pct ?? 0,
        confidence_pct: summary.confidence_pct ?? 0,
        known: summary.known_items?.length
          ? summary.known_items
          : Object.entries(sFacts).map(([k, v]) => `${k}: ${v}`),
        missing: summary.missing_items || [],
        next_action: summary.next_best_action
          ? { label: summary.next_best_action.label, href: summary.next_best_action.href }
          : { label: 'Add progress metrics', href: '/dashboard/advisor?agent=health_advisor' },
        last_updated: summary.last_updated || 'Today',
        source: {
          source: 'Advisor capture',
          updated: summary.last_updated || 'Today',
          confidence: 'medium',
        },
        status: summary.status,
      }
    : toCoverageModel(vm);
  const recs = vm?.recommendations ?? [];

  return (
    <div>
      <BetaSafety />
      <DomainOverview config={healthDomain} model={model}>
        {/* Body Composition / Fitness Baseline — from the shared health summary (advisor-captured facts). */}
        {hasBodyComp && (
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
              Body Composition / Fitness Baseline
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
              {Object.entries(sFacts).map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs text-gray-500 dark:text-gray-400">{k}</dt>
                  <dd className="text-sm font-semibold text-gray-900 dark:text-white">
                    {String(v)}
                  </dd>
                </div>
              ))}
            </dl>
            {summary.missing_items?.length > 0 && (
              <p className="mt-3 text-xs text-gray-600 dark:text-gray-300">
                <span className="font-semibold text-indigo-600">Progress metrics to add:</span>{' '}
                {summary.missing_items.join(' · ')}
              </p>
            )}
          </div>
        )}
        {/* 9. Related Recommendations (health-specific, labeled) */}
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
            Related health recommendations
          </div>
          {recs.length ? (
            <ul className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
              {recs.slice(0, 4).map((r, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-indigo-500">•</span>
                  {r.title ?? 'Recommendation'}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">
              No health recommendations yet — they appear as your health picture fills in.{' '}
              <Link href="/dashboard/healthcare/recommendations" className="text-indigo-600">
                View all →
              </Link>
            </p>
          )}
        </div>

        {/* 8. Related Documents */}
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
            Related documents
          </div>
          <p className="text-sm text-gray-500">
            Lab reports, insurance cards, and medication lists power your health planning.{' '}
            <Link href="/dashboard/healthcare/documents" className="text-indigo-600">
              Manage documents →
            </Link>
          </p>
        </div>
      </DomainOverview>
    </div>
  );
}
