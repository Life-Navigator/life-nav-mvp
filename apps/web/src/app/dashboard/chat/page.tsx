/**
 * /dashboard/chat — conversation history + active chat panel.
 *
 * Two-column layout:
 *   * Left: list of past conversations (newest first), with a "New chat"
 *     button at the top. Clicking one loads its messages.
 *   * Right: active conversation panel — list of messages + composer. Sends
 *     to POST /api/agent/chat (the governed factory) with conversation_id.
 *
 * Conversation id is stable across turns; on a fresh "New chat" the route
 * mints a UUID after the first message. The URL ?id=<uuid> deep-links to a
 * specific conversation so the browser back button works.
 */

'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AdviceDisclaimer from '@/components/advice/AdviceDisclaimer';
import { levelFromText } from '@/lib/advice/disclosure';

interface ConversationSummary {
  id: string;
  title: string | null;
  last_message_at: string;
  message_count: number;
  created_at: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
}

export default function ChatPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-[calc(100vh-64px)] w-full items-center justify-center text-sm text-gray-500">
          Loading…
        </div>
      }
    >
      <ChatPageInner />
    </Suspense>
  );
}

function ChatPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const activeId = params.get('id');

  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [composer, setComposer] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Context-aware advice disclosure: tier derived from the latest user message (or what's being
  // typed). Renders nothing for low-risk topics — only escalates on finance/health/legal/tax/etc.
  const disclosureLevel = useMemo(() => {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    return levelFromText(lastUser?.content ?? composer);
  }, [messages, composer]);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadConversations = useCallback(async () => {
    setLoadingConversations(true);
    try {
      const res = await fetch('/api/conversations', { cache: 'no-store' });
      if (!res.ok) throw new Error(`http ${res.status}`);
      const json = (await res.json()) as { conversations: ConversationSummary[] };
      setConversations(json.conversations ?? []);
    } catch {
      setConversations([]);
    } finally {
      setLoadingConversations(false);
    }
  }, []);

  const loadMessages = useCallback(async (id: string) => {
    setLoadingMessages(true);
    setMessages([]);
    try {
      const res = await fetch(`/api/conversations/${id}`, { cache: 'no-store' });
      if (!res.ok) {
        setMessages([]);
        return;
      }
      const json = (await res.json()) as { messages: Message[] };
      setMessages(json.messages ?? []);
    } catch {
      setMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (activeId) {
      void loadMessages(activeId);
    } else {
      setMessages([]);
    }
  }, [activeId, loadMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const newChat = useCallback(() => {
    router.push('/dashboard/chat');
    setMessages([]);
    setError(null);
    composerRef.current?.focus();
  }, [router]);

  const send = useCallback(async () => {
    const text = composer.trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);

    // Optimistic add of the user message so the UI stays snappy.
    const optimisticId = `tmp-${Date.now()}`;
    setMessages((m) => [
      ...m,
      { id: optimisticId, role: 'user', content: text, created_at: new Date().toISOString() },
    ]);
    setComposer('');

    try {
      const res = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          conversation_id: activeId ?? undefined,
        }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || `http ${res.status}`);
      }
      const json = await res.json();
      const assistantText: string = json.message ?? '';
      const newId: string | undefined = json.conversation_id || json.data?.conversation_id;
      setMessages((m) => [
        ...m,
        {
          id: `as-${Date.now()}`,
          role: 'assistant',
          content: assistantText,
          created_at: new Date().toISOString(),
        },
      ]);

      // Navigate to ?id=<newId> on first turn so refresh + back buttons work.
      if (newId && !activeId) {
        router.replace(`/dashboard/chat?id=${newId}`);
        // Refresh the sidebar list so the new conversation shows.
        void loadConversations();
      } else if (newId === activeId) {
        // Update last_message_at in the list.
        void loadConversations();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'send failed');
      // Roll back the optimistic message on hard failure.
      setMessages((m) => m.filter((x) => x.id !== optimisticId));
    } finally {
      setSending(false);
      composerRef.current?.focus();
    }
  }, [composer, sending, activeId, router, loadConversations]);

  const onComposerKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  const headerTitle = useMemo(() => {
    if (!activeId) return 'New conversation';
    const c = conversations.find((x) => x.id === activeId);
    return c?.title ?? 'Conversation';
  }, [activeId, conversations]);

  return (
    <div className="flex h-[calc(100vh-64px)] w-full bg-white dark:bg-gray-900">
      {/* Left: conversation list */}
      <aside className="w-80 border-r border-gray-200 dark:border-gray-800 flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-gray-800">
          <button
            type="button"
            onClick={newChat}
            className="w-full inline-flex items-center justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            + New chat
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {loadingConversations ? (
            <div className="p-3 text-sm text-gray-500">Loading…</div>
          ) : conversations.length === 0 ? (
            <div className="p-3 text-sm text-gray-500">
              No conversations yet. Start one — your advisor will help with anything.
            </div>
          ) : (
            conversations.map((c) => {
              const isActive = c.id === activeId;
              const title = c.title || 'Untitled conversation';
              const when = new Date(c.last_message_at).toLocaleString(undefined, {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              });
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => router.push(`/dashboard/chat?id=${c.id}`)}
                  className={[
                    'w-full text-left rounded-md px-3 py-2',
                    isActive
                      ? 'bg-blue-50 dark:bg-blue-950/40 ring-1 ring-blue-300 dark:ring-blue-800'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-800',
                  ].join(' ')}
                >
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {title}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{when}</div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* Right: active conversation panel */}
      <section className="flex-1 flex flex-col">
        <header className="px-6 py-4 border-b border-gray-200 dark:border-gray-800">
          <h1 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            {headerTitle}
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Governed advisor — every reply passes through the constitutional + character gate.
          </p>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {loadingMessages ? (
            <div className="text-sm text-gray-500">Loading conversation…</div>
          ) : messages.length === 0 ? (
            <div className="max-w-2xl mx-auto mt-12 text-center text-gray-500 dark:text-gray-400">
              <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                What can I help you think through?
              </h2>
              <p className="mt-2 text-sm">
                A goal, a tradeoff, a decision, a worry. Anything. I'll surface what matters and
                we'll work it through together.
              </p>
            </div>
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                className={[
                  'max-w-3xl rounded-lg px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap',
                  m.role === 'user'
                    ? 'ml-auto bg-blue-600 text-white'
                    : 'mr-auto bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100',
                ].join(' ')}
              >
                {m.content}
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {error && (
          <div className="px-6 py-2 text-sm text-red-700 bg-red-50 dark:bg-red-950/40 border-t border-red-200 dark:border-red-900">
            {error}
          </div>
        )}

        <div className="border-t border-gray-200 dark:border-gray-800 px-6 py-4">
          <div className="flex items-end gap-2">
            <textarea
              ref={composerRef}
              value={composer}
              onChange={(e) => setComposer(e.target.value)}
              onKeyDown={onComposerKey}
              rows={2}
              placeholder="Ask anything…"
              className="flex-1 resize-none rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              disabled={sending}
            />
            <button
              type="button"
              onClick={() => void send()}
              disabled={sending || !composer.trim()}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {sending ? 'Thinking…' : 'Send'}
            </button>
          </div>
          <p className="mt-2 text-xs text-gray-500">Enter to send · Shift+Enter for newline</p>
          <AdviceDisclaimer level={disclosureLevel} className="mt-2" />
        </div>
      </section>
    </div>
  );
}
