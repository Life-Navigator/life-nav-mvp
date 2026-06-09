'use client';

// Mission Control (Sprint 23) — the dashboard hero that answers, instantly: What is my status?
// What should I do next? Why? Plus the first-10-minutes journey. Outcome language; no dead ends.

import Link from 'next/link';
import React, { useEffect, useState } from 'react';

type Status = 'green' | 'yellow' | 'orange' | 'red';
interface NBA {
  title: string;
  why: string;
  cta_label: string;
  href: string;
  step: string;
}
interface Gap {
  domain: string;
  label: string;
  status: Status;
  gap: string;
  href: string;
}
interface MissingDoc {
  doc_type: string;
  title: string;
  why: string;
}
interface Dash {
  status: { index: number; status: Status; headline: string; summary: string };
  next_best_action: NBA;
  top_gaps: Gap[];
  missing_critical_documents: MissingDoc[];
  open_decisions: number;
  reports_generated: number;
  documents_on_file: number;
  journey: {
    documents: boolean;
    readiness: boolean;
    gaps_identified: boolean;
    decision_analyzed: boolean;
    report_generated: boolean;
  };
}

const RING: Record<Status, string> = {
  green: 'border-emerald-500 text-emerald-700',
  yellow: 'border-amber-400 text-amber-700',
  orange: 'border-orange-500 text-orange-700',
  red: 'border-rose-500 text-rose-700',
};
const JOURNEY: [keyof Dash['journey'], string][] = [
  ['documents', 'Add documents'],
  ['readiness', 'See readiness'],
  ['gaps_identified', 'Find your gaps'],
  ['decision_analyzed', 'Analyze a decision'],
  ['report_generated', 'Generate a report'],
];

export default function MissionControl() {
  const [d, setD] = useState<Dash | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let on = true;
    fetch('/api/platform/dashboard')
      .then(async (r) => (r.ok ? ((await r.json()) as Dash) : null))
      .then((x) => {
        if (on) {
          setD(x);
          setLoading(false);
        }
      })
      .catch(() => {
        if (on) setLoading(false);
      });
    return () => {
      on = false;
    };
  }, []);

  if (loading || !d || !d.status) return null;
  const s = d.status;
  const ring = RING[s.status] ?? RING.yellow;

  return (
    <div className="mb-6">
      {/* Status + Next best action */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex items-center gap-4">
          <div
            className={`w-20 h-20 rounded-full border-4 ${ring} flex items-center justify-center bg-white shrink-0`}
          >
            <span className="text-2xl font-extrabold">{s.index}</span>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold">
              Your Life Readiness
            </div>
            <div className="text-sm font-semibold text-gray-900 mt-0.5">{s.headline}</div>
            <div className="text-xs text-gray-500 mt-1">{s.summary}</div>
          </div>
        </div>

        {/* The single next best action — the answer to "what should I do next, and why" */}
        <div className="lg:col-span-2 rounded-xl shadow-sm border-2 border-indigo-200 bg-indigo-50 p-6 flex flex-col justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-indigo-500 font-semibold">
              Your next best move
            </div>
            <div className="text-lg font-bold text-gray-900 mt-1">{d.next_best_action.title}</div>
            <div className="text-sm text-gray-600 mt-1">{d.next_best_action.why}</div>
          </div>
          <Link
            href={d.next_best_action.href}
            className="mt-3 inline-flex w-fit items-center px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
          >
            {d.next_best_action.cta_label} →
          </Link>
        </div>
      </div>

      {/* Journey progress */}
      <div className="mt-4 bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
          {JOURNEY.map(([k, label], i) => {
            const done = d.journey[k];
            return (
              <React.Fragment key={k}>
                <span
                  className={`flex items-center gap-1.5 text-xs ${done ? 'text-emerald-700' : 'text-gray-400'}`}
                >
                  <span
                    className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${done ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-500'}`}
                  >
                    {done ? '✓' : i + 1}
                  </span>
                  {label}
                </span>
                {i < JOURNEY.length - 1 && <span className="text-gray-200">—</span>}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Gaps + missing documents — outcome-framed, every item links somewhere */}
      {(d.top_gaps.length > 0 || d.missing_critical_documents.length > 0) && (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          {d.top_gaps.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h3 className="text-sm font-semibold text-gray-800">Your biggest gaps</h3>
              <div className="mt-2 space-y-2">
                {d.top_gaps.map((g) => (
                  <Link
                    key={g.domain}
                    href={g.href}
                    className="block text-sm hover:bg-gray-50 rounded-md -mx-2 px-2 py-1"
                  >
                    <span
                      className={`inline-block w-2 h-2 rounded-full mr-2 ${g.status === 'red' ? 'bg-rose-500' : g.status === 'orange' ? 'bg-orange-500' : 'bg-amber-400'}`}
                    />
                    <span className="text-gray-700">{g.gap}</span>
                    <span className="text-gray-400 text-xs"> · {g.label} →</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
          {d.missing_critical_documents.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h3 className="text-sm font-semibold text-gray-800">Unlock more by uploading</h3>
              <div className="mt-2 space-y-2">
                {d.missing_critical_documents.map((m) => (
                  <Link
                    key={m.doc_type}
                    href="/dashboard/documents"
                    className="block text-sm hover:bg-gray-50 rounded-md -mx-2 px-2 py-1"
                  >
                    <span className="text-gray-800 font-medium">{m.title}</span>
                    <span className="block text-xs text-gray-500">{m.why}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
