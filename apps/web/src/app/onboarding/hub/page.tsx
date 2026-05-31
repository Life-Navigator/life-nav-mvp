'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabase/client';
import type { OnboardingSectionKey, OnboardingSectionStatus } from '@/types/intake';

interface SectionStatusRow {
  section: OnboardingSectionKey;
  status: OnboardingSectionStatus;
  completed_at: string | null;
  updated_at: string | null;
}

interface SectionDescriptor {
  key: OnboardingSectionKey;
  title: string;
  description: string;
  href: string;
  estimate: string;
}

const SECTIONS: SectionDescriptor[] = [
  {
    key: 'core_life_vision',
    title: 'Core Life Vision',
    description: '1y / 3y / 5y / 10y vision, definition of success, fears to avoid.',
    href: '/onboarding/questionnaire',
    estimate: '5 min',
  },
  {
    key: 'financial',
    title: 'Financial',
    description: 'Income, expenses, debts, emergency fund, tax-advantaged accounts.',
    href: '/onboarding/sections/financial',
    estimate: '8 min',
  },
  {
    key: 'career',
    title: 'Career',
    description: 'Income trajectory, target role, upskilling time, job-change posture.',
    href: '/onboarding/sections/career',
    estimate: '4 min',
  },
  {
    key: 'education',
    title: 'Education',
    description: 'Credentials, target programs, GI Bill, employer tuition, ROI preference.',
    href: '/onboarding/sections/education',
    estimate: '4 min',
  },
  {
    key: 'health_wellness',
    title: 'Health & Wellness',
    description:
      'Body measurements, training, injuries, daily wellbeing, nutrition. Optional today, required for Arcana.',
    href: '/onboarding/sections/health',
    estimate: '10 min',
  },
  {
    key: 'insurance_benefits',
    title: 'Insurance & Benefits',
    description: 'Medical, dental, vision, disability plans. Upload a card if you have one.',
    href: '/onboarding/sections/insurance',
    estimate: '6 min',
  },
  {
    key: 'family_lifestyle',
    title: 'Family & Lifestyle',
    description: 'Marital status, dependents, elder care, relocation, travel, priorities.',
    href: '/onboarding/sections/family-lifestyle',
    estimate: '5 min',
  },
  {
    key: 'risk_decision_preferences',
    title: 'Risk & Decision Preferences',
    description: 'Per-domain risk tolerance and what the Navigator should optimize for.',
    href: '/onboarding/questionnaire',
    estimate: '4 min',
  },
  {
    key: 'commitment_capacity',
    title: 'Commitment Capacity',
    description: 'How much time and energy you can put into each area right now.',
    href: '/onboarding/questionnaire',
    estimate: '2 min',
  },
  {
    key: 'final_review',
    title: 'Final Review',
    description: 'Confirm everything is in good shape and finish setup.',
    href: '/dashboard',
    estimate: '1 min',
  },
];

function statusBadge(status: OnboardingSectionStatus) {
  const cls: Record<OnboardingSectionStatus, string> = {
    not_started:
      'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-700',
    in_progress:
      'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-700',
    skipped:
      'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700',
    completed:
      'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700',
  };
  const label: Record<OnboardingSectionStatus, string> = {
    not_started: 'Not started',
    in_progress: 'In progress',
    skipped: 'Skipped',
    completed: 'Completed',
  };
  return (
    <span className={`inline-block px-2 py-0.5 text-xs rounded border ${cls[status]}`}>
      {label[status]}
    </span>
  );
}

export default function OnboardingHubPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [statuses, setStatuses] = useState<Record<string, SectionStatusRow>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      router.push('/auth/login');
      return;
    }
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        router.push('/auth/login');
        return;
      }
      try {
        const res = await fetch('/api/onboarding/sections');
        if (!res.ok) throw new Error((await res.text()) || 'Failed to load sections');
        const body = (await res.json()) as { sections: SectionStatusRow[] };
        const map: Record<string, SectionStatusRow> = {};
        for (const s of body.sections) map[s.section] = s;
        setStatuses(map);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load sections');
      } finally {
        setLoading(false);
      }
    });
  }, [router]);

  const markSkipped = async (key: OnboardingSectionKey) => {
    setStatuses((prev) => ({
      ...prev,
      [key]: {
        section: key,
        status: 'skipped',
        completed_at: null,
        updated_at: new Date().toISOString(),
      },
    }));
    await fetch('/api/onboarding/sections', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ section: key, status: 'skipped' }),
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  const completedCount = SECTIONS.filter((s) => statuses[s.key]?.status === 'completed').length;
  const totalCount = SECTIONS.length;
  const percent = Math.round((completedCount / totalCount) * 100);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Set up LifeNavigator</h1>
          <p className="text-gray-600 dark:text-gray-300">
            Work through these sections in any order. Anything you skip you can come back to later —
            you don't have to finish all of them to use the app.
          </p>
          <div className="pt-2">
            <div className="flex items-center justify-between mb-1 text-sm text-gray-600 dark:text-gray-300">
              <span>
                {completedCount} of {totalCount} sections complete
              </span>
              <span>{percent}%</span>
            </div>
            <div className="h-2 rounded bg-gray-200 dark:bg-gray-800 overflow-hidden">
              <div className="h-full bg-blue-600 transition-all" style={{ width: `${percent}%` }} />
            </div>
          </div>
        </header>

        {error && (
          <div className="rounded border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/30 p-3 text-sm text-red-800 dark:text-red-200">
            {error}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Link
            href="/onboarding/converse"
            className="px-3 py-1.5 text-sm rounded bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            Have a conversation with a specialist →
          </Link>
          <Link
            href="/onboarding/review"
            className="px-3 py-1.5 text-sm rounded border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Review my profile
          </Link>
        </div>

        <ul className="space-y-3">
          {SECTIONS.map((section) => {
            const row = statuses[section.key];
            const status = row?.status ?? 'not_started';
            return (
              <li
                key={section.key}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold text-gray-900 dark:text-white">{section.title}</h2>
                    {statusBadge(status)}
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      ~{section.estimate}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                    {section.description}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    href={section.href}
                    className="px-3 py-1.5 text-sm rounded bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {status === 'completed'
                      ? 'Review'
                      : status === 'in_progress'
                        ? 'Resume'
                        : 'Start'}
                  </Link>
                  {status !== 'completed' && status !== 'skipped' && (
                    <button
                      type="button"
                      onClick={() => markSkipped(section.key)}
                      className="px-3 py-1.5 text-sm rounded border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      Skip
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        <div className="pt-4">
          <Link
            href="/dashboard"
            className="text-sm text-gray-500 dark:text-gray-400 hover:underline"
          >
            Go to dashboard →
          </Link>
        </div>
      </div>
    </div>
  );
}
