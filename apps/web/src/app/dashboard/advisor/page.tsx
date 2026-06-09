'use client';

// Advisor (Sprint 41) — the Relationship Manager IS the chat. The advisor asks discovery questions;
// each answer writes to the canonical life model in real time and shows what the platform just
// learned (✓ chips). A live context panel always reflects the current life model. This is onboarding
// that feels like talking to an advisor, not filling a form.

import Link from 'next/link';
import React, { useEffect, useRef, useState } from 'react';

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
  const [progress, setProgress] = useState<{ answered: number; total: number } | null>(null);
  const [complete, setComplete] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  const apply = (t: Turn | null) => {
    if (!t) return;
    setMsgs((m) => [
      ...m,
      { role: 'advisor', text: t.assistant_message, updates: t.updates, reveal: t.reveal },
    ]);
    setPending(t.pending_key);
    setOptions(t.options ?? null);
    setPanel(t.context_panel || {});
    setProgress(t.progress ?? null);
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

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Conversation */}
      <div className="lg:col-span-2 flex flex-col">
        <h1 className="text-xl font-bold text-gray-900">Your Advisor</h1>
        {progress && !complete && (
          <div className="mt-1 text-xs text-gray-500">
            Getting to know you — {progress.answered}/{progress.total} answered
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
                    The real objective:{' '}
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
        {complete ? (
          <div className="mt-3 rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-800">
            Your life model is built.{' '}
            <Link href="/dashboard" className="font-semibold underline">
              See your dashboard →
            </Link>
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
          </div>
        )}
      </div>

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
