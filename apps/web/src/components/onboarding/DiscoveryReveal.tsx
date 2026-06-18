'use client';

// End-of-Discovery Reveal (Pilot Polish — "make Arcana's intelligence VISIBLE").
//
// When the advisor/discovery conversation completes, BEFORE landing on the dashboard, we show a
// full-screen "Arcana's Understanding Of Your Life" reveal. It is meant to feel like a trusted
// advisor summarizing the conversation back to you — not software flashing a loading spinner.
//
// 100% REAL data from /api/life/my-life (life_brief, what_matters_most, narrative_explanation).
// NEVER fabricates: when life_brief.ready is false we render an honest "still getting to know you"
// reveal instead of a manufactured story (No mock data — ever). The sections are revealed in a
// staged sequence (advisor "thinking" → narrative types in → supporting sections fade up) reusing
// the existing StreamingText typing effect and the navy/teal brand from LifeBrief.
//
// The user is never trapped: a primary CTA navigates to the dashboard immediately, and we also
// auto-advance once the reveal has had time to land.

import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Sparkles,
  Target,
  Scale,
  TrendingUp,
  ShieldAlert,
  Compass,
  Lock,
  Heart,
  Loader2,
} from 'lucide-react';
import StreamingText from '@/components/ui/StreamingText';
import { ARCANA_STREAMING_ENABLED } from '@/lib/arcana/streaming';
import NarrativeAccuracyPrompt from '@/components/feedback/NarrativeAccuracyPrompt';
import InsightPrompt from '@/components/feedback/InsightPrompt';
import HolyShitPrompt from '@/components/feedback/HolyShitPrompt';

interface LifeBriefData {
  ready?: boolean;
  headline?: string | null;
  body?: string | null;
  situation?: string | null;
  tension?: string | null;
  stakes?: string | null;
  next_move?: string | null;
  goals_held?: string[];
  watching?: string[];
  could_change?: string[];
  confidence_pct?: number;
  source?: string;
}
interface WhatMattersMost {
  primary_objective?: string | null;
  reasoning?: string | null;
  risks?: string[];
  opportunities?: string[];
  constraints?: string[];
}
interface NarrativeExplanation {
  narrative?: string | null;
  why?: string | null;
  contributing_goals?: string[];
  evidence_signals?: string[];
  confidence_pct?: number;
  confidence_label?: string | null;
}
interface MyLife {
  life_brief?: LifeBriefData | null;
  what_matters_most?: WhatMattersMost | null;
  narrative_explanation?: NarrativeExplanation | null;
  // Incoming canonical fields (added by the backend this sprint). Read DEFENSIVELY — render only when
  // present + non-empty; never fabricated. Accept either a list of strings or {label} objects.
  motivations?: (string | { label?: string | null })[] | null;
  emotional_signals?: (string | { label?: string | null })[] | null;
}

// Coerce a mixed string|{label} list into clean, de-duped strings (honest empty when nothing real).
const toLabels = (
  items: (string | { label?: string | null } | null | undefined)[] | null | undefined
): string[] => {
  if (!Array.isArray(items)) return [];
  const out: string[] = [];
  for (const it of items) {
    const s = typeof it === 'string' ? it : it && typeof it === 'object' ? (it.label ?? '') : '';
    const t = String(s || '').trim();
    if (t) out.push(t);
  }
  return Array.from(new Set(out));
};

