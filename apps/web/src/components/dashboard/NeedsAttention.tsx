'use client';

// NeedsAttention (Addendum) — the DISCIPLINED dashboard module: exactly one Next Best Action + up to
// three attention alerts + a link to the full /dashboard/recommendations page. The dashboard is
// Mission Control, not the recommendations list. Same canonical source (/v1/life/attention).

import Link from 'next/link';
import React, { useEffect, useState } from 'react';

interface Action {
  kind?: 'action' | 'priority_issue';
  label?: string;
  title: string;
  why?: string;
  priority?: string;
  needed_to_act?: string;
  confidence_pct: number;
  quantified_impact?: Record<string, number>;
  source: string;
}
interface Alert {
  title: string;
  severity: 'high' | 'medium' | 'low';
  source: string;
  detail?: string;
  cta: string;
}
interface Attention {
  next_best_action: Action | null;
  alerts: Alert[];
  alert_count: number;
  view_all: string;
}

const SEV: Record<string, string> = {
  high: 'bg-rose-500',
  medium: 'bg-amber-500',
  low: 'bg-sky-500',
};

export default function NeedsAttention() {
  const [d, setD] = useState<Attention | null>(null);
  useEffect(() => {
    fetch('/api/life/attention')
      .then((r) => (r.ok ? r.json() : null))
      .then(setD)
      .catch(() => {});
  }, []);
  if (!d) return null;
  const a = d.next_best_action;
  const qi = a?.quantified_impact || {};

  return (
    <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Next Best Action OR Highest Priority Issue (P4 — never mislabel a risk as an action) */}
      {a && (
        <section
          className={`rounded-2xl border bg-white shadow-sm p-5 ${a.kind === 'priority_issue' ? 'border-amber-200' : 'border-indigo-100'}`}
        >
          <div
            className={`text-[11px] uppercase tracking-wide font-semibold ${a.kind === 'priority_issue' ? 'text-amber-600' : 'text-indigo-500'}`}
          >
            {a.label ||
              (a.kind === 'priority_issue' ? 'Highest priority issue' : 'Your next best action')}
          </div>
          <div className="text-lg font-bold text-gray-900 mt-1">{a.title}</div>
          {a.why && <div className="text-sm text-gray-600 mt-1">{a.why}</div>}
          {a.kind === 'priority_issue' ? (
            <div className="mt-2 text-sm text-gray-600">
              {a.priority && (
                <span className="text-amber-700 font-medium">Priority: {a.priority}. </span>
              )}
              {a.needed_to_act}
            </div>
          ) : (
            <div className="mt-2 text-sm text-emerald-700 font-medium">
              {qi.financial_impact_annual
                ? `+$${Number(qi.financial_impact_annual).toLocaleString()}/yr · `
                : ''}
              confidence {a.confidence_pct}%
            </div>
          )}
          <Link
            href={a.kind === 'priority_issue' ? '/dashboard/advisor' : '/dashboard/recommendations'}
            className="mt-3 inline-block text-sm text-indigo-600 font-medium"
          >
            {a.kind === 'priority_issue' ? 'Provide the missing info →' : 'View recommendation →'}
          </Link>
        </section>
      )}

      {/* Needs Your Attention — up to 3 alerts */}
      <section className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-800">Needs your attention</h2>
          {d.alert_count > 3 && (
            <span className="text-[11px] text-gray-400">{d.alert_count} total</span>
          )}
        </div>
        <div className="mt-2 space-y-2">
          {d.alerts.map((al, i) => (
            <Link key={i} href={al.cta} className="flex items-start gap-2 group">
              <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${SEV[al.severity]}`} />
              <span className="text-sm">
                <span className="font-medium text-gray-800 group-hover:text-indigo-600">
                  {al.title}
                </span>
                {al.detail && <span className="block text-xs text-gray-500">{al.detail}</span>}
                <span className="text-[10px] text-gray-400">Source: {al.source}</span>
              </span>
            </Link>
          ))}
          {d.alerts.length === 0 && (
            <div className="text-sm text-gray-400">Nothing needs your attention right now.</div>
          )}
        </div>
        <Link href={d.view_all} className="mt-3 inline-block text-sm text-indigo-600 font-medium">
          View all recommendations →
        </Link>
      </section>
    </div>
  );
}
