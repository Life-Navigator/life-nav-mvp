'use client';

// Family Overview — rendered by the SHARED DomainOverview (no bespoke Family cards). /api/family/summary
// is mapped into the universal CoverageModel; absent data → DomainEmptyState. No fake dependents,
// coverage, beneficiaries, or readiness scores. Estate/guardianship carry a legal-boundary note.
import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  DomainOverview,
  DomainLoadingState,
  DomainErrorState,
  type CoverageModel,
} from '@/components/domain/framework';
import { familyDomain } from '@/components/domain/configs/family';

interface Rec {
  title?: string;
}
interface FamilyVM {
  data: {
    protection: { life_coverage: number | null; coverage_gap: number | null };
    readiness: {
      dependents: number;
      guardianship_status: string | null;
      estate: { has_will?: boolean; has_poa?: boolean; has_beneficiaries?: boolean } | null;
    };
    college?: { target_year?: number }[];
    missing_data_prompts?: string[];
  };
  recommendations?: Rec[];
  missing?: string[];
  freshness?: { as_of?: string };
  confidence?: { score: number; basis: string };
}

const fmt = (n: number | null | undefined) =>
  n == null
    ? null
    : new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
      }).format(n);

const MISSING_LABEL: Record<string, string> = {
  dependents: 'Dependents + spouse/partner',
  insurance_profiles: 'Life / disability coverage',
  estate_plans: 'Will / POA / beneficiaries',
};

const FAMILY_UNLOCKS = [
  'Estate readiness',
  'Inheritance planning',
  'Family protection analysis',
  'Guardian planning',
];
const DEFAULT_MISSING = [
  'Life insurance review',
  'Beneficiary review',
  'Trust',
  'Will',
  'Guardian designations',
];

function toCoverageModel(vm: FamilyVM | null): CoverageModel {
  const d = vm?.data;
  const known: string[] = [];
  if (d) {
    if (d.readiness?.dependents > 0) known.push(`${d.readiness.dependents} dependent(s)`);
    const cov = fmt(d.protection?.life_coverage);
    if (cov) known.push(`Life coverage: ${cov}`);
    if (d.readiness?.guardianship_status)
      known.push(`Guardianship: ${d.readiness.guardianship_status}`);
    if (d.readiness?.estate?.has_will) known.push('Will on file');
    if (d.readiness?.estate?.has_beneficiaries) known.push('Beneficiaries on file');
    if (d.college?.length) known.push(`College plan for ${d.college.length} child(ren)`);
  }
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
    unlocks: FAMILY_UNLOCKS,
    next_action: {
      label: known.length ? 'Add more family details' : 'Add your family details',
      href: '/dashboard/documents?domain=family&return_to=/dashboard/family',
    },
    last_updated: asOf,
    source: {
      source: 'Family profile',
      updated: asOf,
      confidence: confidence_pct >= 75 ? 'high' : confidence_pct >= 40 ? 'medium' : 'low',
    },
  };
}

export function LegalBoundary() {
  return (
    <p className="text-xs text-gray-500 dark:text-gray-400">
      LifeNavigator is not a law firm and does not provide legal advice. Estate planning decisions
      should be reviewed with a qualified attorney.
    </p>
  );
}

export default function FamilyOverviewPage() {
  const [vm, setVm] = useState<FamilyVM | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    fetch('/api/family/summary')
      .then(async (r) =>
        r.ok ? ((await r.json()) as FamilyVM) : Promise.reject(new Error('load'))
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
          message="We couldn't load your family summary just now."
          onRetry={() => window.location.reload()}
        />
      </div>
    );

  const model = toCoverageModel(vm);
  const recs = vm?.recommendations ?? [];

  return (
    <DomainOverview config={familyDomain} model={model}>
      {/* Legal boundary (protection/estate are shown above) */}
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 dark:border-slate-700 dark:bg-slate-800/50">
        <LegalBoundary />
      </div>

      {/* 9. Related Recommendations (family-specific) */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
          Related family recommendations
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
            No family recommendations yet — they appear as your protection + estate picture fills
            in.{' '}
            <Link href="/dashboard/family/recommendations" className="text-indigo-600">
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
          Wills, trusts, POAs, and beneficiary forms power your family protection planning.{' '}
          <Link href="/dashboard/family/documents" className="text-indigo-600">
            Manage documents →
          </Link>
        </p>
      </div>
    </DomainOverview>
  );
}
