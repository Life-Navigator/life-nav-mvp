'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  startSession,
  nextPrompt,
  recordAnswer,
  summarize,
  CONFIDENCE_STOP_THRESHOLD,
} from '@/lib/discovery/engine';
import type {
  AgentPersona,
  DiscoverySessionState,
  DiscoverySummary,
  PromptKind,
} from '@/types/discovery';

interface ChatMessage {
  role: 'agent' | 'user';
  text: string;
  kind?: PromptKind;
}

interface ConversationalShellProps {
  /** Persona used for the system prompt and prompt-library selection. */
  agentPersona: AgentPersona;
  /** Title shown at the top of the conversation. */
  title: string;
  /** First message the agent should send to open the session. */
  opening: string;
  /** Category to write onto public.goals (e.g. 'financial', 'career'). */
  goalCategory: string;
  /** Called once the user confirms the summary. */
  onFinalized?: (args: { goalId: string | null; summary: DiscoverySummary }) => void;
}

const PERSONA_LABEL: Record<AgentPersona, string> = {
  financial_advisor: 'Financial Advisor',
  physician_intake: 'Physician Intake',
  career_coach: 'Career Coach',
  education_counselor: 'Education Counselor',
  benefits_navigator: 'Benefits Navigator',
  estate_advisor: 'Estate Planner',
  general: 'Navigator',
};

/**
 * Conversational onboarding shell. Drives the deterministic discovery
 * engine via lib/discovery/engine.ts so it works today without any LLM;
 * the engine itself is the adapter point for a future LLM-backed run.
 */
