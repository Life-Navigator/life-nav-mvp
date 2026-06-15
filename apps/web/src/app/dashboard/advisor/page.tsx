'use client';

// Advisor (Sprint 41) — the Relationship Manager IS the chat. The advisor asks discovery questions;
// each answer writes to the canonical life model in real time and shows what the platform just
// learned (✓ chips). A live context panel always reflects the current life model. This is onboarding
// that feels like talking to an advisor, not filling a form.

import { useRouter } from 'next/navigation';
import React, { useEffect, useRef, useState } from 'react';
import AddDataModal from '@/components/dashboard/AddDataModal';
import StreamingText from '@/components/ui/StreamingText';
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
  stream?: boolean; // a fast deterministic ack still awaiting the validated answer
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
  const scrollRef = useRef<HTMLDivElement | null>(null);
  // Auto-scroll to the newest message ONLY when the user is already near the bottom — never yank them
  // down while they're scrolled up reviewing earlier messages.
  const stickRef = useRef(true);
  const onScroll = () => {
    const el = scrollRef.current;
    if (el) stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };
  // Keep the latest text in view while it streams in (only if the user hasn't scrolled up).
  const streamScroll = () => {
    const el = scrollRef.current;
    if (el && stickRef.current) el.scrollTop = el.scrollHeight;
  };
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

  // Derive the action cards (Step 1/2). P0.4: recommend data ONLY for domains the user actually
  // engaged with (a stated goal → coverage > 0 but < 100). A domain at 0% (e.g. career the user
  // never mentioned) must NOT surface a "do this" card — we don't push career data at someone who
  // didn't raise career. Fall back to all-incomplete only if nothing is engaged yet.
  const engagedKeys = coverage
    .filter((c) => c.coverage_pct > 0 && c.coverage_pct < 100)
    .map((c) => c.domain);
  const missingDomainKeys: string[] = engagedKeys.length
    ? engagedKeys
    : coverage.length
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
    // P0.7: an intentional handoff (Life Model summary) before the dashboard — not an abrupt jump.
    setTransitioning(true);
    setTimeout(() => router.push('/dashboard'), 3200);
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
  // Non-streaming fallback (used if the SSE stream is unavailable).
  const sendBlocking = async (message: string, pending_key: string | null) => {
    const t = await fetch('/api/life/discovery-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, pending_key: pending_key ?? '' }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
    apply(t);
  };

  const send = async (message: string, pending_key: string | null) => {
    setBusy(true);
    try {
      const resp = await fetch('/api/life/discovery-chat-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, pending_key: pending_key ?? '' }),
      });
      if (!resp.ok || !resp.body) {
        await sendBlocking(message, pending_key);
        return;
      }
      const reader = resp.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      let sawFinal = false;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf('\n\n')) >= 0) {
          const frame = buf.slice(0, nl);
          buf = buf.slice(nl + 2);
          const line = frame.split('\n').find((l) => l.startsWith('data:'));
          if (!line) continue;
          let evt: Turn & { type: string; assistant_message: string };
          try {
            evt = JSON.parse(line.slice(5).trim());
          } catch {
            continue;
          }
          if (evt.type === 'ack') {
            // Fast first paint — show the deterministic acknowledgment immediately.
            setMsgs((m) => [...m, { role: 'advisor', text: evt.assistant_message, stream: true }]);
          } else if (evt.type === 'final') {
            sawFinal = true;
            // Replace the streaming placeholder with the validated answer; apply all state updates.
            setMsgs((m) => {
              const copy = [...m];
              const last = copy[copy.length - 1];
              const finalMsg: Msg = {
                role: 'advisor',
                text: evt.assistant_message,
                updates: evt.updates,
                reveal: evt.reveal,
              };
              if (last && last.role === 'advisor' && last.stream) copy[copy.length - 1] = finalMsg;
              else copy.push(finalMsg);
              return copy;
            });
            setPending(evt.pending_key);
            setOptions(evt.options ?? null);
            setPanel(evt.context_panel || {});
            setComplete(evt.complete);
          }
        }
      }
      if (!sawFinal) await sendBlocking(message, pending_key); // stream cut off → safe fallback
    } catch {
      await sendBlocking(message, pending_key);
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    send('', null); /* open the conversation */
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickRef.current) el.scrollTop = el.scrollHeight;
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
  // When the review or final-question screen appears, reveal it (and its CTA) in the bottom region.
  useEffect(() => {
    const el = scrollRef.current;
    if (el && (showConfirmation || showFinalQuestion)) el.scrollTop = el.scrollHeight;
  }, [showConfirmation, showFinalQuestion]);

  // P0.7: intentional transition into the dashboard.
  if (transitioning) {
    const priorities = [panel.primary_objective, ...(panel.top_themes || [])]
      .filter(Boolean)
      .slice(0, 3) as string[];
    const risks = (panel.top_risks || []).slice(0, 3);
    const opps = (panel.top_opportunities || []).slice(0, 3);
    const Col = ({ title, items, dot }: { title: string; items: string[]; dot: string }) => (
      <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-600">
          {title}
        </div>
        {items.length ? (
          <ul className="space-y-1 text-sm text-gray-700">
            {items.map((x, i) => (
              <li key={i} className="flex gap-2">
                <span className={dot}>•</span>
                {x}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-600">Builds as you add more.</p>
        )}
      </div>
    );
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600 mb-4" />
        <h2 className="text-2xl font-bold text-gray-900">Your Life Model is ready.</h2>
        <p className="text-gray-500 mt-1">
          Here&apos;s what matters most — your dashboard reflects it.
        </p>
        <div className="mt-6 grid w-full max-w-3xl gap-4 text-left sm:grid-cols-3">
          <Col title="Top priorities" items={priorities} dot="text-indigo-500" />
          <Col title="Top risks" items={risks} dot="text-red-500" />
          <Col title="Top opportunities" items={opps} dot="text-emerald-500" />
        </div>
        <p className="mt-5 text-sm text-gray-600">Taking you to your dashboard…</p>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full overflow-hidden bg-gray-50">
      <div className="mx-auto flex h-full w-full max-w-6xl gap-6 px-4 py-4">
        {/* Conversation — full-height flex shell: fixed header · scrollable messages · pinned input.
            This is what makes the immersive (overflow-hidden) page scroll internally instead of
            clipping the input/CTA below the fold. */}
        <div className="flex min-h-0 flex-1 flex-col">
          {/* Header (never scrolls away) */}
          <div className="shrink-0">
            <h1 className="text-xl font-bold text-gray-900">Your Advisor</h1>
            {!complete &&
              (coverage.length > 0 ? (
                // Rule 5: confidence-by-domain, not a question count.
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-gray-500">
                  <span className="uppercase tracking-wide text-gray-600 font-semibold">
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
                  Got it — your{uploadNotice ? ` ${uploadNotice}` : ''} document was added.
                  I&apos;ve refreshed what I know.
                </span>
                <button
                  onClick={() => setUploadNotice(null)}
                  className="text-xs underline text-emerald-700 shrink-0"
                >
                  Dismiss
                </button>
              </div>
            )}
          </div>
          {/* The ONLY vertical scroll. min-h-0 lets this flex child shrink and scroll instead of
              growing and pushing the input off-screen. Auto-sticks to newest unless scrolled up. */}
          <div
            ref={scrollRef}
            onScroll={onScroll}
            data-testid="chat-scroll"
            className="mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1"
          >
            {msgs.map((m, i) => (
              <div key={i} className={m.role === 'user' ? 'text-right' : ''}>
                <div
                  className={`inline-block max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm ${m.role === 'advisor' ? 'bg-indigo-50 text-gray-800' : 'bg-gray-900 text-white'}`}
                >
                  {m.role === 'advisor' ? (
                    <StreamingText
                      text={m.text}
                      animate={i === msgs.length - 1}
                      onTick={streamScroll}
                    />
                  ) : (
                    m.text
                  )}
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
                    <div className="mt-2 text-[11px] uppercase tracking-wide text-gray-600 font-semibold">
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
          {/* Bottom region — pinned below the messages, bounded and independently scrollable so the
              input and EVERY CTA (review, "enter dashboard") stay reachable, never clipped. */}
          <div className="shrink-0 max-h-[60vh] overflow-y-auto border-t border-gray-200 bg-gray-50 pt-3">
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
                      className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium disabled:bg-gray-300 disabled:text-gray-500"
                    >
                      Send
                    </button>
                  </form>
                  <button
                    onClick={() => submitFinal('')}
                    className="mt-2 text-xs text-gray-600 underline hover:text-gray-600"
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
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      // Enter submits; Shift+Enter inserts a newline.
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        submit(input);
                      }
                    }}
                    rows={1}
                    placeholder="Type your answer…  (Enter to send · Shift+Enter for a new line)"
                    className="max-h-32 flex-1 resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <button
                    type="submit"
                    disabled={busy || !input.trim()}
                    className="shrink-0 self-end rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:bg-gray-300 disabled:text-gray-500"
                  >
                    {busy ? '…' : 'Send'}
                  </button>
                </form>

                {/* Action cards — phase-gated (P0.4): shown only after a few meaningful answers, never
                during the first discovery exchanges. Upload → /dashboard/documents; entry → AddDataModal. */}
                {showActions && (
                  <div className="mt-4">
                    <div className="text-[11px] uppercase text-gray-600 font-semibold mb-2">
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
                      className="text-xs text-gray-600 underline hover:text-gray-600 disabled:opacity-50"
                    >
                      Continue with limited dashboard
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
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
                LifeNavigator works best after advisor discovery. If you continue now, your
                dashboard may be incomplete, recommendations may be less useful, and your Life Graph
                may be sparse.
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
        <aside className="hidden w-80 shrink-0 self-stretch min-h-0 overflow-y-auto rounded-xl border border-gray-100 bg-white p-5 shadow-sm lg:block">
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
              <div className="text-[11px] uppercase text-gray-600 font-semibold">
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
            <div className="mt-3 text-xs text-gray-600">
              Still to cover: {panel.missing_areas.join(', ')}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
