'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

interface CandidateMatch {
  id: string;
  match_score: number;
  status: string;
  missing_requirements: string[];
  employer_facing_summary: string;
  skills_score: number;
  certifications_score: number;
  education_score: number;
  salary_fit_score: number;
  location_fit_score: number;
  growth_alignment_score: number;
  job?: {
    id: string;
    title: string;
    remote_mode: string | null;
    salary_min: number | null;
    salary_max: number | null;
    experience_level: string | null;
    industry: string | null;
  };
  employer?: {
    id: string;
    display_name: string | null;
    legal_name: string;
    industry: string | null;
  };
}

const ACTION_LABELS: Record<string, string> = {
  save: 'Save',
  dismiss: 'Dismiss',
  apply: 'Apply',
  consent_to_intro: 'Allow introduction',
};

export default function CandidateMatchesPage() {
  const [matches, setMatches] = useState<CandidateMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/jobs/matches');
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? 'load failed');
      setMatches(body.matches ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'load failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
  }, []);

  const act = async (id: string, action: keyof typeof ACTION_LABELS) => {
    const res = await fetch(`/api/jobs/matches/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    if (res.ok) void reload();
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-10 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <header className="space-y-2">
          <Link href="/dashboard" className="text-sm text-blue-600 hover:underline">
            ← Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Job matches</h1>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            These roles match your career profile. Employers see an anonymized summary of your fit;
            they only see your identity if you allow an introduction or apply directly.
          </p>
        </header>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin h-10 w-10 rounded-full border-b-2 border-blue-600" />
          </div>
        ) : error ? (
          <p className="text-sm text-red-700">{error}</p>
        ) : matches.length === 0 ? (
          <p className="text-sm italic text-gray-500">
            No matches yet. Make sure your career profile is up to date — visit{' '}
            <Link href="/dashboard/career" className="text-blue-600 hover:underline">
              /dashboard/career
            </Link>
            .
          </p>
        ) : (
          <ul className="space-y-3">
            {matches.map((m) => (
              <li
                key={m.id}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-2"
              >
                <header className="flex items-center justify-between">
                  <div>
                    <h2 className="font-semibold text-gray-900 dark:text-white">
                      {m.job?.title ?? 'Untitled role'}
                    </h2>
                    <p className="text-xs text-gray-500">
                      {m.employer?.display_name ?? m.employer?.legal_name ?? '—'}
                      {m.job?.industry ? ` · ${m.job.industry}` : ''}
                      {' · '}
                      {m.job?.remote_mode ?? '—'} · {m.job?.salary_min ?? '—'}–
                      {m.job?.salary_max ?? '—'}
                    </p>
                  </div>
                  <span className="text-sm rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 px-2 py-0.5">
                    {Math.round(m.match_score)}/100
                  </span>
                </header>

                <p className="text-sm text-gray-700 dark:text-gray-200">
                  {m.employer_facing_summary}
                </p>

                <div className="text-xs text-gray-500 dark:text-gray-400 flex flex-wrap gap-x-3 gap-y-1">
                  <span>Skills {m.skills_score}</span>
                  <span>Education {m.education_score}</span>
                  <span>Salary {m.salary_fit_score}</span>
                  <span>Location {m.location_fit_score}</span>
                  <span>Growth {m.growth_alignment_score}</span>
                </div>

                {m.missing_requirements.length > 0 && (
                  <p className="text-xs text-amber-700 dark:text-amber-200">
                    Missing: {m.missing_requirements.slice(0, 4).join(', ')}
                    {m.missing_requirements.length > 4 ? '…' : ''}
                  </p>
                )}

                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-gray-500">{m.status.replace(/_/g, ' ')}</span>
                  <div className="flex gap-2">
                    {m.status === 'surfaced' && (
                      <>
                        <button
                          onClick={() => act(m.id, 'dismiss')}
                          className="px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600"
                        >
                          Dismiss
                        </button>
                        <button
                          onClick={() => act(m.id, 'save')}
                          className="px-2 py-1 text-xs rounded border border-blue-300"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => act(m.id, 'apply')}
                          className="px-2 py-1 text-xs rounded bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          Apply
                        </button>
                      </>
                    )}
                    {m.status === 'intro_requested' && (
                      <>
                        <button
                          onClick={() => act(m.id, 'dismiss')}
                          className="px-2 py-1 text-xs rounded border border-gray-300"
                        >
                          Decline
                        </button>
                        <button
                          onClick={() => act(m.id, 'consent_to_intro')}
                          className="px-2 py-1 text-xs rounded bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          Allow intro
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        <p className="text-xs text-gray-500 dark:text-gray-400">
          <strong>Privacy:</strong> Employers see only your skills / certifications summary, score
          breakdown, and missing-requirements list until you consent to an introduction. Visit{' '}
          <Link href="/dashboard/career" className="text-blue-600 hover:underline">
            /dashboard/career
          </Link>{' '}
          to control your visibility setting.
        </p>
      </div>
    </div>
  );
}
