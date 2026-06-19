'use client';

// Career Overview — now rendered by the SHARED DomainOverview (no bespoke Career cards). The career
// summary (/api/career/summary) is mapped into the universal CoverageModel; absent data renders the
// standard DomainEmptyState. No fake roles, salaries, or progress — only what the summary returns.
import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  DomainOverview,
  DomainLoadingState,
  DomainErrorState,
  type CoverageModel,
} from '@/components/domain/framework';
import { careerDomain } from '@/components/domain/configs/career';
import { DomainSnapshot } from '@/components/domain/DomainSnapshot';

interface CareerSnapshotVM {
  currentRole: string | null;
  currentEmployer: string | null;
  yearsExperience: number | null;
  counts: {
    employment: number;
    volunteer: number;
    sideProjects: number;
    goals: number;
    certifications: number;
  };
}

interface CareerRec {
  title?: string;
  rationale?: string;
}
interface CareerVM {
  data: {
    current_state: { title?: string; employer?: string; years_experience?: number } | null;
    target_state: { role?: string; goal?: string } | null;
    market_position: { demand_level?: string } | null;
    skill_gaps: { skill?: string }[];
    missing_data_prompts?: string[];
  };
  recommendations?: CareerRec[];
  missing?: string[];
  freshness?: { as_of?: string };
  confidence?: { score: number; basis: string };
}

const MISSING_LABEL: Record<string, string> = {
  career_profiles: 'Your current role + employer',
  job_targets: 'A target role',
  compensation_records: 'Your current compensation',
  compensation_bands: 'Market compensation bands',
};

const CAREER_UNLOCKS = [
  'Compensation benchmark',
  'Role transition plan',
  'Skill gap analysis',
  'Opportunity matching',
  'Career roadmap',
];

function toCoverageModel(vm: CareerVM | null): CoverageModel {
  if (!vm) {
    return {
      coverage_pct: 0,
      known: [],
      missing: [
        'Current role',
        'Target role',
        'Resume',
        'Salary goal',
        'Skills & certifications',
        'Career timeline',
      ],
      unlocks: CAREER_UNLOCKS,
      next_action: { label: 'Continue career discovery', href: '/dashboard/career/add' },
    };
  }
  const cs = vm.data.current_state;
  const ts = vm.data.target_state;
  const mp = vm.data.market_position;
  const known: string[] = [];
  if (cs?.title) known.push(`Current role: ${cs.title}${cs.employer ? ` @ ${cs.employer}` : ''}`);
  if (cs?.years_experience != null) known.push(`${cs.years_experience} years experience`);
  if (ts?.role) known.push(`Target role: ${ts.role}`);
  if (mp?.demand_level && mp.demand_level !== 'unknown')
    known.push(`Market demand: ${mp.demand_level}`);
  if (vm.data.skill_gaps?.length)
    known.push(`${vm.data.skill_gaps.length} skill gap(s) identified`);

  const rawMissing = vm.missing?.length ? vm.missing : (vm.data.missing_data_prompts ?? []);
  const missing = rawMissing.map((m) => MISSING_LABEL[m] ?? m);

  const rawScore = vm.confidence?.score ?? 0;
  const confidence_pct = rawScore <= 1 ? Math.round(rawScore * 100) : Math.round(rawScore);
  const total = known.length + missing.length;
  const coverage_pct = total ? Math.round((known.length / total) * 100) : 0;
  const asOf = vm.freshness?.as_of ?? 'Today';

  return {
    coverage_pct,
    confidence_pct,
    known,
    missing,
    unlocks: CAREER_UNLOCKS,
    next_action: {
      label: known.length ? 'Enter more career info' : 'Continue career discovery',
      href: '/dashboard/career/add',
    },
    last_updated: asOf,
    source: {
      source: 'Career profile + cited market data',
      updated: asOf,
      confidence: confidence_pct >= 75 ? 'high' : confidence_pct >= 40 ? 'medium' : 'low',
    },
  };
}

export default function CareerOverviewPage() {
  const [vm, setVm] = useState<CareerVM | null>(null);
  const [snapshot, setSnapshot] = useState<CareerSnapshotVM | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch('/api/career/overview')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setSnapshot(d))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let active = true;
    fetch('/api/career/summary')
      .then(async (r) =>
        r.ok ? ((await r.json()) as CareerVM) : Promise.reject(new Error('load'))
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
      <div className="p-6">
        <DomainLoadingState />
      </div>
    );
  if (error)
    return (
      <div className="p-6">
        <DomainErrorState
          message="We couldn't load your career summary just now."
          onRetry={() => window.location.reload()}
        />
      </div>
    );

  const model = toCoverageModel(vm);
  const recs = vm?.recommendations ?? [];

  const heroLine = snapshot?.currentRole
    ? `${snapshot.currentRole}${snapshot.currentEmployer ? ` @ ${snapshot.currentEmployer}` : ''}${
        snapshot.yearsExperience != null ? ` · ${snapshot.yearsExperience} yrs experience` : ''
      }`
    : null;

  return (
    <DomainOverview config={careerDomain} model={model}>
      {snapshot && (
        <DomainSnapshot
          title="Career Snapshot"
          hero={heroLine}
          heroLogoName={snapshot.currentEmployer || snapshot.currentRole || 'Career'}
          stats={[
            {
              label: 'Positions',
              value: snapshot.counts.employment,
              href: '/dashboard/career/experience',
            },
            {
              label: 'Volunteer',
              value: snapshot.counts.volunteer,
              href: '/dashboard/career/experience',
            },
            {
              label: 'Projects',
              value: snapshot.counts.sideProjects,
              href: '/dashboard/career/experience',
            },
            {
              label: 'Certifications',
              value: snapshot.counts.certifications,
              href: '/dashboard/education/degrees',
            },
            {
              label: 'Active goals',
              value: snapshot.counts.goals,
              href: '/dashboard/career/goals',
            },
          ]}
          emptyTitle="Build your career picture"
          emptyHint="Add your jobs, volunteer work, side projects, and goals to unlock readiness and recommendations."
          ctaHref="/dashboard/career/experience"
          ctaLabel="Add experience"
        />
      )}

      {/* 9. Related Recommendations (career-specific, labeled) */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
          Related career recommendations
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
            No career recommendations yet — they appear as your career picture fills in.{' '}
            <Link href="/dashboard/career/recommendations" className="text-indigo-600">
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
          Resume, offer letters, and certifications power your career analysis.{' '}
          <Link href="/dashboard/career/documents" className="text-indigo-600">
            Manage documents →
          </Link>
        </p>
      </div>
    </DomainOverview>
  );
}
