'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import type { UserGraphProfileSummary } from '@/types/discovery';

const DRIVER_LABEL: Record<string, string> = {
  financial_security: 'Financial Security',
  image: 'Image',
  performance: 'Performance',
};

export default function ReviewPage() {
  const [summary, setSummary] = useState<UserGraphProfileSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/onboarding/profile-summary');
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error ?? 'Failed to load summary');
        setSummary(body.summary as UserGraphProfileSummary);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'load failed');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }
  if (error || !summary) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
            {error ?? 'No summary available.'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <header className="space-y-2">
          <Link href="/onboarding/hub" className="text-sm text-blue-600 hover:underline">
            ← Back to setup
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Your LifeNavigator Profile
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            A snapshot of everything LifeNavigator knows about you, drawn from your User Graph. Edit
            any section by jumping back into onboarding.
          </p>
        </header>

        <Card title="Life Vision" edit="/onboarding/questionnaire">
          {summary.life_vision.length === 0 ? (
            <Empty>No vision captured yet.</Empty>
          ) : (
            <ul className="space-y-1 text-sm">
              {summary.life_vision.map((v) => (
                <li key={v.horizon}>
                  <span className="font-semibold capitalize">{v.horizon.replace(/_/g, ' ')}</span>:{' '}
                  {v.vision_text ?? '—'}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Root Goals & Drivers" edit="/onboarding/converse">
          {summary.root_goals.length === 0 ? (
            <Empty>No goals discovered yet — start a conversation with a specialist.</Empty>
          ) : (
            <ul className="space-y-3">
              {summary.root_goals.map((g) => (
                <li
                  key={g.id}
                  className="border border-gray-200 dark:border-gray-700 rounded p-3 text-sm space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <div className="font-semibold">{g.title}</div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700">
                        {g.category}
                      </span>
                      {g.dominant_driver && (
                        <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-200">
                          {DRIVER_LABEL[g.dominant_driver]}
                        </span>
                      )}
                      {g.urgency && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-200">
                          {g.urgency}
                        </span>
                      )}
                    </div>
                  </div>
                  {g.stated_goal && (
                    <div className="text-gray-600 dark:text-gray-300">
                      <em>You stated:</em> {g.stated_goal}
                    </div>
                  )}
                  {g.root_goal && (
                    <div className="text-gray-600 dark:text-gray-300">
                      <em>Root goal:</em> {g.root_goal}
                    </div>
                  )}
                  {g.success_definition && (
                    <div className="text-gray-600 dark:text-gray-300">
                      <em>Success looks like:</em> {g.success_definition}
                    </div>
                  )}
                  {g.confidence !== null && (
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      confidence: {Math.round((g.confidence ?? 0) * 100)}%
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Dominant Drivers (averaged across goals)">
          <ul className="grid grid-cols-3 gap-3 text-sm">
            {(['financial_security', 'image', 'performance'] as const).map((d) => (
              <li key={d} className="border border-gray-200 dark:border-gray-700 rounded p-3">
                <div className="text-xs uppercase text-gray-500">{DRIVER_LABEL[d]}</div>
                <div className="text-2xl font-bold">
                  {Math.round((summary.dominant_drivers[d] ?? 0) * 100)}%
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Major Constraints" edit="/onboarding/sections/financial">
          {summary.major_constraints.length === 0 ? (
            <Empty>No constraints captured.</Empty>
          ) : (
            <ul className="text-sm space-y-1">
              {summary.major_constraints.map((c, i) => (
                <li key={i}>
                  <span className="font-semibold capitalize">{c.dimension}</span> ({c.severity}) —{' '}
                  {c.description}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Risk Profile" edit="/onboarding/questionnaire">
          {summary.risk_profile.length === 0 ? (
            <Empty>No per-domain risk tolerance captured.</Empty>
          ) : (
            <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
              {summary.risk_profile.map((r) => (
                <li
                  key={r.domain}
                  className="border border-gray-200 dark:border-gray-700 rounded p-2"
                >
                  <div className="text-xs uppercase text-gray-500 capitalize">{r.domain}</div>
                  <div>
                    {Math.round((r.tolerance_score ?? 0) * 100)}%
                    {r.qualitative_level ? (
                      <span className="text-xs text-gray-500">
                        {' '}
                        · {r.qualitative_level.replace(/_/g, ' ')}
                      </span>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Decision Preferences" edit="/onboarding/questionnaire">
          {summary.decision_preferences.length === 0 ? (
            <Empty>No decision preferences captured.</Empty>
          ) : (
            <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
              {summary.decision_preferences.map((p) => (
                <li
                  key={p.axis}
                  className="border border-gray-200 dark:border-gray-700 rounded p-2"
                >
                  <div className="text-xs uppercase text-gray-500">{p.axis.replace(/_/g, ' ')}</div>
                  <div>{Math.round((p.weight ?? 0) * 100)}%</div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Capabilities" edit="/onboarding/sections/career">
          {summary.capabilities.length === 0 ? (
            <Empty>No capabilities captured.</Empty>
          ) : (
            <ul className="text-sm flex flex-wrap gap-2">
              {summary.capabilities.map((c) => (
                <li
                  key={c.capability_name}
                  className="px-2 py-1 rounded bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200"
                >
                  {c.capability_name}{' '}
                  <span className="text-xs text-gray-500">({c.proficiency_level})</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Initial Opportunities">
          {summary.initial_opportunities.length === 0 ? (
            <Empty>No opportunities surfaced yet.</Empty>
          ) : (
            <ul className="list-disc pl-5 text-sm space-y-1">
              {summary.initial_opportunities.map((o, i) => (
                <li key={i}>{o}</li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Missing Information">
          {summary.missing_information.length === 0 ? (
            <Empty>Looking good — nothing critical missing.</Empty>
          ) : (
            <ul className="list-disc pl-5 text-sm space-y-1 text-amber-700 dark:text-amber-200">
              {summary.missing_information.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          )}
        </Card>

        <div className="pt-2 flex justify-end gap-2">
          <Link
            href="/dashboard"
            className="px-4 py-2 text-sm rounded bg-blue-600 hover:bg-blue-700 text-white"
          >
            Go to Dashboard →
          </Link>
        </div>
      </div>
    </div>
  );
}

function Card({
  title,
  edit,
  children,
}: {
  title: string;
  edit?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-900 dark:text-white">{title}</h2>
        {edit && (
          <Link href={edit} className="text-xs text-blue-600 hover:underline">
            Edit
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm italic text-gray-500 dark:text-gray-400">{children}</p>;
}
