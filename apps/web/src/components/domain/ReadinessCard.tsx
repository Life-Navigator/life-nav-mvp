'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import type { ReadinessResult, ReadinessStatus } from '@/lib/readiness/types';

const BAND = (score: number) => {
  if (score >= 85)
    return {
      tone: 'blue',
      label: 'Excellent',
      ring: 'text-blue-600',
      bar: 'bg-blue-500',
      chip: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    };
  if (score >= 70)
    return {
      tone: 'green',
      label: 'Strong',
      ring: 'text-emerald-600',
      bar: 'bg-emerald-500',
      chip: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    };
  if (score >= 40)
    return {
      tone: 'yellow',
      label: 'Developing',
      ring: 'text-amber-600',
      bar: 'bg-amber-500',
      chip: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    };
  return {
    tone: 'red',
    label: 'Needs attention',
    ring: 'text-red-600',
    bar: 'bg-red-500',
    chip: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  };
};

const STATUS_LABEL: Record<ReadinessStatus, string> = {
  not_started: 'Not started',
  limited_data: 'Limited data',
  developing: 'Developing',
  strong: 'Strong',
  excellent: 'Excellent',
};

export function ReadinessCard({
  title,
  result,
  addHref,
  addLabel = 'Add data',
}: {
  title: string;
  result: ReadinessResult | null;
  addHref: string;
  addLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  if (!result) return null;

  const band = BAND(result.score);
  const topStrength = result.strengths[0];
  const topGap = result.gaps[0];
  const nextAction = result.recommendedActions[0];
  // SVG ring math
  const r = 34;
  const circ = 2 * Math.PI * r;
  const dash = (result.score / 100) * circ;

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">{title}</h3>
        <span className={`text-[11px] px-2 py-0.5 rounded-full ${band.chip}`}>
          {result.status === 'not_started' || result.status === 'limited_data'
            ? STATUS_LABEL[result.status]
            : band.label}
        </span>
      </div>

      <div className="flex items-center gap-5">
        <div className="relative w-[84px] h-[84px] shrink-0">
          <svg viewBox="0 0 84 84" className="w-[84px] h-[84px] -rotate-90">
            <circle
              cx="42"
              cy="42"
              r={r}
              fill="none"
              strokeWidth="8"
              className="stroke-slate-100 dark:stroke-slate-700"
            />
            <circle
              cx="42"
              cy="42"
              r={r}
              fill="none"
              strokeWidth="8"
              strokeLinecap="round"
              className={band.ring}
              stroke="currentColor"
              strokeDasharray={`${dash} ${circ}`}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-slate-900 dark:text-white leading-none">
              {result.score}
            </span>
            <span className="text-[10px] text-slate-400">/ 100</span>
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-1.5">
          {topStrength && (
            <p className="text-sm text-slate-700 dark:text-slate-200">
              <span className="text-emerald-600 font-medium">Strength:</span> {topStrength}
            </p>
          )}
          {topGap && (
            <p className="text-sm text-slate-700 dark:text-slate-200">
              <span className="text-amber-600 font-medium">Gap:</span> {topGap}
            </p>
          )}
          {nextAction && (
            <p className="text-sm text-slate-700 dark:text-slate-200">
              <span className="text-indigo-600 font-medium">Next:</span> {nextAction}{' '}
              <Link href={addHref} className="text-indigo-600 hover:underline">
                {addLabel} →
              </Link>
            </p>
          )}
          <p className="text-xs text-slate-400">
            Confidence {result.confidence}% · {result.dataSources.length} data source(s)
          </p>
        </div>
      </div>

      <button
        onClick={() => setOpen((v) => !v)}
        className="mt-4 flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
      >
        <ChevronDownIcon className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        Why this score
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {result.components.map((c) => (
            <div key={c.key}>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 dark:text-slate-300">{c.label}</span>
                <span className="text-slate-500 tabular-nums">
                  {c.score}/{c.max}
                </span>
              </div>
              <div className="mt-0.5 h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                <div
                  className={`h-full ${BAND((c.score / c.max) * 100).bar}`}
                  style={{ width: `${(c.score / c.max) * 100}%` }}
                />
              </div>
              <p className="mt-0.5 text-[11px] text-slate-400">{c.reason}</p>
            </div>
          ))}
          {result.missingData.length > 0 && (
            <p className="pt-1 text-[11px] text-slate-400">
              <span className="font-medium">Missing:</span> {result.missingData.join(', ')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
