'use client';

// Advisor (Sprint 41) — the Relationship Manager IS the chat. The advisor asks discovery questions;
// each answer writes to the canonical life model in real time and shows what the platform just
// learned (✓ chips). A live context panel always reflects the current life model. This is onboarding
// that feels like talking to an advisor, not filling a form.

import { useRouter } from 'next/navigation';
import React, { useEffect, useRef, useState } from 'react';
import AddDataModal from '@/components/dashboard/AddDataModal';
import {
  ActionCard,
  DOMAIN_ACTIONS,
  LifeModelConfirmation,
  type AdvisorAction,
  type CoverageDomain,
} from '@/components/dashboard/AdvisorOnboarding';

interface Panel {
  life_vision?: string | null;
  primary_objective?: string | null;
  top_themes?: string[];
  top_risks?: string[];
  top_constraints?: string[];
  top_opportunities?: string[];
  discovery_completion_pct?: number;
  covered_areas?: string[];
  missing_areas?: string[];
}
interface Reveal {
  you_said: string;
  we_discovered: string;
  dependencies: string[];
  recommendations_unlocked: number;
  confidence_pct: number;
}
interface Turn {
  assistant_message: string;
  pending_key: string | null;
  options?: string[] | null;
  updates: string[];
  reveal?: Reveal | null;
  progress?: { answered: number; total: number };
  complete: boolean;
  context_panel: Panel;
}
interface Msg {
  role: 'advisor' | 'user';
  text: string;
  updates?: string[];
  reveal?: Reveal | null;
}

