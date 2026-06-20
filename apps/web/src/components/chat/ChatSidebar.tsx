'use client';

import { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAdvisorChat } from '@/components/chat/useAdvisorChat';
import { ADVISOR_WELCOME, ADVISOR_INCOMPLETE_ONBOARDING } from '@/lib/chat/advisor';

// Floating Advisor — the global chat launcher in the bottom-right of the portal. It is the SAME advisor
// as the dashboard Advisor: it talks to advisor mode (/api/life/advisor/chat) via the shared
// useAdvisorChat hook. Previously this was a dead shell — it gated all sending on an `agentId` loaded
// from a legacy external agent backend (NEXT_PUBLIC_AGENT_API_URL) that is unset in prod, so the send
// button was permanently disabled. That dependency is gone; the chat works on its own.

interface ChatSidebarProps {
  context?: string; // Optional context about the current page
}

export default function ChatSidebar({ context }: ChatSidebarProps) {
  // During advisor onboarding the page IS the advisor (one conversation) — hide this second assistant
  // on that route so the user never sees two advisors at once.
  const pathname = usePathname();
  const hiddenForOnboarding = pathname === '/dashboard/advisor';

  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  // null = unknown (optimistic: allow chat), true/false once /api/onboarding/status resolves.
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { messages, loading, error, send } = useAdvisorChat({ welcome: ADVISOR_WELCOME });

  // Resolve onboarding completion so an unfinished user gets a clear "finish setup" state instead of
  // advice grounded in an empty profile. Unknown/failed → optimistic (chat stays usable).
  useEffect(() => {
    let cancelled = false;
    fetch('/api/onboarding/status', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d) setOnboardingComplete(!!d.onboarding_completed);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Open (and optionally pre-fill) when another surface — e.g. the First Insight
  // "Ask your advisor about this" button — requests the governed advisor.
  useEffect(() => {
    const onOpen = (e: Event) => {
      setIsOpen(true);
      const prefill = (e as CustomEvent).detail?.prefill;
      if (typeof prefill === 'string' && prefill) setInput(prefill);
    };
    window.addEventListener('lifenav:open-advisor', onOpen);
    return () => window.removeEventListener('lifenav:open-advisor', onOpen);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const inputDisabled = loading || onboardingComplete === false;

  const handleSend = (preset?: string) => {
    const text = (typeof preset === 'string' ? preset : input).trim();
    if (!text || inputDisabled) return;
    setInput('');
    void send(text);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Hidden during advisor onboarding (the advisor is the only conversation there).
  if (hiddenForOnboarding) return null;

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-40 p-4 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white rounded-full shadow-lg transition-all transform hover:scale-110"
        aria-label="Toggle Advisor"
      >
        {isOpen ? (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
            />
          </svg>
        )}
      </button>

      {/* Chat Sidebar */}
      <div
        className={`fixed top-0 right-0 h-full w-96 bg-white dark:bg-gray-800 shadow-2xl transform transition-transform duration-300 ease-in-out z-50 border-l border-gray-200 dark:border-gray-700 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-500 dark:to-blue-600">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
              <h2 className="text-lg font-semibold text-white">Your Advisor</h2>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-white hover:text-gray-200 transition-colors"
              aria-label="Close chat"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Context Info */}
          {context && (
            <div className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800">
              <p className="text-xs text-blue-800 dark:text-blue-300">💡 Context: {context}</p>
            </div>
          )}

          {/* Onboarding-incomplete state — a clear STATE message, not a dead shell, never the
              "that's everything I need to start" onboarding loop. */}
          {onboardingComplete === false && (
            <div className="px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800">
              <p className="text-xs text-amber-800 dark:text-amber-300">
                {ADVISOR_INCOMPLETE_ONBOARDING}
              </p>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message, i) => (
              <div
                key={i}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-2 ${
                    message.role === 'user'
                      ? 'bg-blue-600 dark:bg-blue-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.text}</p>
                </div>
              </div>
            ))}

            {/* Starter prompts before the first user turn (advisor mode only). */}
            {onboardingComplete !== false &&
              messages.filter((m) => m.role === 'user').length === 0 && (
                <div className="flex flex-col gap-2">
                  {[
                    'What should I work on next?',
                    'What do you know about my career?',
                    'What information are you missing?',
                  ].map((starter) => (
                    <button
                      key={starter}
                      type="button"
                      onClick={() => handleSend(starter)}
                      disabled={inputDisabled}
                      className="text-left rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:border-gray-400 dark:hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 transition disabled:opacity-50"
                    >
                      {starter}
                    </button>
                  ))}
                </div>
              )}

            {loading && (
              <div className="flex justify-start" data-testid="advisor-loading">
                <div className="bg-gray-100 dark:bg-gray-700 rounded-lg px-4 py-2">
                  <div className="flex space-x-2">
                    <div className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce"></div>
                    <div
                      className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce"
                      style={{ animationDelay: '0.2s' }}
                    ></div>
                    <div
                      className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce"
                      style={{ animationDelay: '0.4s' }}
                    ></div>
                  </div>
                </div>
              </div>
            )}
            {error && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 dark:bg-rose-950/40 px-4 py-2 text-sm text-rose-700 dark:text-rose-300">
                {error}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
            <div className="flex items-end space-x-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder={
                  onboardingComplete === false ? 'Finish setup to chat…' : 'Ask your advisor…'
                }
                rows={1}
                className="flex-1 resize-none rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 disabled:opacity-50"
                disabled={inputDisabled}
              />
              <button
                onClick={() => handleSend()}
                disabled={!input.trim() || inputDisabled}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Send message"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                  />
                </svg>
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Press Enter to send, Shift+Enter for new line
            </p>
            <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">
              General information, not financial, tax, or legal advice.
            </p>
          </div>
        </div>
      </div>

      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 dark:bg-black/50 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