const first = (...vals: (string | null | undefined)[]): string | null => {
  for (const v of vals) {
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
};

export default function DiscoveryReveal({ onContinue }: { onContinue: () => void }) {
  const [data, setData] = useState<MyLife | null>(null);
  const [loading, setLoading] = useState(true);
  // Staged reveal: 0 = advisor "reflecting", 1 = narrative typing, 2 = supporting sections shown.
  const [stage, setStage] = useState(0);
  // End-of-onboarding pilot feedback ("did this land?"). Skippable; once the user dismisses, the
  // prompts collapse and never reappear in this session. Never blocks the continue CTA.
  const [feedbackDismissed, setFeedbackDismissed] = useState(false);
  const advancedRef = useRef(false);

  useEffect(() => {
    let on = true;
    fetch('/api/life/my-life', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then((m: MyLife | null) => {
        if (!on) return;
        setData(m || {});
        setLoading(false);
      });
    return () => {
      on = false;
    };
  }, []);

  // Let the advisor "reflect" for a beat before the narrative appears — sells the idea that Arcana is
  // composing what it understood, not just rendering a payload.
  useEffect(() => {
    if (loading) return;
    const t = setTimeout(() => setStage((s) => Math.max(s, 1)), 900);
    return () => clearTimeout(t);
  }, [loading]);

  // Safety auto-advance: if streaming is off (or the user just sits here), still take them home so
  // they are never trapped on the reveal. Generous window so a reader can finish the narrative.
  useEffect(() => {
    if (loading) return;
    const t = setTimeout(() => {
      if (!advancedRef.current) {
        advancedRef.current = true;
        onContinue();
      }
    }, 14000);
    return () => clearTimeout(t);
  }, [loading, onContinue]);

  const goNow = () => {
    if (advancedRef.current) return;
    advancedRef.current = true;
    onContinue();
  };

  if (loading) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
          Arcana is composing what it understands about you…
        </div>
      </div>
    );
  }

  const brief = data?.life_brief || {};
  const wm = data?.what_matters_most || {};
  const narrative = data?.narrative_explanation || {};

  // Honest empty state — the model is still forming. NEVER fabricate a story.
  if (!brief.ready) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4">
        <div className="w-full max-w-2xl rounded-2xl border border-indigo-300/40 bg-gradient-to-br from-[#0f172a] via-[#13294b] to-[#0d3a4a] p-8 text-white shadow-md">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-teal-300">
            <Sparkles className="h-3.5 w-3.5" /> What Arcana understands so far
          </div>
          <h1 className="mt-2 text-2xl font-bold leading-snug">
            {first(brief.headline) || "I'm still getting to know you."}
          </h1>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-slate-200">
            {first(brief.body) ||
              "We've made a start, but I don't yet understand enough to summarize your life with confidence. As you share more — or add a few real details — your picture will sharpen, and I'll show you exactly what I see."}
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              onClick={goNow}
              className="inline-flex items-center gap-1.5 rounded-lg bg-teal-400 px-5 py-2.5 text-sm font-semibold text-[#0f172a] hover:bg-teal-300"
            >
              Go to my dashboard <ArrowRight className="h-4 w-4" />
            </button>
            {brief.source && <span className="text-[11px] text-slate-400">{brief.source}</span>}
          </div>
        </div>
      </div>
    );
  }

  // Ready — the full reveal. Compose each section from real fields, preferring the richest source.
  const headline = first(brief.headline) || 'Here is what I understand about your life.';
  const currentNarrative =
    first(narrative.narrative, brief.situation, brief.body) ||
    'This is the picture forming from our conversation.';
  const tension = first(brief.tension, wm.reasoning);
  const opportunity = first((wm.opportunities || [])[0]);
  const risk = first(brief.stakes, (wm.risks || [])[0]);
  const nextMove = first(brief.next_move);
  const goals = (brief.goals_held || []).filter((g) => g && g.trim());
  // Constraints — what's holding the plan back (grounded only; from what_matters_most). Defensive.
  const constraints = toLabels(wm.constraints).slice(0, 4);
  // Motivations / emotional context — only if the backend surfaced them. Never fabricated.
  const motivations = [...toLabels(data?.motivations), ...toLabels(data?.emotional_signals)].slice(
    0,
    4
  );
  const confidence =
    typeof brief.confidence_pct === 'number'
      ? brief.confidence_pct
      : typeof narrative.confidence_pct === 'number'
        ? narrative.confidence_pct
        : null;

  const animateNarrative = stage >= 1 && ARCANA_STREAMING_ENABLED;

  return (
    <div className="min-h-[70vh] w-full px-4 py-8">
      <div className="mx-auto max-w-3xl space-y-5">
        {/* Hero — the current narrative, typed in like the advisor is telling it back to you. */}
        <div className="rounded-2xl border border-indigo-300/40 bg-gradient-to-br from-[#0f172a] via-[#13294b] to-[#0d3a4a] p-7 text-white shadow-md">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-teal-300">
            <Sparkles className="h-3.5 w-3.5" /> Arcana&apos;s understanding of your life
          </div>
          <h1 className="mt-2 text-2xl font-bold leading-snug">{headline}</h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-slate-200">
            <StreamingText
              text={currentNarrative}
              animate={animateNarrative}
              instant={!ARCANA_STREAMING_ENABLED}
              onDone={() => setStage((s) => Math.max(s, 2))}
            />
          </p>

          {goals.length > 0 && stage >= 2 && (
            <div className="mt-5 transition-opacity duration-500 ease-out">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                What you&apos;re building
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

          <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-white/10 pt-3 text-[11px] text-slate-400">
            {typeof confidence === 'number' && (
              <span className="inline-flex items-center rounded-full bg-white/10 px-2 py-0.5 font-medium text-slate-200">
                {confidence}% confidence
              </span>
            )}
            {first(narrative.confidence_label) && <span>{first(narrative.confidence_label)}</span>}
            {brief.source && <span>{brief.source}</span>}
          </div>
        </div>

        {/* Supporting sections — fade in only after the narrative finishes typing. Each one renders
            ONLY if it has real content; we never show an empty advisor card. */}
        {stage >= 2 && (
          <div className="grid grid-cols-1 gap-4 transition-opacity duration-700 ease-out sm:grid-cols-2">
            {tension && (
              <RevealCard
                icon={<Scale className="h-4 w-4" />}
                tone="amber"
                title="What's competing for your time"
                body={tension}
              />
            )}
            {opportunity && (
              <RevealCard
                icon={<TrendingUp className="h-4 w-4" />}
                tone="emerald"
                title="Your biggest opportunity"
                body={opportunity}
              />
            )}
            {risk && (
              <RevealCard
                icon={<ShieldAlert className="h-4 w-4" />}
                tone="rose"
                title="Your biggest risk"
                body={risk}
              />
            )}
            {nextMove && (
              <RevealCard
                icon={<Compass className="h-4 w-4" />}
                tone="indigo"
                title="Recommended next move"
                body={nextMove}
              />
            )}
            {/* Constraints — what's currently in the way. Grounded only; rendered when present. */}
            {constraints.length > 0 && (
              <RevealCard
                icon={<Lock className="h-4 w-4" />}
                tone="slate"
                title="What's holding things back"
                body={constraints.join(' · ')}
              />
            )}
            {/* Motivations / emotional context — only when the model actually surfaced them. */}
            {motivations.length > 0 && (
              <RevealCard
                icon={<Heart className="h-4 w-4" />}
                tone="violet"
                title="What's driving you"
                body={motivations.join(' · ')}
              />
            )}
            {!tension &&
              !opportunity &&
              !risk &&
              !nextMove &&
              constraints.length === 0 &&
              motivations.length === 0 && (
                <div className="sm:col-span-2 rounded-2xl border border-gray-200 bg-white p-5 text-sm text-gray-600 shadow-sm">
                  <Target className="mb-1 h-4 w-4 text-indigo-500" />I have your core picture. As
                  you add more, I&apos;ll surface the opportunities, risks, and next moves here —
                  grounded in your real situation, never assumptions.
                </div>
              )}
          </div>
        )}

        {/* End-of-onboarding "did this land?" feedback. Appears once the reveal has finished and only
            when the model actually produced a real narrative. Fully skippable; never blocks continue. */}
        {stage >= 2 && brief.ready && !feedbackDismissed && (
          <div className="space-y-3 pt-1">
            <NarrativeAccuracyPrompt onDismiss={() => setFeedbackDismissed(true)} />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <InsightPrompt onDismiss={() => setFeedbackDismissed(true)} />
              <HolyShitPrompt onDismiss={() => setFeedbackDismissed(true)} />
            </div>
          </div>
        )}

        {/* The user reaches the dashboard intentionally — and is never trapped. */}
        <div className="flex flex-col items-center gap-2 pt-2 text-center">
          <button
            onClick={goNow}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
          >
            Take me to my dashboard <ArrowRight className="h-4 w-4" />
          </button>
          <p className="text-xs text-gray-500">Your dashboard reflects everything you see here.</p>
        </div>
      </div>
    </div>
  );
}

const TONES: Record<string, { ring: string; chip: string; icon: string }> = {
  amber: { ring: 'border-amber-200', chip: 'text-amber-600', icon: 'bg-amber-50 text-amber-600' },
  emerald: {
    ring: 'border-emerald-200',
    chip: 'text-emerald-600',
    icon: 'bg-emerald-50 text-emerald-600',
  },
  rose: { ring: 'border-rose-200', chip: 'text-rose-600', icon: 'bg-rose-50 text-rose-600' },
  indigo: {
    ring: 'border-indigo-200',
    chip: 'text-indigo-600',
    icon: 'bg-indigo-50 text-indigo-600',
  },
  slate: { ring: 'border-slate-200', chip: 'text-slate-600', icon: 'bg-slate-100 text-slate-600' },
  violet: {
    ring: 'border-violet-200',
    chip: 'text-violet-600',
    icon: 'bg-violet-50 text-violet-600',
  },
};

function RevealCard({
  icon,
  tone,
  title,
  body,
}: {
  icon: React.ReactNode;
  tone: keyof typeof TONES;
  title: string;
  body: string;
}) {
  const t = TONES[tone] || TONES.indigo;
  return (
    <div className={`rounded-2xl border bg-white p-5 shadow-sm ${t.ring}`}>
      <div className="flex items-center gap-2">
        <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${t.icon}`}>
          {icon}
        </span>
        <span className={`text-[11px] font-semibold uppercase tracking-wide ${t.chip}`}>
          {title}
        </span>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-gray-700">{body}</p>
    </div>
  );
}
