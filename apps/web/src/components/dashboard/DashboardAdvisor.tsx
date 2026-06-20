'use client';

/**
 * DashboardAdvisor — the user's ONGOING advisor after onboarding is complete (mode="advisor").
 *
 * This is deliberately separate from the onboarding/discovery flow (OnboardingAdvisor in
 * dashboard/advisor/page.tsx). It talks to /api/life/advisor/chat (the grounded fact-packet + citation
 * pipeline) via the shared useAdvisorChat hook — the SAME engine the floating chat uses — and never
 * shows onboarding copy like "That's everything I need to start". Users ask general advice questions:
 * goals, readiness, career, education, finances, documents, scenarios, reports, next best action.
 */

import { useRef, useEffect, useState } from 'react';
import StreamingText from '@/components/ui/StreamingText';
import AdviceDisclaimer from '@/components/advice/AdviceDisclaimer';
import { levelFromText } from '@/lib/advice/disclosure';
import { useAdvisorChat } from '@/components/chat/useAdvisorChat';
import { ADVISOR_WELCOME } from '@/lib/chat/advisor';

const STARTERS = [
  'What should I work on next?',
  'What do you know about my career?',
  'Why did my readiness change?',
  'What information are you missing?',
];

export default function DashboardAdvisor() {
  const { messages, loading, error, send } = useAdvisorChat({ welcome: ADVISOR_WELCOME });
  const [input, setInput] = useState('');
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const submit = (text: string) => {
    if (!text.trim() || loading) return;
    setInput('');
    void send(text);
  };

  // Advice disclosure tier from the most recent user message (escalates only on finance/health/legal/etc).
  const lastUser = [...messages].reverse().find((m) => m.role === 'user');
  const disclosureLevel = levelFromText(lastUser?.text ?? input);

  return (
    <div className="flex h-full w-full flex-col bg-gray-50">
      <div className="mx-auto flex h-full w-full max-w-4xl flex-col px-4 py-4">
        <div className="shrink-0">
          <h1 className="text-xl font-bold text-gray-900">Your Advisor</h1>
          <p className="mt-0.5 text-xs text-gray-500">
            Ask about your goals, readiness, career, education, finances, documents, scenarios, or
            next best action.
          </p>
        </div>

        <div
          data-testid="advisor-scroll"
          className="mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1"
        >
          {messages.map((m, i) => (
            <div key={i} className={m.role === 'user' ? 'text-right' : ''}>
              <div
                className={`inline-block max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm ${
                  m.role === 'advisor' ? 'bg-indigo-50 text-gray-800' : 'bg-gray-900 text-white'
                }`}
              >
                {m.role === 'advisor' ? (
                  <StreamingText text={m.text} animate={i === messages.length - 1} />
                ) : (
                  m.text
                )}
              </div>
            </div>
          ))}

          {/* First-turn starter prompts — only before the user has said anything. */}
          {messages.filter((m) => m.role === 'user').length === 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {STARTERS.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={loading}
                  onClick={() => submit(s)}
                  className="rounded-full border border-indigo-200 px-3 py-1.5 text-sm text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {loading && (
            <div className="text-xs text-gray-500" data-testid="advisor-loading">
              Your advisor is thinking…
            </div>
          )}
          {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
              {error}
            </div>
          )}
          <div ref={endRef} />
        </div>

        <AdviceDisclaimer level={disclosureLevel} className="mt-2" />

        <div className="shrink-0 border-t border-gray-200 bg-gray-50 pt-3">
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
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  submit(input);
                }
              }}
              rows={1}
              placeholder="Ask your advisor anything…  (Enter to send · Shift+Enter for a new line)"
              className="max-h-32 flex-1 resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="shrink-0 self-end rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:bg-gray-300 disabled:text-gray-500"
            >
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