export default function AdvisorPage() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [pending, setPending] = useState<string | null>(null);
  const [options, setOptions] = useState<string[] | null>(null);
  const [panel, setPanel] = useState<Panel>({});
  const [complete, setComplete] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [onboardingMode, setOnboardingMode] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();
  // Onboarding completion: discovery coverage (for action cards + confirmation), the manual-entry
  // modal domain, and whether the user is on the life-model review screen.
  const [coverage, setCoverage] = useState<CoverageDomain[]>([]);
  const [activeDomain, setActiveDomain] = useState<
    'financial' | 'health' | 'career' | 'education' | null
  >(null);
  const [reviewing, setReviewing] = useState(false);
  // Set when the user returns from a document upload (?uploaded=1&uploaded_domain=…).
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);
  // P0.6 final open-ended question (frontend-orchestrated) before the confirmation screen.
  const [finalAsked, setFinalAsked] = useState(false);
  // P0.7 intentional dashboard transition.
  const [transitioning, setTransitioning] = useState(false);
  const loadCoverage = () => {
    fetch('/api/life/discovery-coverage', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.domains) setCoverage(d.domains);
      })
      .catch(() => {});
  };
  useEffect(() => {
    loadCoverage();
  }, []);

  // Derive the action cards (Step 1/2) from whatever signal we have: prefer the coverage endpoint's
  // incomplete domains; fall back to the advisor panel's missing_areas. One card per missing domain.
  const missingDomainKeys: string[] = coverage.length
    ? coverage.filter((c) => c.coverage_pct < 100).map((c) => c.domain)
    : panel.missing_areas || [];
  // Show up to 2 actions for the top 2 missing domains so BOTH an upload and a manual-entry
  // (quick form) path are always reachable — never an upload-only set with no way to type data in.
  const advisorActions: AdvisorAction[] = missingDomainKeys
    .slice(0, 2)
    .flatMap((k) => (DOMAIN_ACTIONS[k] || []).slice(0, 2))
    .slice(0, 4);

  // Detect onboarding mode (?onboarding=1) so we can offer an explicit skip.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const q = new URLSearchParams(window.location.search);
    setOnboardingMode(q.get('onboarding') === '1');
    // Returning from a successful document upload: acknowledge it and refresh coverage/context.
    if (q.get('uploaded') === '1') {
      setUploadNotice(q.get('uploaded_domain') || '');
      loadCoverage();
      // Clean the URL so the banner doesn't re-appear on refresh (keep onboarding mode).
      window.history.replaceState(
        {},
        '',
        window.location.pathname + (q.get('onboarding') === '1' ? '?onboarding=1' : '')
      );
    }
  }, []);

  // Unlock the dashboard by persisting onboarding_completed. `skip` records an
  // explicit, deliberate bypass. Only navigates once the write succeeds.
  const finishOnboarding = async (skip: boolean, reason?: string) => {
    setFinishing(true);
    const answerCount = msgs.filter((m) => m.role === 'user').length;
    const coverageAvg = coverage.length
      ? Math.round(coverage.reduce((a, c) => a + (c.coverage_pct || 0), 0) / coverage.length)
      : 0;
    const finalReason = reason || (skip ? 'explicit_skip_after_minimum' : 'confirmation_completed');
    try {
      await fetch('/api/onboarding/advisor-complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skip,
          confirmed: !skip,
          reason: finalReason,
          discovery_answer_count: answerCount,
          coverage_at_skip: coverageAvg,
          graph_integrity_at_skip: panel.discovery_completion_pct ?? null,
        }),
      });
    } catch {
      /* best-effort; still navigate so the user is never trapped */
    }
    // P0.7: a short, intentional transition before the dashboard (not an abrupt jump).
    setTransitioning(true);
    setTimeout(() => router.push('/dashboard'), 1600);
  };

  // Skip-policy hardening: a skip is never a one-click bypass — it opens a warning, and the recorded
  // reason distinguishes an early skip (minimum not met) from a deliberate post-minimum skip.
  const [showSkipWarning, setShowSkipWarning] = useState(false);
  const requestSkip = () => setShowSkipWarning(true);
  const confirmLimitedSkip = () => {
    const answerCount = msgs.filter((m) => m.role === 'user').length;
    const minimumMet = answerCount >= 3;
    setShowSkipWarning(false);
    finishOnboarding(true, minimumMet ? 'explicit_skip_after_minimum' : 'early_skip_confirmed');
  };

  const FINAL_Q =
    "Before I show you what I understand — what haven't I asked that I should have? Is there anything else important to you that we haven't discussed?";
  // P0.6: ask the final open-ended question once, capture the answer into discovery, then review.
  const submitFinal = async (text: string) => {
    const t = text.trim();
    setMsgs((m) => [
      ...m,
      { role: 'advisor', text: FINAL_Q },
      ...(t ? [{ role: 'user' as const, text: t }] : []),
    ]);
    setFinalAsked(true);
    if (t) await send(t, pending);
  };

  const apply = (t: Turn | null) => {
    if (!t) return;
    setMsgs((m) => [
      ...m,
      { role: 'advisor', text: t.assistant_message, updates: t.updates, reveal: t.reveal },
    ]);
    setPending(t.pending_key);
    setOptions(t.options ?? null);
    setPanel(t.context_panel || {});
    setComplete(t.complete);
  };
  const send = async (message: string, pending_key: string | null) => {
    setBusy(true);
    const t = await fetch('/api/life/discovery-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, pending_key: pending_key ?? '' }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
    apply(t);
    setBusy(false);
  };
  useEffect(() => {
    send('', null); /* open the conversation */
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs]);

  const submit = async (text: string) => {
    if (!text.trim() || busy) return;
    setMsgs((m) => [...m, { role: 'user', text }]);
    setInput('');
    await send(text, pending);
  };

  // P0.4: action cards appear only after a few meaningful answers (not during early discovery).
  const userAnswers = msgs.filter((m) => m.role === 'user').length;
  const showActions = userAnswers >= 3 && advisorActions.length > 0;
  // P0.5/0.6: the life-model review is shown after the final open-ended question is asked.
  const showConfirmation = (complete && finalAsked) || reviewing;
  const showFinalQuestion = complete && !finalAsked && !reviewing;

  // P0.7: intentional transition into the dashboard.
  if (transitioning) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600 mb-4" />
        <h2 className="text-xl font-bold text-gray-900">
          I&apos;ve built your initial Life Model.
        </h2>
        <p className="text-gray-500 mt-1">Your dashboard is ready…</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Conversation */}
      <div className="lg:col-span-2 flex flex-col">
        <h1 className="text-xl font-bold text-gray-900">Your Advisor</h1>
        {!complete &&
          (coverage.length > 0 ? (
            // Rule 5: confidence-by-domain, not a question count.
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-gray-500">
              <span className="uppercase tracking-wide text-gray-400 font-semibold">
                Understanding
              </span>
              {coverage.map((c) => (
                <span key={c.domain}>
                  {c.label}:{' '}
                  <span className="font-medium text-gray-700">
                    {c.confidence_pct ?? c.coverage_pct}%
                  </span>
                </span>
              ))}
              {typeof panel.discovery_completion_pct === 'number' && (
                <span className="text-indigo-600 font-semibold">
                  Overall {panel.discovery_completion_pct}%
                </span>
              )}
            </div>
          ) : (
            <div className="mt-1 text-xs text-gray-500">Getting to know you…</div>
          ))}
        {uploadNotice !== null && (
          <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 flex items-center justify-between gap-2">
            <span>
              Got it — your{uploadNotice ? ` ${uploadNotice}` : ''} document was added. I&apos;ve
              refreshed what I know.
            </span>
            <button
              onClick={() => setUploadNotice(null)}
              className="text-xs underline text-emerald-700 shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}
        <div className="mt-3 flex-1 space-y-3 overflow-y-auto" style={{ minHeight: 360 }}>
          {msgs.map((m, i) => (
            <div key={i} className={m.role === 'user' ? 'text-right' : ''}>
              <div
                className={`inline-block max-w-[85%] rounded-2xl px-4 py-2 text-sm ${m.role === 'advisor' ? 'bg-indigo-50 text-gray-800' : 'bg-gray-900 text-white'}`}
              >
                {m.text}
              </div>
              {m.updates && m.updates.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {m.updates.map((u, j) => (
                    <span
                      key={j}
                      className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100"
                    >
                      {u}
                    </span>
                  ))}
                </div>
              )}
              {m.reveal && (
                <div className="mt-2 max-w-[95%] rounded-2xl border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-4">
                  <div className="text-[11px] uppercase tracking-wide text-indigo-500 font-semibold">
                    ✨ Here&apos;s what I just learned
                  </div>
                  <div className="mt-1 text-sm text-gray-600">
                    You said: <span className="text-gray-900">“{m.reveal.you_said}”</span>
                  </div>
                  <div className="text-sm text-gray-600">
                    What I&apos;m hearing (does this sound right?):{' '}
                    <span className="text-lg font-bold text-gray-900">
                      {m.reveal.we_discovered}
                    </span>
                  </div>
                  <div className="mt-2 text-[11px] uppercase tracking-wide text-gray-400 font-semibold">
                    What it depends on
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {m.reveal.dependencies.map((d) => (
                      <span
                        key={d}
                        className="text-[11px] px-2 py-0.5 rounded-full bg-white border border-indigo-100 text-gray-700"
                      >
                        {d}
                      </span>
                    ))}
                  </div>
                  <div className="mt-2 flex gap-4 text-sm">
                    <span className="text-emerald-700 font-semibold">
                      {m.reveal.recommendations_unlocked} actions unlocked
                    </span>
                    <span className="text-gray-500">Confidence {m.reveal.confidence_pct}%</span>
                  </div>
                </div>
              )}
            </div>
          ))}
          <div ref={endRef} />
        </div>
        {showConfirmation ? (
          // The life-model review is shown before the dashboard unlocks. The dashboard is reached
          // ONLY via an explicit Confirm (onboarding_completed, confirmed) or explicit Skip.
          <div className="mt-3">
            <LifeModelConfirmation
              panel={panel}
              coverage={coverage}
              actions={advisorActions}
              finishing={finishing}
              onConfirm={() => finishOnboarding(false)}
              onSkip={() => finishOnboarding(true, 'explicit_skip_after_minimum')}
              onEdit={() => {
                setReviewing(false);
                setFinalAsked(false);
              }}
              onManualEntry={(d) => setActiveDomain(d)}
            />
          </div>
        ) : showFinalQuestion ? (
          // P0.6: the final open-ended question, asked once before the review.
          <div className="mt-3">
            <div className="rounded-2xl border-2 border-indigo-200 bg-indigo-50 p-4">
              <p className="text-sm text-gray-800">{FINAL_Q}</p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const v = input;
                  setInput('');
                  submitFinal(v);
                }}
                className="mt-3 flex gap-2"
              >
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={busy}
                  placeholder="Anything else that matters to you…"
                  className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
                <button
                  type="submit"
                  disabled={busy || !input.trim()}
                  className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium disabled:opacity-40"
                >
                  Send
                </button>
              </form>
              <button
                onClick={() => submitFinal('')}
                className="mt-2 text-xs text-gray-400 underline hover:text-gray-600"
              >
                Nothing else — show me what you understand →
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-3">
            {options && options.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {options.map((o) => (
                  <button
                    key={o}
                    disabled={busy}
                    onClick={() => submit(o)}
                    className="text-sm px-3 py-1.5 rounded-full border border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                  >
                    {o}
                  </button>
                ))}
              </div>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submit(input);
              }}
              className="flex gap-2"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={busy}
                placeholder="Type your answer…"
                className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
              <button
                type="submit"
                disabled={busy || !input.trim()}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium disabled:opacity-40"
              >
                Send
              </button>
            </form>

            {/* Action cards — phase-gated (P0.4): shown only after a few meaningful answers, never
                during the first discovery exchanges. Upload → /dashboard/documents; entry → AddDataModal. */}
            {showActions && (
              <div className="mt-4">
                <div className="text-[11px] uppercase text-gray-400 font-semibold mb-2">
                  Strengthen your plan
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {advisorActions.map((a, i) => (
                    <ActionCard key={i} action={a} onManualEntry={(d) => setActiveDomain(d)} />
                  ))}
                </div>
              </div>
            )}

            {onboardingMode && (
              <div className="mt-3 flex flex-col items-center gap-1">
                <p className="text-xs text-gray-500">
                  Your Life Model is {panel.discovery_completion_pct ?? 0}% complete
                  {coverage.filter((c) => c.coverage_pct < 100).length > 0
                    ? ` · ${coverage.filter((c) => c.coverage_pct < 100).length} areas still need context`
                    : ''}
                </p>
                <button
                  onClick={() => setReviewing(true)}
                  className="text-xs text-indigo-600 underline hover:text-indigo-800"
                >
                  Review what I understand about you →
                </button>
                <button
                  onClick={requestSkip}
                  disabled={finishing}
                  className="text-xs text-gray-400 underline hover:text-gray-600 disabled:opacity-50"
                >
                  Continue with limited dashboard
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Manual-entry quick forms (Step 4) — persist to canonical tables; refresh coverage on close. */}
      {activeDomain && (
        <AddDataModal
          isOpen={!!activeDomain}
          domain={activeDomain}
          onClose={() => {
            setActiveDomain(null);
            loadCoverage();
          }}
        />
      )}

      {/* Skip-policy warning — a skip is intentional + warned, never a one-click bypass. */}
      {showSkipWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-800">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              Your dashboard will be limited
            </h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              LifeNavigator works best after advisor discovery. If you continue now, your dashboard
              may be incomplete, recommendations may be less useful, and your Life Graph may be
              sparse.
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <button
                onClick={() => setShowSkipWarning(false)}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                Continue Advisor Discovery
              </button>
              <button
                onClick={confirmLimitedSkip}
                disabled={finishing}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300"
              >
                Continue with Limited Dashboard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Live context panel (D8) — the advisor always knows the current life model */}
      <aside className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 h-fit">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wide text-gray-500">
            What I know so far
          </h2>
          <span className="text-xs text-indigo-600 font-semibold">
            {panel.discovery_completion_pct ?? 0}%
          </span>
        </div>
        {panel.life_vision && (
          <p className="mt-2 text-sm text-gray-700 italic">“{panel.life_vision}”</p>
        )}
        {panel.primary_objective && (
          <div className="mt-3">
            <div className="text-[11px] uppercase text-gray-400 font-semibold">
              Primary objective
            </div>
            <div className="text-sm font-semibold text-gray-900">{panel.primary_objective}</div>
          </div>
        )}
        {panel.top_constraints && panel.top_constraints.length > 0 && (
          <div className="mt-3">
            <div className="text-[11px] uppercase text-rose-600 font-semibold">Constraints</div>
            <div className="text-sm text-gray-700">{panel.top_constraints.join(', ')}</div>
          </div>
        )}
        {panel.top_risks && panel.top_risks.length > 0 && (
          <div className="mt-3">
            <div className="text-[11px] uppercase text-amber-600 font-semibold">Risks</div>
            <div className="text-sm text-gray-700">{panel.top_risks.slice(0, 3).join(', ')}</div>
          </div>
        )}
        {panel.missing_areas && panel.missing_areas.length > 0 && (
          <div className="mt-3 text-xs text-gray-400">
            Still to cover: {panel.missing_areas.join(', ')}
          </div>
        )}
      </aside>
    </div>
  );
}
