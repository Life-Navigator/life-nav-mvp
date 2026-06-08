'use client';

// Executive Dashboard (Sprint 9) — beta instrumentation at a glance: Users, Reports, Shares,
// Goals, Domain Usage, Decisions, funnel + retention. Aggregate COUNTS only — no PII, no user
// content (the Core API returns counts, never rows).

import React, { useEffect, useState } from 'react';

interface Metrics {
  users: { total_active: number; active_7d: number; active_30d: number; retention_7d_pct: number };
  reports: { total: number; by_type: Record<string, number> };
  shares: { total: number; active: number; accesses: number; by_audience: Record<string, number> };
  goals: { career: number; education: number; total: number };
  decisions: { total: number; by_type: Record<string, number> };
  domain_usage: Record<string, number>;
  funnel: { events_total: number; by_type: Record<string, number> };
  generated_at?: string;
}

function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="bg-white rounded-lg shadow-md p-5">
      <div className="text-xs uppercase tracking-wide text-gray-400">{label}</div>
      <div className="text-2xl font-bold text-gray-900 mt-1">{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    </div>
  );
}

function Breakdown({ title, data }: { title: string; data: Record<string, number> }) {
  const entries = Object.entries(data).filter(([, v]) => v > 0);
  const max = Math.max(1, ...entries.map(([, v]) => v));
  return (
    <div className="bg-white rounded-lg shadow-md p-5">
      <h3 className="font-semibold text-gray-800 mb-3">{title}</h3>
      {entries.length === 0 ? (
        <p className="text-sm text-gray-400">No data yet.</p>
      ) : (
        <div className="space-y-2">
          {entries.map(([k, v]) => (
            <div key={k}>
              <div className="flex justify-between text-sm text-gray-700">
                <span className="capitalize">{k.replace(/_/g, ' ')}</span>
                <span className="font-semibold">{v}</span>
              </div>
              <div className="h-1.5 rounded-full bg-gray-100 mt-0.5">
                <div
                  className="h-1.5 rounded-full bg-indigo-500"
                  style={{ width: `${(v / max) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MetricsPage() {
  const [m, setM] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/admin/metrics')
      .then(async (r) => (r.ok ? ((await r.json()) as Metrics) : Promise.reject(r.status)))
      .then((d) => {
        if (active) {
          setM(d);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setErr('Metrics unavailable');
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading)
    return <div className="max-w-6xl mx-auto px-4 py-8 text-gray-500">Loading metrics…</div>;
  if (err || !m)
    return (
      <div className="max-w-6xl mx-auto px-4 py-8 text-gray-500">
        {err ?? 'Metrics unavailable'}
      </div>
    );

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900">Executive Dashboard</h1>
      <p className="text-sm text-gray-500 mt-1">
        Beta instrumentation — aggregate counts only, no user data.
      </p>

      <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat
          label="Active Users"
          value={m.users.total_active}
          sub={`${m.users.active_7d} in last 7d · ${m.users.retention_7d_pct}% retention`}
        />
        <Stat
          label="Reports"
          value={m.reports.total}
          sub={`${Object.keys(m.reports.by_type).filter((k) => m.reports.by_type[k] > 0).length} types`}
        />
        <Stat
          label="Shares"
          value={m.shares.total}
          sub={`${m.shares.active} active · ${m.shares.accesses} views`}
        />
        <Stat label="Decisions" value={m.decisions.total} />
        <Stat
          label="Goals"
          value={m.goals.total}
          sub={`${m.goals.career} career · ${m.goals.education} education`}
        />
        <Stat label="Funnel events" value={m.funnel.events_total} />
        <Stat label="Active (30d)" value={m.users.active_30d} />
      </div>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Breakdown title="Domain Usage (recommendations)" data={m.domain_usage} />
        <Breakdown title="Reports by Type" data={m.reports.by_type} />
        <Breakdown title="Shares by Audience" data={m.shares.by_audience} />
        <Breakdown title="Decisions by Type" data={m.decisions.by_type} />
        <Breakdown title="Funnel by Event" data={m.funnel.by_type} />
      </div>

      {m.generated_at && (
        <div className="mt-6 text-xs text-gray-400">
          As of {new Date(m.generated_at).toLocaleString()}
        </div>
      )}
    </div>
  );
}
