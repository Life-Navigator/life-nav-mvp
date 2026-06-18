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
  // Richer fields forwarded from the Recommendation OS top action (present only when the
  // dashboard's next-best-action comes from the spine). Rendered honestly — omit when absent.
  recommended_action?: string;
  expected_benefit?: string;
  quantified_impact?: Record<string, unknown>;
  confidence?: number;
  why_number_one?: string;
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

const JOURNEY: [keyof Dash['journey'], string][] = [
  ['documents', 'Add documents'],
  ['readiness', 'See readiness'],
  ['gaps_identified', 'Find your gaps'],
  ['decision_analyzed', 'Analyze a decision'],
  ['report_generated', 'Generate a report'],
];

const CLARITY =
  'LifeNavigator turns your documents, goals, and life data into evidence-backed decisions, prioritized actions, and advisor-ready reports.';

// Format the OS quantified_impact the same way the sample preview does — annual $ impact and the
// retirement-success lift — but only the keys actually present (never fabricate a number).
function formatImpact(qi?: Record<string, unknown>): string {
  if (!qi) return '';
  const q = qi as Record<string, number>;
  const parts: string[] = [];
  if (q.financial_impact_annual)
    parts.push(`+$${Number(q.financial_impact_annual).toLocaleString()}/yr`);
  if (q.retirement_success_before_pct && q.retirement_success_after_pct)
    parts.push(
      `retirement success ${q.retirement_success_before_pct}% → ${q.retirement_success_after_pct}%`
    );
  return parts.join(', ');
}

interface Sample {
  label: string;
  readiness: { index: number; status: Status; headline: string };
  top_recommendation: { title: string; why: string; quantified_impact?: Record<string, unknown> };
}

export default function MissionControl() {
  const [d, setD] = useState<Dash | null>(null);
  const [loading, setLoading] = useState(true);
  const [sample, setSample] = useState<Sample | null>(null);

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

  if (loading) return null;

  // Activation empty state (Sprint 32) — never a thin blank dashboard. Explain the product, guide
  // the first upload, and offer a sample preview so the value loop is visible before any upload.
  const noDocs = !d || !d.status || !d.journey?.documents;
  if (noDocs) {
    const qi = (sample?.top_recommendation.quantified_impact || {}) as Record<string, number>;
    return (
      <div className="mb-6 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="text-[11px] uppercase tracking-wide text-indigo-500 font-semibold">
          Welcome to LifeNavigator
        </div>
        <p className="text-base text-gray-800 mt-1 max-w-2xl">{CLARITY}</p>
        <div className="mt-4 rounded-lg border-2 border-indigo-200 bg-indigo-50 p-4">
          <div className="font-semibold text-gray-900">
            Get your first recommendation in under 5 minutes
          </div>
          <div className="text-sm text-gray-600 mt-0.5">
            Upload one document (an offer letter, 401(k) statement, or insurance policy) and
            we&apos;ll extract the facts, score your readiness, and show your single
            highest-leverage move — with the evidence behind it.
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href="/dashboard/documents"
              className="inline-flex items-center px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
            >
              Upload your first document →
            </Link>
            <button
              onClick={() =>
                fetch('/api/platform/sample')
                  .then((r) => (r.ok ? r.json() : null))
                  .then(setSample)
                  .catch(() => {})
              }
              className="inline-flex items-center px-4 py-2 rounded-md border border-indigo-200 text-indigo-700 text-sm font-medium hover:bg-white"
            >
              Preview with sample data
            </button>
          </div>
        </div>
        {sample && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <div className="text-[11px] uppercase tracking-wide text-amber-600 font-semibold">
              {sample.label}
            </div>
            <div className="mt-2 flex items-center gap-4">
              <div className="w-14 h-14 rounded-full border-4 border-amber-400 text-amber-700 flex items-center justify-center bg-white font-extrabold">
                {sample.readiness.index}
              </div>
              <div>
                <div className="text-sm font-semibold text-gray-900">
                  {sample.readiness.headline}
                </div>
                <div className="text-sm text-gray-700 mt-1">
                  <b>Top move:</b> {sample.top_recommendation.title}
                  {qi.financial_impact_annual
                    ? ` — +$${Number(qi.financial_impact_annual).toLocaleString()}/yr`
                    : ''}
                  {qi.retirement_success_before_pct
                    ? `, retirement success ${qi.retirement_success_before_pct}% → ${qi.retirement_success_after_pct}%`
                    : ''}
                </div>
                <div className="text-xs text-gray-500 mt-1">{sample.top_recommendation.why}</div>
              </div>
            </div>
            <div className="text-xs text-amber-700 mt-2">
              This is illustrative — upload your own document to generate your real roadmap.
            </div>
          </div>
        )}
      </div>
    );
  }
  if (!d || !d.status) return null;

  return (
    <div className="mb-6">
      {/* Next best action only. The readiness/index RING (and its "Your Life Readiness" status tile)
          is intentionally hidden here — the dashboard shows exactly ONE readiness ring, in
          ExecutiveSummary. The NBA now spans the full width on its own. */}
      <div className="grid grid-cols-1 gap-4">
        {/* The single next best action — the answer to "what should I do next, and why" */}
        <div className="rounded-xl shadow-md border border-indigo-500/30 bg-gradient-to-br from-indigo-600 to-violet-600 p-6 text-white flex flex-col justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-indigo-100 font-semibold">
              Your next best move
            </div>
            <div className="text-lg font-bold text-white mt-1">{d.next_best_action.title}</div>
            <div className="text-sm text-indigo-50 mt-1">
              {d.next_best_action.recommended_action || d.next_best_action.why}
            </div>

            {/* Quantified impact + expected benefit — only what the OS actually returned */}
            {(() => {
              const impact = formatImpact(d.next_best_action.quantified_impact);
              const benefit = d.next_best_action.expected_benefit;
              if (!impact && !benefit) return null;
              return (
                <div className="mt-2 text-sm font-semibold text-emerald-200">
                  {impact || benefit}
                </div>
              );
            })()}

            {/* Why this is #1 + confidence — the ranking transparency the spine computes */}
            {(d.next_best_action.why_number_one ||
              typeof d.next_best_action.confidence === 'number') && (
              <div className="mt-2 flex flex-col gap-1">
                {d.next_best_action.why_number_one && (
                  <div className="text-xs text-indigo-100">
                    <b className="text-white">Why this is #1:</b>{' '}
                    {d.next_best_action.why_number_one}
                  </div>
                )}
                {typeof d.next_best_action.confidence === 'number' && (
                  <div className="text-[11px] uppercase tracking-wide text-indigo-200 font-semibold">
                    Confidence {Math.round(d.next_best_action.confidence * 100)}%
                  </div>
                )}
              </div>
            )}
          </div>
          <Link
            href={d.next_best_action.href || '/dashboard/recommendations'}
            className="mt-3 inline-flex w-fit items-center px-4 py-2 rounded-md bg-white text-indigo-700 text-sm font-semibold hover:bg-indigo-50"
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
