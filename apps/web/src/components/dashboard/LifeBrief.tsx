'use client';

// Life Brief (Experience Excellence Sprint) — the FIRST thing the user reads on the dashboard.
// It leads with the NARRATIVE ("this understands me"), not percentages: the headline is the life
// story, the body is the situation/tension/stakes/next-move composed by the backend, goals_held are
// chips, and confidence + source are provenance. 100% real data from /api/life/my-life `life_brief`;
// when the model is still forming (ready:false) it renders the honest "still forming" state and never
// fabricates a story (No mock data — ever).

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  ArrowRight,
  Loader2,
  Sparkles,
  Lightbulb,
  Eye,
  GitCompareArrows,
} from 'lucide-react';

interface LifeBriefData {
  ready?: boolean;
  headline?: string;
  body?: string;
  situation?: string | null;
  tension?: string | null;
  stakes?: string | null;
  next_move?: string | null;
  readiness_line?: string | null;
  goals_held?: string[];
  watching?: string[]; // V2 — what Arcana is keeping an eye on (open dependencies + active constraints)
  could_change?: string[]; // V2 — remaining grounded risks / deadlines that could change the plan
  confidence_pct?: number;
  source?: string;
}

// "Why Arcana believes this" — explainability for the dominant narrative.
// 100% surfaced from /api/life/my-life `narrative_explanation`; null until a narrative exists.
interface NarrativeExplanation {
  narrative?: string;
  why?: string;
  contributing_goals?: string[];
  evidence_signals?: string[];
  confidence_pct?: number;
  confidence_label?: string;
  source?: string;
}

