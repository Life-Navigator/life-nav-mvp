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
import { chatClient, type Project, type Thread, type Citation } from '@/lib/chat/client';
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
  const [selectedAgent, setSelectedAgent] = useState<string>(RELATIONSHIP_MANAGER);
  const [projects, setProjects] = useState<Project[]>([]);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState(initialInput);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null);
  const [openCitations, setOpenCitations] = useState<number | null>(null);
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
        },
      ]);
    } catch {
      setError(ADVISOR_ERROR);
    } finally {
      setLoading(false);
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
            {m.role === 'assistant' && m.citations && m.citations.length > 0 && (
              <div className="mt-1">
                <button
                  type="button"
                  onClick={() => setOpenCitations(openCitations === i ? null : i)}
                  className="text-[11px] font-medium text-indigo-600 underline"
                >
                  {openCitations === i ? 'Hide sources' : `Sources (${m.citations.length})`}
                </button>
                {openCitations === i && (
                  <div className="mt-1 space-y-1 rounded-lg border border-gray-200 bg-white p-2 text-left">
                    <div className="text-[10px] uppercase tracking-wide text-gray-500">
                      Grounded sources (section-level)
                    </div>
                    {m.citations.slice(0, 12).map((c, j) => (
                      <div key={j} className="text-[11px] text-gray-600">
                        <span className="font-medium text-gray-800">{c.label}:</span> {c.value}{' '}
                        <span className="text-gray-400">
                          [{c.sourceTable}
                          {typeof c.confidence === 'number' ? ` · conf ${c.confidence}` : ''}]
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
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
            className="max-h-32 flex-1 resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
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
