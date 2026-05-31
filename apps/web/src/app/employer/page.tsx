'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

interface EmployerProfile {
  id: string;
  legal_name: string;
  display_name: string | null;
  industry: string | null;
  status: string;
  veteran_friendly: boolean;
}
interface JobRow {
  id: string;
  title: string;
  employment_type: string | null;
  remote_mode: string | null;
  experience_level: string | null;
  salary_min: number | null;
  salary_max: number | null;
  status: string;
  published_at: string | null;
  created_at: string;
}

export default function EmployerHubPage() {
  const [employer, setEmployer] = useState<EmployerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Profile form
  const [legalName, setLegalName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [industry, setIndustry] = useState('');

  // Job form
  const [showJobForm, setShowJobForm] = useState(false);
  const [jTitle, setJTitle] = useState('');
  const [jDescription, setJDescription] = useState('');
  const [jSalaryMin, setJSalaryMin] = useState<number | ''>('');
  const [jSalaryMax, setJSalaryMax] = useState<number | ''>('');
  const [jRemote, setJRemote] = useState<'remote' | 'hybrid' | 'on_site' | ''>('');
  const [jExperience, setJExperience] = useState<string>('');
  const [jRequiredSkills, setJRequiredSkills] = useState('');
  const [jPreferredSkills, setJPreferredSkills] = useState('');

  const reload = async () => {
    setLoading(true);
    try {
      const profileRes = await fetch('/api/employer/profile');
      const profileBody = await profileRes.json();
      setEmployer(profileBody.employer ?? null);
      if (profileBody.employer) {
        const jobsRes = await fetch('/api/employer/jobs');
        const jobsBody = await jobsRes.json();
        setJobs(jobsBody.jobs ?? []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
  }, []);

  const createProfile = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/employer/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          legal_name: legalName,
          display_name: displayName || undefined,
          industry: industry || undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? 'create failed');
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'create failed');
    } finally {
      setBusy(false);
    }
  };

  const createJob = async () => {
    if (!jTitle.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const requirements: Array<{ requirement_kind: string; value: string }> = [];
      for (const s of jRequiredSkills
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean)) {
        requirements.push({ requirement_kind: 'skill_required', value: s });
      }
      for (const s of jPreferredSkills
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean)) {
        requirements.push({ requirement_kind: 'skill_preferred', value: s });
      }
      const res = await fetch('/api/employer/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: jTitle,
          description: jDescription || undefined,
          remote_mode: jRemote || undefined,
          experience_level: jExperience || undefined,
          salary_min: jSalaryMin === '' ? undefined : Number(jSalaryMin),
          salary_max: jSalaryMax === '' ? undefined : Number(jSalaryMax),
          requirements,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? 'create failed');
      setShowJobForm(false);
      setJTitle('');
      setJDescription('');
      setJSalaryMin('');
      setJSalaryMax('');
      setJRequiredSkills('');
      setJPreferredSkills('');
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'create job failed');
    } finally {
      setBusy(false);
    }
  };

  const publishJob = async (id: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/employer/jobs/${id}/publish`, { method: 'POST' });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? 'publish failed');
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'publish failed');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!employer) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-10 px-4">
        <div className="max-w-2xl mx-auto space-y-6">
          <h1 className="text-2xl font-bold">Create your employer profile</h1>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            LifeNavigator matches candidates to your roles based on skills, salary, and location
            alignment. Candidates control whether you see their identity. We never match on
            protected characteristics.
          </p>
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3">
            <input
              type="text"
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
              placeholder="Legal company name"
              className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2 text-sm"
            />
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Display name (optional)"
              className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2 text-sm"
            />
            <input
              type="text"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              placeholder="Industry (optional)"
              className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2 text-sm"
            />
            {error && <div className="text-xs text-red-700">{error}</div>}
            <div className="flex justify-end">
              <button
                onClick={createProfile}
                disabled={busy || !legalName.trim()}
                className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm disabled:bg-blue-400"
              >
                {busy ? 'Creating…' : 'Create employer profile'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-10 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {employer.display_name ?? employer.legal_name}
            </h1>
            <p className="text-xs text-gray-500">
              {employer.status} · {employer.industry ?? 'industry not set'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowJobForm((s) => !s)}
            className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm"
          >
            {showJobForm ? 'Cancel' : 'Post a job'}
          </button>
        </header>

        {showJobForm && (
          <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3">
            <h2 className="font-semibold">New job post</h2>
            <input
              type="text"
              value={jTitle}
              onChange={(e) => setJTitle(e.target.value)}
              placeholder="Job title"
              className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2 text-sm"
            />
            <textarea
              value={jDescription}
              onChange={(e) => setJDescription(e.target.value)}
              rows={3}
              placeholder="Description"
              className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2 text-sm"
            />
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-sm">
              <input
                type="number"
                value={jSalaryMin}
                onChange={(e) => setJSalaryMin(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="Salary min"
                className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2"
              />
              <input
                type="number"
                value={jSalaryMax}
                onChange={(e) => setJSalaryMax(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="Salary max"
                className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2"
              />
              <select
                value={jRemote}
                onChange={(e) => setJRemote(e.target.value as typeof jRemote)}
                className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2"
              >
                <option value="">Mode…</option>
                <option value="remote">Remote</option>
                <option value="hybrid">Hybrid</option>
                <option value="on_site">On-site</option>
              </select>
              <select
                value={jExperience}
                onChange={(e) => setJExperience(e.target.value)}
                className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2"
              >
                <option value="">Level…</option>
                <option value="intern">Intern</option>
                <option value="entry">Entry</option>
                <option value="mid">Mid</option>
                <option value="senior">Senior</option>
                <option value="lead">Lead</option>
                <option value="principal">Principal</option>
                <option value="executive">Executive</option>
              </select>
            </div>
            <input
              type="text"
              value={jRequiredSkills}
              onChange={(e) => setJRequiredSkills(e.target.value)}
              placeholder="Required skills (comma separated)"
              className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2 text-sm"
            />
            <input
              type="text"
              value={jPreferredSkills}
              onChange={(e) => setJPreferredSkills(e.target.value)}
              placeholder="Preferred skills (comma separated)"
              className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2 text-sm"
            />
            {error && <div className="text-xs text-red-700">{error}</div>}
            <div className="flex justify-end">
              <button
                onClick={createJob}
                disabled={busy || !jTitle.trim()}
                className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm disabled:bg-blue-400"
              >
                {busy ? 'Creating…' : 'Save as draft'}
              </button>
            </div>
          </section>
        )}

        <section className="space-y-2">
          <h2 className="font-semibold">Your jobs</h2>
          {jobs.length === 0 && (
            <p className="text-sm text-gray-500 italic">No jobs yet — post one above.</p>
          )}
          <ul className="space-y-2">
            {jobs.map((j) => (
              <li
                key={j.id}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <Link
                    href={`/employer/jobs/${j.id}`}
                    className="font-medium text-blue-700 hover:underline"
                  >
                    {j.title}
                  </Link>
                  <p className="text-xs text-gray-500">
                    {j.remote_mode ?? '—'} · {j.experience_level ?? '—'} · {j.salary_min ?? '—'}–
                    {j.salary_max ?? '—'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase rounded px-2 py-0.5 bg-gray-100 dark:bg-gray-700">
                    {j.status}
                  </span>
                  {j.status === 'draft' && (
                    <button
                      onClick={() => publishJob(j.id)}
                      disabled={busy}
                      className="px-3 py-1 text-xs rounded bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      Publish & match
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>

        <p className="text-xs text-gray-500 dark:text-gray-400">
          <strong>Compliance:</strong> Matching uses only job-relevant attributes (skills,
          certifications, education, salary, location). Candidates control whether you ever see
          their identity — you'll always see anonymized summaries until they consent to an
          introduction.
        </p>
      </div>
    </div>
  );
}
