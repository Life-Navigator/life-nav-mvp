'use client';

// Education Overview — rendered by the SHARED DomainOverview. There is no /api/education/summary, so we
// aggregate the user's REAL education records / certifications / courses into the universal CoverageModel.
// No fake degrees, courses, study streaks, or ROI — absent data renders DomainEmptyState.
import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  DomainOverview,
  DomainLoadingState,
  DomainErrorState,
  type CoverageModel,
} from '@/components/domain/framework';
import { educationDomain } from '@/components/domain/configs/education';
import { DomainSnapshot } from '@/components/domain/DomainSnapshot';

interface Counts {
  records: number;
  certifications: number;
  courses: number;
}

interface EduSnapshotVM {
  topDegree: { institution?: string; degreeType?: string; field?: string; logoUrl?: string } | null;
  counts: {
    degrees: number;
    certificates: number;
    licenses: number;
    courses: number;
    goals: number;
  };
}

const DEGREE_LABEL: Record<string, string> = {
  high_school: 'High School Diploma',
  associate: "Associate's",
  bachelor: "Bachelor's",
  master: "Master's",
  doctorate: 'Doctorate',
  certificate: 'Certificate',
  bootcamp: 'Bootcamp',
};

const EDUCATION_UNLOCKS = [
  'Education ROI comparison',
  'School / program fit',
  'Financing strategy',
  'Career-aligned learning plan',
  'Credential gap analysis',
];

function toCoverageModel(counts: Counts | null): CoverageModel {
  const known: string[] = [];
  if (counts) {
    if (counts.records) known.push(`${counts.records} education record(s)`);
    if (counts.certifications) known.push(`${counts.certifications} certification(s)`);
    if (counts.courses) known.push(`${counts.courses} course(s)`);
  }
  // Missing inputs not yet covered by what we know.
  const missing = [
    'Current education',
    'Target degree or certification',
    'Program preference',
    'Cost tolerance',
    'Timeline',
    'Transcript or credential documents',
    'Career reason',
  ];
  const total = known.length + missing.length;
  const coverage_pct = total ? Math.round((known.length / total) * 100) : 0;
  return {
    coverage_pct,
    confidence_pct: known.length ? Math.min(60, known.length * 20) : 0,
    known,
    missing,
    unlocks: EDUCATION_UNLOCKS,
    next_action: {
      label: known.length ? 'Add more education info' : 'Enter your education goal',
      href: '/dashboard/education/add',
    },
    last_updated: 'Today',
    source: {
      source: 'Your education records',
      updated: 'Today',
      confidence: known.length >= 2 ? 'medium' : 'low',
    },
  };
}

async function countOf(path: string): Promise<number> {
  try {
    const r = await fetch(path);
    if (!r.ok) return 0;
    const body = await r.json();
    const arr = Array.isArray(body) ? body : (body?.items ?? body?.data ?? body?.records ?? []);
    return Array.isArray(arr) ? arr.length : 0;
  } catch {
    return 0;
  }
}

export default function EducationOverviewPage() {
  const [counts, setCounts] = useState<Counts | null>(null);
  const [snapshot, setSnapshot] = useState<EduSnapshotVM | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch('/api/education/overview')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setSnapshot(d))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([
      countOf('/api/education/records'),
      countOf('/api/education/certifications'),
      countOf('/api/education/courses'),
    ])
      .then(([records, certifications, courses]) => {
        if (active) {
          setCounts({ records, certifications, courses });
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
          message="We couldn't load your education records just now."
          onRetry={() => window.location.reload()}
        />
      </div>
    );

  const model = toCoverageModel(counts);

  const degreeHero = snapshot?.topDegree
    ? `${DEGREE_LABEL[snapshot.topDegree.degreeType || ''] || 'Degree'}${
        snapshot.topDegree.field ? `, ${snapshot.topDegree.field}` : ''
      }${snapshot.topDegree.institution ? ` · ${snapshot.topDegree.institution}` : ''}`
    : null;

  return (
    <DomainOverview config={educationDomain} model={model}>
      {snapshot && (
        <DomainSnapshot
          title="Education Snapshot"
          hero={degreeHero}
          heroLogoName={snapshot.topDegree?.institution || 'Education'}
          heroLogoUrl={snapshot.topDegree?.logoUrl}
          stats={[
            {
              label: 'Degrees',
              value: snapshot.counts.degrees,
              href: '/dashboard/education/degrees',
            },
            {
              label: 'Certificates',
              value: snapshot.counts.certificates,
              href: '/dashboard/education/degrees',
            },
            {
              label: 'Licenses',
              value: snapshot.counts.licenses,
              href: '/dashboard/education/degrees',
            },
            {
              label: 'Courses',
              value: snapshot.counts.courses,
              href: '/dashboard/education/degrees',
            },
            { label: 'Goals', value: snapshot.counts.goals, href: '/dashboard/education/goals' },
          ]}
          emptyTitle="Build your education record"
          emptyHint="Add your degrees, certificates, licenses, and courses to unlock ROI analysis and recommendations."
          ctaHref="/dashboard/education/degrees"
          ctaLabel="Add education"
        />
      )}

      {/* 9. Related Recommendations */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
          Related education recommendations
        </div>
        <p className="text-sm text-gray-500">
          Education recommendations appear once your goal and records are in place.{' '}
          <Link href="/dashboard/education/recommendations" className="text-indigo-600">
            View all →
          </Link>
        </p>
      </div>

      {/* 8. Related Documents */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
          Related documents
        </div>
        <p className="text-sm text-gray-500">
          Transcripts, certifications, and degree plans power your education analysis.{' '}
          <Link href="/dashboard/education/documents" className="text-indigo-600">
            Manage documents →
          </Link>
        </p>
      </div>
    </DomainOverview>
  );
}
