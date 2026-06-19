'use client';

// Life Brief — grounded executive summary from real Career + Education readiness
// (Phase 6). 100% from /api/life-brief (deterministic, no fabricated facts). Premium
// dark surface with explicit contrast (no white-on-white): the card is a navy/indigo
// gradient and all text uses light tokens on that dark surface.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Sparkles, ArrowRight, ChevronDown, Loader2, AlertTriangle } from 'lucide-react';
import type { LifeBrief } from '@/lib/lifeBrief/types';

function band(score: number) {
  if (score >= 85)
    return { chip: 'bg-sky-400/20 text-sky-200 ring-sky-400/40', label: 'Excellent' };
  if (score >= 70)
    return { chip: 'bg-emerald-400/20 text-emerald-200 ring-emerald-400/40', label: 'Strong' };
  if (score >= 40)
    return { chip: 'bg-amber-400/20 text-amber-100 ring-amber-400/40', label: 'Developing' };
  return { chip: 'bg-rose-400/20 text-rose-100 ring-rose-400/40', label: 'Needs attention' };
}

function ScoreBadge({ label, value, status }: { label: string; value: number; status: string }) {
  const b = band(value);
  const display = status === 'not_started' ? '—' : value;
  return (
    <div className={`flex items-center gap-2 rounded-xl px-3 py-2 ring-1 ${b.chip}`}>
      <span className="text-2xl font-bold tabular-nums">{display}</span>
      <span className="text-[11px] leading-tight opacity-90">
        {label}
        <br />
        {status === 'not_started' ? 'not started' : b.label}
      </span>
    </div>
  );
}

export default function LifeBriefExecutive() {
  const [brief, setBrief] = useState<LifeBrief | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetch('/api/life-brief')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setBrief(d))
      .catch(() => setBrief(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-indigo-950 p-6 text-slate-300 flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Composing your Life Brief…
      </div>
    );
  }
  if (!brief) return null;

  const lowConfidence = brief.confidence < 50;

  return (
    <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 text-white shadow-lg ring-1 ring-white/10 overflow-hidden">
      <div className="p-6">
        <div className="flex items-center gap-2 text-indigo-300 text-[11px] font-semibold uppercase tracking-wider">
          <Sparkles className="w-3.5 h-3.5" /> Life Brief
        </div>
        <h2 className="mt-1.5 text-xl font-bold text-white">{brief.title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-200">{brief.summary}</p>

        {/* Scores + confidence */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <ScoreBadge
            label="Career"
            value={brief.readiness.career.score}
            status={brief.readiness.career.status}
          />
          <ScoreBadge
            label="Education"
            value={brief.readiness.education.score}
            status={brief.readiness.education.status}
          />
          <span className="ml-auto text-xs text-slate-400">
            {brief.confidence}% confidence · {brief.dataSources.length} source(s)
          </span>
        </div>

        {/* Low-confidence / missing-data warning */}
        {lowConfidence && brief.missingData.length > 0 && (
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-400/10 ring-1 ring-amber-400/30 px-3 py-2 text-xs text-amber-100">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              Limited data — add {brief.missingData.slice(0, 3).join(', ').toLowerCase()} to sharpen
              this brief.
            </span>
          </div>
        )}

        {/* Next best action */}
        {brief.nextBestActions[0] && (
          <Link
            href={
              brief.state === 'empty' ||
              brief.readiness.career.score <= brief.readiness.education.score
                ? '/dashboard/career/experience'
                : '/dashboard/education/degrees'
            }
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-400 px-4 py-2 text-sm font-medium text-white transition-colors"
          >
            {brief.nextBestActions[0]}
            <ArrowRight className="w-4 h-4" />
          </Link>
        )}

        {/* Why this brief? */}
        <button
          onClick={() => setOpen((v) => !v)}
          className="mt-4 ml-1 flex items-center gap-1 text-xs font-medium text-slate-300 hover:text-white"
        >
          <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
          Why this brief?
        </button>

        {open && (
          <div className="mt-3 grid gap-3 rounded-xl bg-white/5 p-4 text-sm sm:grid-cols-2">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Career
              </div>
              <p className="mt-1 text-slate-200">{brief.careerInsight}</p>
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Education
              </div>
              <p className="mt-1 text-slate-200">{brief.educationInsight}</p>
            </div>
            {brief.strengths.length > 0 && (
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-300">
                  Strengths
                </div>
                <ul className="mt-1 space-y-0.5 text-slate-200">
                  {brief.strengths.map((s) => (
                    <li key={s}>• {s}</li>
                  ))}
                </ul>
              </div>
            )}
            {brief.gaps.length > 0 && (
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-300">
                  Gaps
                </div>
                <ul className="mt-1 space-y-0.5 text-slate-200">
                  {brief.gaps.map((g) => (
                    <li key={g}>• {g}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="sm:col-span-2 border-t border-white/10 pt-2 text-xs text-slate-400">
              <span className="font-medium text-slate-300">Data sources:</span>{' '}
              {brief.dataSources.length ? brief.dataSources.join(', ') : 'none yet'}
              {brief.missingData.length > 0 && (
                <>
                  {' · '}
                  <span className="font-medium text-slate-300">Missing:</span>{' '}
                  {brief.missingData.join(', ')}
                </>
              )}
              {' · '}
              <span className="font-medium text-slate-300">Confidence:</span> {brief.confidence}%
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