export default function LifeBrief() {
  const [brief, setBrief] = useState<LifeBriefData | null>(null);
  const [why, setWhy] = useState<NarrativeExplanation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let on = true;
    fetch('/api/life/my-life', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then((m) => {
        if (!on) return;
        setBrief((m?.life_brief as LifeBriefData) || null);
        setWhy((m?.narrative_explanation as NarrativeExplanation) || null);
        setLoading(false);
      });
    return () => {
      on = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-2xl border border-gray-200/80 bg-white py-10 text-sm text-gray-500 shadow-sm">
        <Loader2 className="h-4 w-4 animate-spin text-indigo-500" /> Composing your Life Brief…
      </div>
    );
  }

  // Nothing returned at all — render nothing rather than an empty shell.
  if (!brief) return null;

  // Honest "still forming" state — never manufacture a narrative.
  if (!brief.ready) {
    return (
      <div className="rounded-2xl border border-gray-200/80 bg-gradient-to-br from-indigo-50 to-white p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-100">
            <BookOpen className="h-5 w-5 text-indigo-600" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-indigo-500">
              Your Life Brief
            </div>
            <h2 className="mt-0.5 text-xl font-bold text-gray-900">
              {brief.headline || 'Your Life Brief is still forming.'}
            </h2>
            {brief.body && (
              <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-gray-600">{brief.body}</p>
            )}
            <Link
              href="/dashboard/advisor"
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              Talk to your advisor <ArrowRight className="h-4 w-4" />
            </Link>
            {brief.source && <p className="mt-3 text-[11px] text-gray-400">{brief.source}</p>}
          </div>
        </div>
      </div>
    );
  }

  // Ready — the narrative hero. Headline = the life story; body = the composed paragraph.
  const goals = (brief.goals_held || []).filter((g) => g && g.trim());
  const watching = (brief.watching || []).filter((w) => w && w.trim());
  const couldChange = (brief.could_change || []).filter((c) => c && c.trim());
  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-indigo-300/40 bg-gradient-to-br from-[#0f172a] via-[#13294b] to-[#0d3a4a] p-6 text-white shadow-md">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-teal-300">
          <Sparkles className="h-3.5 w-3.5" /> Your Life Brief
        </div>
        <h2 className="mt-1.5 text-2xl font-bold leading-snug">{brief.headline}</h2>

        {brief.body && (
          <p className="mt-2.5 max-w-3xl text-[15px] leading-relaxed text-slate-200">
            {brief.body}
          </p>
        )}

        {goals.length > 0 && (
          <div className="mt-4">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              What you&apos;re holding right now
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {goals.map((g, i) => (
                <span
                  key={`${g}-${i}`}
                  className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-teal-100 ring-1 ring-inset ring-white/10"
                >
                  {g}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* What Arcana is watching / what could change — grounded only (real dependencies, constraints,
            remaining risks from the Life Model). Rendered only when present; never fabricated. */}
        {(watching.length > 0 || couldChange.length > 0) && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {watching.length > 0 && (
              <div className="rounded-xl bg-white/[0.06] p-3 ring-1 ring-inset ring-white/10">
                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-teal-300">
                  <Eye className="h-3.5 w-3.5" /> What Arcana is watching
                </div>
                <ul className="mt-1.5 space-y-1">
                  {watching.map((w, i) => (
                    <li key={`${w}-${i}`} className="text-xs leading-relaxed text-slate-200">
                      • {w}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {couldChange.length > 0 && (
              <div className="rounded-xl bg-white/[0.06] p-3 ring-1 ring-inset ring-white/10">
                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
                  <GitCompareArrows className="h-3.5 w-3.5" /> What could change the plan
                </div>
                <ul className="mt-1.5 space-y-1">
                  {couldChange.map((c, i) => (
                    <li key={`${c}-${i}`} className="text-xs leading-relaxed text-slate-200">
                      • {c}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {brief.readiness_line && (
          <p className="mt-4 text-xs text-slate-300">{brief.readiness_line}</p>
        )}

        {/* Provenance — confidence + source, so the narrative is never presented as fact-free magic. */}
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-white/10 pt-3 text-[11px] text-slate-400">
          {typeof brief.confidence_pct === 'number' && (
            <span className="inline-flex items-center rounded-full bg-white/10 px-2 py-0.5 font-medium text-slate-200">
              {brief.confidence_pct}% confidence
            </span>
          )}
          {brief.source && <span>{brief.source}</span>}
        </div>
      </div>

      <WhyArcanaBelieves why={why} />
    </div>
  );
}

// "Why Arcana believes this" — pure surfacing of narrative_explanation. Renders nothing when there is
// no narrative yet (honest empty state — no fabricated rationale). Answers: why this narrative, which
// goals contributed, what evidence supports it, how confident.
function WhyArcanaBelieves({ why }: { why: NarrativeExplanation | null }) {
  if (!why || !why.why) return null;
  const goals = (why.contributing_goals || []).filter((g) => g && g.trim());
  const signals = (why.evidence_signals || []).filter((s) => s && s.trim());
  const confLabel = why.confidence_label;
  const confPct = typeof why.confidence_pct === 'number' ? why.confidence_pct : null;
  return (
    <div className="rounded-2xl border border-gray-200/80 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-indigo-500">
        <Lightbulb className="h-3.5 w-3.5" /> Why Arcana believes this
      </div>

      {/* Why this narrative */}
      <p className="mt-2 text-sm leading-relaxed text-gray-700">{why.why}</p>

      {/* Which goals contributed */}
      {goals.length > 0 && (
        <div className="mt-4">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
            Which goals contributed
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {goals.map((g, i) => (
              <span
                key={`${g}-${i}`}
                className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 ring-1 ring-inset ring-indigo-100"
              >
                {g}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* What evidence supports it */}
      {signals.length > 0 && (
        <div className="mt-4">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
            What evidence supports it
          </div>
          <ul className="mt-1.5 space-y-1">
            {signals.map((s, i) => (
              <li key={`${s}-${i}`} className="text-xs leading-relaxed text-gray-600">
                • {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Confidence + provenance */}
      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-gray-100 pt-3 text-[11px] text-gray-400">
        {(confLabel || confPct != null) && (
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 font-medium text-gray-600">
            {confLabel ? `${confLabel} confidence` : 'Confidence'}
            {confPct != null ? ` · ${confPct}%` : ''}
          </span>
        )}
        {why.source && <span>{why.source}</span>}
      </div>
    </div>
  );
}
