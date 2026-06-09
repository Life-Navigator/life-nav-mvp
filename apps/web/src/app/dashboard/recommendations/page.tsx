'use client';

// Recommendation Inbox (Sprint 26) — the Recommendation OS made visible. Every recommendation
// across the platform, in one prioritized list; accept / defer / dismiss / complete. This is the
// SAME source the dashboard, chat, reports, and graph read — one answer everywhere.

import React, { useCallback, useEffect, useState } from 'react';

interface Action {
  id: string;
  title: string;
  category: string;
  source_module: string;
  priority: string;
  confidence: number | null;
  rank_score: number;
  why: string;
  recommended_action: string;
  expected_benefit?: string;
  impacted_domains?: string[];
}
interface Conflict {
  resource: string;
  reason: string;
  competing: { title: string; priority: string }[];
  suggested_sequence: string[];
}
interface Pri {
  total: number;
  top_actions: Action[];
  conflicts: Conflict[];
  note: string;
}

const PRI: Record<string, string> = {
  high: 'bg-rose-100 text-rose-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-gray-100 text-gray-600',
};

export default function RecommendationsPage() {
  const [data, setData] = useState<Pri | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    const r = await fetch('/api/recommendations')
      .then((x) => (x.ok ? x.json() : null))
      .catch(() => null);
    setData(r);
    setLoading(false);
  }, []);
  useEffect(() => {
    // sync first so the inbox reflects every module, then load the prioritized list
    fetch('/api/recommendations', { method: 'POST' })
      .catch(() => {})
      .finally(load);
  }, [load]);

  const act = async (id: string, status: string) => {
    setBusy(id);
    await fetch('/api/recommendations', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    }).catch(() => {});
    await load();
    setBusy('');
  };

  if (loading)
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-gray-500">Loading your recommendations…</div>
    );
  if (!data)
    return <div className="max-w-4xl mx-auto px-4 py-8 text-gray-500">Unavailable right now.</div>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900">Recommendations</h1>
      <p className="text-sm text-gray-500 mt-1">
        Every recommendation across LifeNavigator, prioritized into one list — the same answer your
        dashboard, chat, and reports give. {data.total} active.
      </p>

      {data.conflicts.length > 0 && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <h2 className="text-sm font-semibold text-amber-800">Competing priorities</h2>
          {data.conflicts.map((c, i) => (
            <div key={i} className="text-sm text-amber-800 mt-1">
              {c.reason}{' '}
              <span className="text-amber-600">
                Suggested order: {c.suggested_sequence.join(' → ')}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-5 space-y-3">
        {data.top_actions.map((a, i) => (
          <div key={a.id} className="bg-white rounded-lg shadow-sm border border-gray-100 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-400">#{i + 1}</span>
                  <h3 className="font-semibold text-gray-900">{a.title}</h3>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase ${PRI[a.priority] ?? PRI.low}`}
                  >
                    {a.priority}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mt-1">{a.why}</p>
                {a.recommended_action && (
                  <p className="text-sm text-gray-700 mt-1">
                    <b>Do:</b> {a.recommended_action}
                  </p>
                )}
                <div className="text-xs text-gray-400 mt-1">
                  {a.source_module} · confidence {Math.round((a.confidence ?? 0) * 100)}%
                  {a.expected_benefit ? ` · ${a.expected_benefit}` : ''}
                </div>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              {[
                ['accepted', 'Accept'],
                ['in_progress', 'Start'],
                ['deferred', 'Defer'],
                ['completed', 'Complete'],
                ['dismissed', 'Dismiss'],
              ].map(([s, label]) => (
                <button
                  key={s}
                  disabled={busy === a.id}
                  onClick={() => act(a.id, s)}
                  className={`text-xs px-2.5 py-1 rounded-md border ${s === 'dismissed' ? 'border-gray-200 text-gray-500' : 'border-indigo-200 text-indigo-700 hover:bg-indigo-50'} disabled:opacity-40`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        ))}
        {data.top_actions.length === 0 && (
          <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-800">
            No active recommendations yet — upload a document (offer letter, benefits, 401k) and
            your recommendations will appear here.
          </div>
        )}
      </div>
      <p className="mt-4 text-xs text-gray-400">{data.note}</p>
    </div>
  );
}
