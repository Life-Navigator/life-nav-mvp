'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

interface JobDetail {
  job: {
    id: string;
    title: string;
    description: string | null;
    status: string;
    salary_min: number | null;
    salary_max: number | null;
    remote_mode: string | null;
    experience_level: string | null;
  };
  requirements: Array<{ requirement_kind: string; value: string }>;
  locations: Array<{ city: string | null; state: string | null; country: string | null }>;
}

interface AnonMatch {
  id: string;
  match_score: number;
  skills_score: number;
  certifications_score: number;
  education_score: number;
  salary_fit_score: number;
  location_fit_score: number;
  growth_alignment_score: number;
  employer_facing_summary: string;
  missing_requirements: string[];
  status: string;
}

export default function EmployerJobDetailPage() {
  const params = useParams<{ id: string }>();
  const jobId = params?.id ?? '';
  const [detail, setDetail] = useState<JobDetail | null>(null);
  const [matches, setMatches] = useState<AnonMatch[]>([]);
  const [error, setError] = useState<string | null>(null);

  const reload = async () => {
    try {
      const [d, m] = await Promise.all([
        fetch(`/api/employer/jobs/${jobId}`).then((r) => r.json()),
        fetch(`/api/employer/jobs/${jobId}/matches`).then((r) => r.json()),
      ]);
      setDetail(d);
      setMatches(m.matches ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'load failed');
    }
  };

  useEffect(() => {
    if (jobId) void reload();
  }, [jobId]);

  const requestIntro = async (id: string) => {
    const res = await fetch(`/api/employer/matches/${id}/request-intro`, { method: 'POST' });
    if (res.ok) void reload();
  };

  if (!detail) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        {error ? (
          <p className="text-sm text-red-700">{error}</p>
        ) : (
          <div className="animate-spin h-12 w-12 rounded-full border-b-2 border-blue-600" />
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-10 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <Link href="/employer" className="text-sm text-blue-600 hover:underline">
          ← Back to employer hub
        </Link>
        <header>
          <h1 className="text-2xl font-bold">{detail.job.title}</h1>
          <p className="text-xs text-gray-500">
            {detail.job.status} · {detail.job.remote_mode ?? '—'} ·{' '}
            {detail.job.experience_level ?? '—'} · {detail.job.salary_min ?? '—'}–
            {detail.job.salary_max ?? '—'}
          </p>
        </header>

        {detail.job.description && (
          <p className="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap">
            {detail.job.description}
          </p>
        )}

        <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3">
          <h2 className="font-semibold">Anonymized candidate matches</h2>
          {matches.length === 0 ? (
            <p className="text-sm text-gray-500 italic">
              No matches yet. Publish the job to surface candidates.
            </p>
          ) : (
            <ul className="space-y-2">
              {matches.map((m) => (
                <li
                  key={m.id}
                  className="border border-gray-200 dark:border-gray-700 rounded p-3 space-y-1 text-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">Match score: {m.match_score}/100</span>
                    <span className="text-xs text-gray-500">{m.status}</span>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-300">
                    Skills {m.skills_score} · Certs {m.certifications_score} · Education{' '}
                    {m.education_score} · Salary {m.salary_fit_score} · Location{' '}
                    {m.location_fit_score} · Growth {m.growth_alignment_score}
                  </p>
                  <p>{m.employer_facing_summary}</p>
                  {(m.status === 'surfaced' || m.status === 'saved') && (
                    <div className="flex justify-end">
                      <button
                        onClick={() => requestIntro(m.id)}
                        className="px-3 py-1 text-xs rounded bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        Request introduction
                      </button>
                    </div>
                  )}
                  {m.status === 'intro_consented' && (
                    <p className="text-xs text-emerald-700">
                      Candidate consented — identity will be shared in a follow-up message.
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
