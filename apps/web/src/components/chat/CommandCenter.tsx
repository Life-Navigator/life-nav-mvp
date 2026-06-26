'use client';

/**
 * Advisor Chat Command Center — the ChatGPT-style surface for LifeNavigator.
 *
 * ONE component powers both surfaces: the dashboard (variant full — sidebar with projects + recent
 * chats) and the floating launcher (variant compact — no sidebar). It supports old chat history, new
 * chats, projects, agent selection (Relationship Manager OR a direct domain agent), grounded cited
 * answers, and per-thread context. It talks ONLY to advisor mode (/api/chat/*) — discovery/onboarding is
 * never reachable here, so a completed user never sees the onboarding line.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import StreamingText from '@/components/ui/StreamingText';
import {
  chatClient,
  type Project,
  type Thread,
  type Citation,
  type Reasoning,
} from '@/lib/chat/client';
import { AGENT_FALLBACK, RELATIONSHIP_MANAGER, agentName, type AgentInfo } from '@/lib/chat/agents';
import { ADVISOR_WELCOME, ADVISOR_INCOMPLETE_ONBOARDING, ADVISOR_ERROR } from '@/lib/chat/advisor';

// Step-based "work happening" indicator. The advisor response can take ~20s (LLM + multi-agent
// orchestration); a passive "thinking…" makes it feel frozen. Rotate through real-sounding steps +
// animated dots so the user always sees progress.
const THINKING_STEPS = [
  'reviewing what we know about you…',
  'checking your documents and facts…',
  'reviewing your recommendations…',
  'updating your readiness…',
  'preparing your answer…',
];
function ThinkingProgress({ name }: { name: string }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStep((s) => Math.min(s + 1, THINKING_STEPS.length - 1)), 2600);
    return () => clearInterval(t);
  }, []);
  return (
    <div
      className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400"
      data-testid="cc-loading"
    >
      <span className="inline-flex gap-1" aria-hidden>
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-400 [animation-delay:-0.3s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-400 [animation-delay:-0.15s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-400" />
      </span>
      <span>
        <span className="font-medium text-gray-600 dark:text-gray-300">{name}</span> is{' '}
        {THINKING_STEPS[step]}
      </span>
    </div>
  );
}

interface UiMessage {
  role: 'user' | 'assistant';
  content: string;
  agent?: string | null;
  citations?: Citation[];
  reasoning?: Reasoning | null;
  goals?: string[];
  risks?: string[];
}

// Friendly labels for citation source tables → human source chips ("Offer Letter", "Life Insurance").
const SOURCE_LABEL: Record<string, string> = {
  'life.facts': 'Document',
  'documents.documents': 'Document',
  'career.career_goals': 'Career Goal',
  'career.experience_records': 'Experience',
  'education.certifications': 'Certification',
  'education.education_goals': 'Education Goal',
  'finance.financial_accounts': 'Finances',
  'family.dependents': 'Family',
};
function sourceChipLabel(c: Citation): string {
  const st = c.sourceTable || '';
  if (SOURCE_LABEL[st]) return SOURCE_LABEL[st];
  // Prefer the clean domain over a raw schema prefix (e.g. "public.education_records" → "Education").
  if (c.domain) return c.domain.charAt(0).toUpperCase() + c.domain.slice(1);
  if (st.includes('.')) {
    const d = st.split('.')[0];
    return d.charAt(0).toUpperCase() + d.slice(1);
  }
  return 'Source';
}

// ---- Advisor Action Loop: the approval-gated life-change card ----------------------------------------
interface ActionField {
  key: string;
  label: string;
  type: string;
  optional: boolean;
}
interface ActionProposal {
  action: string;
  label: string;
  message: string;
  impact: string[];
  fields: ActionField[];
  domain: string;
}

function ActionCard({
  proposal,
  busy,
  onApprove,
  onCancel,
}: {
  proposal: ActionProposal;
  busy: boolean;
  onApprove: (fields: Record<string, string>) => void;
  onCancel: () => void;
}) {
  const [fields, setFields] = useState<Record<string, string>>({});
  const canApprove = proposal.fields
    .filter((f) => !f.optional)
    .every((f) => (fields[f.key] || '').trim());
  return (
    <div className="my-2 max-w-[88%] rounded-xl border border-indigo-200 bg-white p-3 text-left dark:border-indigo-800 dark:bg-gray-800">
      <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
        Update your plan · {proposal.label}
      </div>
      <div className="mt-1 flex flex-wrap gap-1">
        {proposal.impact.map((x, j) => (
          <span
            key={j}
            className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
          >
            {x}
          </span>
        ))}
      </div>
      <div className="mt-2 space-y-1.5">
        {proposal.fields.map((f) => (
          <div key={f.key} className="flex items-center gap-2">
            <label className="w-32 shrink-0 text-[11px] text-gray-500 dark:text-gray-400">
              {f.label}
              {f.optional ? '' : ' *'}
            </label>
            <input
              type={f.type === 'number' ? 'number' : 'text'}
              value={fields[f.key] || ''}
              onChange={(e) => setFields((s) => ({ ...s, [f.key]: e.target.value }))}
              className="flex-1 rounded border border-gray-300 px-2 py-1 text-xs text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            />
          </div>
        ))}
      </div>
      <div className="mt-2.5 flex items-center gap-2">
        <button
          type="button"
          disabled={!canApprove || busy}
          onClick={() => onApprove(fields)}
          className="rounded-lg bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Approve & update'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-3 py-1 text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          Cancel
        </button>
      </div>
      <div className="mt-1.5 text-[10px] text-gray-400">
        Nothing is saved until you approve — edit the values first if needed.
      </div>
    </div>
  );
}

// ---- Impact Summary Card: the instant, HONEST payoff after an approved action --------------------
interface ActionWritten {
  fact_type: string;
  value: string;
  ok: boolean;
}
interface ActionResult {
  ok: boolean;
  label?: string;
  written?: ActionWritten[];
  impact?: string[];
  summary?: string;
}
function prettyFact(ft: string): string {
  const k = ft.split('.').pop() || ft;
  return k.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
}
const _MONEY = /salary|bonus|equity|price|payment|mortgage|tuition|cost|amount|balance/i;
function fmtFact(ft: string, v: string): string {
  const raw = String(v ?? '').trim();
  if (_MONEY.test(ft) && /^\d[\d,]*(\.\d+)?$/.test(raw)) {
    const n = Number(raw.replace(/,/g, ''));
    if (!Number.isNaN(n) && n >= 1000)
      return n.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
      });
  }
  return raw;
}
function ImpactSummaryCard({ result }: { result: ActionResult }) {
  const facts = (result.written || []).filter((w) => w.ok);
  return (
    <div className="my-2 max-w-[88%] rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-left dark:border-emerald-800 dark:bg-emerald-900/20">
      <div className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
        ✓ Update complete{result.label ? ` · ${result.label}` : ''}
      </div>
      {facts.length > 0 && (
        <>
          <div className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
            Added to your life model ({facts.length})
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            {facts.map((w, j) => (
              <span
                key={j}
                className="rounded-full border border-emerald-200 bg-white px-2 py-0.5 text-[10px] text-emerald-800 dark:border-emerald-700 dark:bg-gray-800 dark:text-emerald-200"
              >
                {prettyFact(w.fact_type)}: {fmtFact(w.fact_type, w.value)}
              </span>
            ))}
          </div>
        </>
      )}
      {(result.impact || []).length > 0 && (
        <>
          <div className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
            This affects
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            {(result.impact || []).map((x, j) => (
              <span
                key={j}
                className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-800/40 dark:text-emerald-200"
              >
                {x}
              </span>
            ))}
          </div>
        </>
      )}
      <div className="mt-2 text-[10px] text-emerald-600 dark:text-emerald-400">
        Your advisor and dashboard now reflect this.
      </div>
    </div>
  );
}

const STARTERS = [
  'What should I work on next?',
  'What do you know about my career?',
  'Why did my readiness change?',
  'What information are you missing?',
];

export default function CommandCenter({
  compact = false,
  initialInput = '',
}: {
  compact?: boolean;
  initialInput?: string;
}) {
  const [agents, setAgents] = useState<AgentInfo[]>(AGENT_FALLBACK);
  // Honor a domain-scoped entry: /dashboard/advisor?agent=health_advisor (or ?domain=health) opens the
  // matching domain advisor instead of the generic Arcana orchestrator. Falls back to RM if absent/invalid.
  const [selectedAgent, setSelectedAgent] = useState<string>(() => {
    if (typeof window === 'undefined') return RELATIONSHIP_MANAGER;
    const sp = new URLSearchParams(window.location.search);
    const dom = sp.get('domain');
    const cand = sp.get('agent') || (dom ? `${dom}_advisor` : '');
    const valid = new Set<string>([RELATIONSHIP_MANAGER, ...AGENT_FALLBACK.map((a) => a.id)]);
    return cand && valid.has(cand) ? cand : RELATIONSHIP_MANAGER;
  });
  const [projects, setProjects] = useState<Project[]>([]);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState(initialInput);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null);
  const [openCitations, setOpenCitations] = useState<number | null>(null);
  // Advisor Action Loop: a detected life change awaiting the user's approval (never auto-applied).
  const [action, setAction] = useState<ActionProposal | null>(null);
  const [actionResult, setActionResult] = useState<ActionResult | null>(null);
  const [applyingAction, setApplyingAction] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  const refreshThreads = useCallback(async () => {
    try {
      setThreads(await chatClient.listThreads());
    } catch {
      /* keep prior */
    }
  }, []);

  useEffect(() => {
    void (async () => {
      const [a, p] = await Promise.all([
        chatClient.listAgents(),
        chatClient.listProjects().catch(() => []),
      ]);
      setAgents(a);
      setProjects(p);
      void refreshThreads();
    })();
    fetch('/api/onboarding/status', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setOnboardingComplete(!!d.onboarding_completed))
      .catch(() => {});
  }, [refreshThreads]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const newChat = () => {
    setActiveThreadId(null);
    setMessages([]);
    setError(null);
    setOpenCitations(null);
    setAction(null);
    setActionResult(null);
  };

  const openThread = async (t: Thread) => {
    setActiveThreadId(t.id);
    setError(null);
    setOpenCitations(null);
    if (t.selected_agent) setSelectedAgent(t.selected_agent);
    try {
      const msgs = await chatClient.getMessages(t.id);
      setMessages(
        msgs
          .filter((m) => m.role !== 'system')
          .map((m) => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
            agent: m.agent,
            citations: m.citations,
          }))
      );
    } catch {
      setMessages([]);
    }
  };

  const createProject = async () => {
    const name =
      typeof window !== 'undefined' ? window.prompt('Project name (e.g. "MBA Decision")') : '';
    if (!name || !name.trim()) return;
    try {
      const p = await chatClient.createProject(name.trim());
      if (p) setProjects((prev) => [p, ...prev]);
    } catch {
      /* ignore */
    }
  };

  const inputDisabled = loading || onboardingComplete === false;

  const submit = async (raw?: string) => {
    const text = (typeof raw === 'string' ? raw : input).trim();
    if (!text || inputDisabled) return;
    setInput('');
    setError(null);
    setMessages((m) => [...m, { role: 'user', content: text }]);
    setLoading(true);
    try {
      const res = await chatClient.send({
        message: text,
        agent: selectedAgent,
        threadId: activeThreadId,
      });
      if (res.thread_id && !activeThreadId) {
        setActiveThreadId(res.thread_id);
        void refreshThreads();
      }
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          content: res.assistant_message,
          agent: res.agent,
          citations: res.citations,
          reasoning: res.reasoning,
          goals: res.goals,
          risks: res.risks,
        },
      ]);
      // Advisor Action Loop: did the user mention a life change? Propose it (no write until approval).
      try {
        const det = (await fetch('/api/chat/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ op: 'detect', message: text }),
        }).then((r) => (r.ok ? r.json() : null))) as ActionProposal | null;
        if (det && det.action) {
          setAction(det);
          setActionResult(null);
        }
      } catch {
        /* detection is best-effort — never block the chat */
      }
    } catch {
      setError(ADVISOR_ERROR);
    } finally {
      setLoading(false);
    }
  };

  // The APPROVAL step — only fires when the user clicks "Approve & update". Writes via the gated
  // /api/chat/action apply path, then surfaces the result summary. Nothing is written before this.
  const approveAction = async (fields: Record<string, string>) => {
    if (!action) return;
    setApplyingAction(true);
    try {
      const res = await fetch('/api/chat/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          op: 'apply',
          action: action.action,
          fields,
          conversation_id: activeThreadId ?? '',
        }),
      }).then((r) => (r.ok ? r.json() : null));
      if (res && res.ok) {
        setActionResult(res as ActionResult);
        setAction(null);
        // The new confirmed facts now power the advisor + the dashboard "Recently learned" strip on next
        // read; the Impact Summary Card is the live payoff in-chat.
        void refreshThreads();
      } else {
        setActionResult({ ok: false, summary: 'That didn’t save — please try again.' });
      }
    } catch {
      setActionResult({ ok: false, summary: 'That didn’t save — please try again.' });
    } finally {
      setApplyingAction(false);
    }
  };

  const welcome = onboardingComplete === false ? ADVISOR_INCOMPLETE_ONBOARDING : ADVISOR_WELCOME;
  const showEmpty = messages.length === 0;

  const agentSelector = (
    <select
      aria-label="Select agent"
      value={selectedAgent}
      onChange={(e) => setSelectedAgent(e.target.value)}
      className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-800 focus:border-indigo-500 focus:outline-none"
    >
      {agents.map((a) => (
        <option key={a.id} value={a.id}>
          {a.name}
        </option>
      ))}
    </select>
  );

  const conversation = (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-gray-200 px-3 py-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-gray-900">
            {agentName(selectedAgent, agents)}
          </div>
          <div className="text-[11px] text-gray-500">
            {selectedAgent === RELATIONSHIP_MANAGER
              ? 'Coordinates your domain advisors'
              : 'Direct agent'}
          </div>
        </div>
        {agentSelector}
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3" data-testid="cc-messages">
        {showEmpty && (
          <div className="mx-auto mt-6 max-w-md text-center text-sm text-gray-600">
            <p>{welcome}</p>
            {onboardingComplete !== false && (
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {STARTERS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => submit(s)}
                    disabled={inputDisabled}
                    className="rounded-full border border-indigo-200 px-3 py-1.5 text-xs text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'text-right' : ''}>
            <div
              className={`inline-block max-w-[88%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm ${
                m.role === 'user' ? 'bg-gray-900 text-white' : 'bg-indigo-50 text-gray-800'
              }`}
            >
              {m.role === 'assistant' ? (
                <StreamingText text={m.content} animate={i === messages.length - 1} />
              ) : (
                m.content
              )}
            </div>
            {m.role === 'assistant' && m.agent && (
              <div className="mt-0.5 text-[10px] uppercase tracking-wide text-gray-400">
                {agentName(m.agent, agents)}
              </div>
            )}
            {m.role === 'assistant' &&
              (() => {
                const cites = m.citations || [];
                // Distinct human source chips (dedup by friendly label).
                const sources = Array.from(new Set(cites.map(sourceChipLabel)));
                const rsn = m.reasoning;
                const hasWhy =
                  cites.length > 0 ||
                  !!(rsn && ((rsn.tradeoffs?.length ?? 0) || (rsn.what_we_know?.length ?? 0)));
                const goals = m.goals || [];
                const risks = m.risks || [];
                if (!goals.length && !risks.length && !sources.length && !hasWhy) return null;
                return (
                  <div className="mt-1.5 space-y-1.5 text-left">
                    {/* Goal (emerald), risk (rose), and source (indigo) chips — compact, never in the text */}
                    <div className="flex flex-wrap items-center gap-1">
                      {goals.map((g, j) => (
                        <span
                          key={`g${j}`}
                          className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                        >
                          {g}
                        </span>
                      ))}
                      {risks.map((r, j) => (
                        <span
                          key={`r${j}`}
                          className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-medium text-rose-700 dark:bg-rose-900/30 dark:text-rose-300"
                        >
                          {r}
                        </span>
                      ))}
                      {sources.map((label, j) => (
                        <button
                          key={`s${j}`}
                          type="button"
                          onClick={() => setOpenCitations(openCitations === i ? null : i)}
                          className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-700 hover:bg-indigo-100"
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    {/* The "Why?" evidence drawer — reasoning + sources, hidden by default, never dumped */}
                    {hasWhy && (
                      <div>
                        <button
                          type="button"
                          onClick={() => setOpenCitations(openCitations === i ? null : i)}
                          className="text-[11px] font-medium text-indigo-600 hover:underline"
                        >
                          {openCitations === i ? 'Hide why' : 'Why?'}
                        </button>
                        {openCitations === i && (
                          <div className="mt-1 space-y-2 rounded-lg border border-gray-200 bg-white p-2.5 dark:border-gray-700 dark:bg-gray-800">
                            {rsn?.tradeoffs?.length ? (
                              <div>
                                <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                                  What I weighed
                                </div>
                                {rsn.tradeoffs.map((t, k) => (
                                  <div
                                    key={k}
                                    className="text-[11px] text-gray-600 dark:text-gray-300"
                                  >
                                    {t.option ? (
                                      <span className="font-medium text-gray-800 dark:text-gray-100">
                                        {t.option}:{' '}
                                      </span>
                                    ) : null}
                                    {t.benefit}
                                    {t.benefit && t.cost ? ' — but ' : ''}
                                    {t.cost}
                                  </div>
                                ))}
                              </div>
                            ) : null}
                            {rsn?.what_we_know?.length ? (
                              <div>
                                <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                                  From what you&apos;ve shared
                                </div>
                                {rsn.what_we_know.map((w, k) => (
                                  <div
                                    key={k}
                                    className="text-[11px] text-gray-600 dark:text-gray-300"
                                  >
                                    • {w}
                                  </div>
                                ))}
                              </div>
                            ) : null}
                            {cites.length ? (
                              <div>
                                <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                                  Sources
                                </div>
                                {cites.slice(0, 12).map((c, j) => (
                                  <div
                                    key={j}
                                    className="text-[11px] text-gray-600 dark:text-gray-300"
                                  >
                                    <span className="font-medium text-gray-800 dark:text-gray-100">
                                      {c.label}:
                                    </span>{' '}
                                    {c.value}
                                    <span className="text-gray-400">
                                      {' · '}
                                      {sourceChipLabel(c)}
                                      {typeof c.confidence === 'number'
                                        ? ` · conf ${c.confidence}`
                                        : ''}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}
          </div>
        ))}

        {/* Advisor Action Loop — approval-gated life-change card + the post-approval result */}
        {action && (
          <ActionCard
            proposal={action}
            busy={applyingAction}
            onApprove={approveAction}
            onCancel={() => setAction(null)}
          />
        )}
        {actionResult &&
          (actionResult.ok ? (
            <ImpactSummaryCard result={actionResult} />
          ) : (
            <div className="my-2 max-w-[88%] rounded-xl border border-rose-200 bg-rose-50 p-3 text-left text-sm text-rose-700">
              {actionResult.summary}
            </div>
          ))}

        {loading && <ThinkingProgress name={agentName(selectedAgent, agents)} />}
        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
            {error}
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="shrink-0 border-t border-gray-200 bg-gray-50 px-3 py-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          className="flex gap-2"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void submit();
              }
            }}
            rows={1}
            disabled={inputDisabled}
            placeholder={
              onboardingComplete === false ? 'Finish setup to chat…' : 'Ask your advisor…'
            }
            className="max-h-32 flex-1 resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-500 caret-indigo-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-400"
          />
          <button
            type="submit"
            disabled={inputDisabled || !input.trim()}
            className="shrink-0 self-end rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:bg-gray-300 disabled:text-gray-500"
          >
            Send
          </button>
        </form>
        <p className="mt-1 text-[10px] text-gray-400">
          General information, not financial, tax, or legal advice.
        </p>
      </div>
    </div>
  );

  if (compact) {
    return (
      <div className="flex h-full w-full flex-col bg-white">
        <div className="flex shrink-0 items-center justify-between border-b border-gray-200 px-3 py-2">
          <span className="text-sm font-semibold text-gray-900">Advisor</span>
          <button
            type="button"
            onClick={newChat}
            className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
          >
            + New chat
          </button>
        </div>
        {conversation}
      </div>
    );
  }

  return (
    <div className="flex h-full w-full overflow-hidden bg-white">
      {/* Sidebar */}
      <aside className="flex w-72 shrink-0 flex-col border-r border-gray-200 bg-gray-50">
        <div className="space-y-2 p-3">
          <button
            type="button"
            onClick={newChat}
            className="w-full rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            + New chat
          </button>
          <button
            type="button"
            onClick={createProject}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
          >
            + New project
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
          {projects.length > 0 && (
            <div className="mb-2">
              <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                Projects
              </div>
              {projects.map((p) => (
                <div
                  key={p.id}
                  className="px-2 py-1 text-sm text-gray-700"
                  data-testid="cc-project"
                >
                  📁 {p.name}
                </div>
              ))}
            </div>
          )}
          <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            Recent chats
          </div>
          {threads.length === 0 ? (
            <div className="px-2 py-2 text-xs text-gray-400">No chats yet — start one above.</div>
          ) : (
            threads.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => openThread(t)}
                data-testid="cc-thread"
                className={`block w-full truncate rounded-md px-2 py-1.5 text-left text-sm ${
                  t.id === activeThreadId
                    ? 'bg-indigo-100 text-indigo-900'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                {t.title || 'Untitled chat'}
              </button>
            ))
          )}
        </div>
      </aside>

      {conversation}
    </div>
  );
}