export default function ConversationalShell({
  agentPersona,
  title,
  opening,
  goalCategory,
  onFinalized,
}: ConversationalShellProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: 'agent', text: opening }]);
  const [session, setSession] = useState<DiscoverySessionState | null>(null);
  const [draft, setDraft] = useState('');
  const [pendingKind, setPendingKind] = useState<PromptKind | null>(null);
  const [pendingText, setPendingText] = useState<string | null>(null);
  const [summary, setSummary] = useState<DiscoverySummary | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [goalId, setGoalId] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  // After the first user message we have a stated goal; bootstrap the session.
  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    setMessages((m) => [...m, { role: 'user', text }]);

    if (!session) {
      const s = startSession({
        stated_goal: text,
        agent_persona: agentPersona,
      });
      const probe = nextPrompt(s);
      setSession(s);
      if (!probe.done && probe.prompt) {
        setMessages((m) => [
          ...m,
          { role: 'agent', text: probe.prompt!.text, kind: probe.prompt!.kind },
        ]);
        setPendingKind(probe.prompt.kind);
        setPendingText(probe.prompt.text);
      } else {
        // Edge case: confident enough from the first answer.
        finishSession(s);
      }
      return;
    }

    // Subsequent turn — record under the kind of the agent's last prompt.
    if (!pendingKind || !pendingText) return;
    const updated = recordAnswer(session, {
      prompt_kind: pendingKind,
      prompt_text: pendingText,
      answer: text,
    });
    setSession(updated);

    const probe = nextPrompt(updated);
    if (probe.done) {
      finishSession(updated);
    } else if (probe.prompt) {
      setMessages((m) => [
        ...m,
        { role: 'agent', text: probe.prompt!.text, kind: probe.prompt!.kind },
      ]);
      setPendingKind(probe.prompt.kind);
      setPendingText(probe.prompt.text);
    }
  };

  const finishSession = (s: DiscoverySessionState) => {
    const sum = summarize(s);
    setSummary(sum);
    setPendingKind(null);
    setPendingText(null);
    setMessages((m) => [
      ...m,
      {
        role: 'agent',
        text: buildConfirmationText(sum),
        kind: 'confirmation',
      },
    ]);
  };

  const persistAndConfirm = async () => {
    if (!session || !summary) return;
    setSaving(true);
    setSaveErr(null);
    try {
      const res = await fetch('/api/onboarding/goal-discovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: session.session_id,
          goal_id: goalId,
          agent_persona: session.agent_persona,
          category: goalCategory,
          stated_goal: session.stated_goal,
          need_behind_need: session.need_behind_need ?? null,
          root_goal: session.root_goal ?? null,
          success_definition: session.success_definition ?? null,
          consequence_of_inaction: session.consequence_of_inaction ?? null,
          urgency: session.urgency ?? null,
          driver_scores: session.driver_scores,
          dominant_driver: summary.dominant_driver,
          secondary_driver: summary.secondary_driver,
          confidence: session.confidence,
          turns: session.turns.map((t) => ({
            turn_index: t.turn_index,
            prompt_kind: t.prompt_kind,
            prompt_text: t.prompt_text,
            user_answer: t.user_answer ?? null,
            detected_drivers: t.detected_drivers,
            inferred_root_goal: t.inferred_root_goal ?? null,
            confidence_after_turn: t.confidence_after_turn ?? null,
          })),
          finalize: true,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? 'Failed to save discovery');
      setGoalId(body.goal_id ?? null);
      setConfirmed(true);
      onFinalized?.({ goalId: body.goal_id ?? null, summary });
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : 'save failed');
    } finally {
      setSaving(false);
    }
  };

  const rejectAndContinue = () => {
    setSummary(null);
    setMessages((m) => [
      ...m,
      {
        role: 'agent',
        text: "Got it — what would you change about that summary? Tell me what's off.",
        kind: 'free_text',
      },
    ]);
    if (session) {
      setPendingKind('free_text');
      setPendingText('What would you change about the summary?');
    }
  };

  // Autofocus input.
  useEffect(() => {
    inputRef.current?.focus();
  }, [pendingKind, confirmed, summary]);

  const confidencePct = useMemo(
    () => Math.round((session?.confidence ?? 0) * 100),
    [session?.confidence]
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-4">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">{title}</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {PERSONA_LABEL[agentPersona]} · root-goal discovery
              {session && (
                <>
                  {' '}
                  · confidence {confidencePct}% (
                  {session.confidence >= CONFIDENCE_STOP_THRESHOLD
                    ? 'ready to summarize'
                    : 'still listening'}
                  )
                </>
              )}
            </p>
          </div>
        </header>

        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3 max-h-[55vh] overflow-y-auto">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={[
                  'max-w-[80%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap',
                  m.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100',
                ].join(' ')}
              >
                {m.text}
              </div>
            </div>
          ))}
        </div>

        {summary && !confirmed && (
          <ConfirmationCard
            summary={summary}
            onConfirm={persistAndConfirm}
            onReject={rejectAndContinue}
            saving={saving}
            error={saveErr}
          />
        )}

        {confirmed && (
          <div className="rounded border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/30 p-3 text-sm text-emerald-800 dark:text-emerald-200">
            Saved. Goal recorded with root-goal, driver, and confidence in your User Graph.
          </div>
        )}

        {!confirmed && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
            className="flex gap-2"
          >
            <textarea
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  submit();
                }
              }}
              rows={2}
              placeholder={
                session
                  ? 'Type your answer… (Cmd+Enter to send)'
                  : 'Tell me what you want to work on…'
              }
              className="flex-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2 text-sm"
            />
            <button
              type="submit"
              disabled={!draft.trim()}
              className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm disabled:bg-blue-400 self-end"
            >
              Send
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function ConfirmationCard({
  summary,
  onConfirm,
  onReject,
  saving,
  error,
}: {
  summary: DiscoverySummary;
  onConfirm: () => void;
  onReject: () => void;
  saving: boolean;
  error: string | null;
}) {
  const driverLabel = (d: DiscoverySummary['dominant_driver']) =>
    d === 'financial_security'
      ? 'Financial Security'
      : d === 'image'
        ? 'Image'
        : d === 'performance'
          ? 'Performance'
          : '—';

  return (
    <div className="bg-white dark:bg-gray-800 border-2 border-blue-300 dark:border-blue-700 rounded-lg p-4 space-y-3">
      <h2 className="text-sm font-semibold text-blue-700 dark:text-blue-200 uppercase tracking-wide">
        Let me read this back
      </h2>
      <dl className="text-sm text-gray-800 dark:text-gray-100 space-y-2">
        <Row label="You stated" value={summary.stated_goal} />
        <Row label="Your underlying goal appears to be" value={summary.root_goal ?? '—'} />
        <Row
          label="Your primary motivation appears to be"
          value={driverLabel(summary.dominant_driver)}
        />
        {summary.secondary_driver && (
          <Row label="Secondary motivation" value={driverLabel(summary.secondary_driver)} />
        )}
        {summary.success_definition && (
          <Row label="Success would look like" value={summary.success_definition} />
        )}
        {summary.urgency && <Row label="Urgency" value={summary.urgency} />}
      </dl>

      {error && (
        <div className="rounded border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/30 p-2 text-xs text-red-800 dark:text-red-200">
          {error}
        </div>
      )}

      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={onReject}
          className="px-3 py-1.5 text-sm rounded border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          Not quite — let me adjust
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={saving}
          className="px-3 py-1.5 text-sm rounded bg-blue-600 hover:bg-blue-700 text-white disabled:bg-blue-400"
        >
          {saving ? 'Saving…' : "Yes, that's right"}
        </button>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <dt className="text-xs uppercase font-semibold text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="col-span-2">{value}</dd>
    </div>
  );
}

function buildConfirmationText(summary: DiscoverySummary): string {
  const lines = [
    "Here's what I'm hearing:",
    `• You stated: ${summary.stated_goal}`,
    summary.root_goal ? `• Your underlying goal appears to be: ${summary.root_goal}` : null,
    summary.dominant_driver
      ? `• Your primary motivation appears to be: ${formatDriver(summary.dominant_driver)}`
      : null,
    summary.success_definition ? `• Success would look like: ${summary.success_definition}` : null,
    summary.urgency ? `• Urgency: ${summary.urgency}` : null,
    '',
    'Did I get that right?',
  ];
  return lines.filter(Boolean).join('\n');
}

function formatDriver(d: NonNullable<DiscoverySummary['dominant_driver']>) {
  if (d === 'financial_security') return 'Financial Security';
  if (d === 'image') return 'Image';
  return 'Performance';
}
