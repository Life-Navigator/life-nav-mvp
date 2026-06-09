'use client';

// Life Discovery (Sprint 33) — onboarding that discovers the NEED BEHIND THE NEED. Capture a life
// vision, then a surface goal + a short why-chain; the engine resolves the ROOT objective and shows
// its cross-domain dependencies — the "wow": your house is a dependency of building family stability.

import Link from 'next/link';
import React, { useState } from 'react';

interface Discovered {
  root_objective: string;
  root_label: string;
  surface_goal: string;
  the_need_behind_the_need: string;
  dependencies: { label: string; domain: string }[];
  risks: string[];
  opportunities: string[];
}

const WHYS = [
  'Why does that matter to you?',
  'And why is that important?',
  'What does that ultimately give you?',
];

export default function DiscoverPage() {
  const [vision, setVision] = useState('');
  const [visionSaved, setVisionSaved] = useState(false);
  const [surface, setSurface] = useState('');
  const [whys, setWhys] = useState<string[]>(['', '', '']);
  const [result, setResult] = useState<Discovered | null>(null);
  const [busy, setBusy] = useState(false);

  const saveVision = async () => {
    if (!vision.trim()) return;
    await fetch('/api/life/vision', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vision_text: vision }),
    }).catch(() => {});
    setVisionSaved(true);
  };

  const discover = async () => {
    if (!surface.trim()) return;
    setBusy(true);
    const why_chain = whys.filter((w) => w.trim()).map((a, i) => ({ q: WHYS[i], a }));
    const r = await fetch('/api/life/goal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ surface_goal: surface, why_chain }),
    })
      .then((x) => (x.ok ? x.json() : null))
      .catch(() => null);
    setResult(r);
    setBusy(false);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900">
        Let&apos;s discover what you&apos;re really trying to achieve
      </h1>
      <p className="text-sm text-gray-500 mt-1">
        Most tools capture <i>what</i> you want. LifeNavigator discovers <i>why</i> — the objective
        behind the goal — so every recommendation actually serves your life.
      </p>

      {/* Vision */}
      <section className="mt-6 bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <label className="font-semibold text-gray-900">
          What would a successful life look like for you over the next 3–5 years?
        </label>
        <textarea
          value={vision}
          onChange={(e) => setVision(e.target.value)}
          rows={3}
          className="mt-2 w-full rounded-md border border-gray-200 p-3 text-sm"
          placeholder="In your own words…"
        />
        <button
          onClick={saveVision}
          className="mt-2 text-sm px-3 py-1.5 rounded-md bg-gray-900 text-white"
        >
          {visionSaved ? 'Saved ✓' : 'Save my vision'}
        </button>
      </section>

      {/* Goal + why-chain */}
      <section className="mt-4 bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <label className="font-semibold text-gray-900">
          What&apos;s one big thing you&apos;re trying to do?
        </label>
        <input
          value={surface}
          onChange={(e) => setSurface(e.target.value)}
          className="mt-2 w-full rounded-md border border-gray-200 p-2.5 text-sm"
          placeholder="e.g. Buy a house"
        />
        {surface.trim() && (
          <div className="mt-3 space-y-2">
            {WHYS.map((q, i) => (
              <div key={i}>
                <div className="text-xs text-gray-500">{q}</div>
                <input
                  value={whys[i]}
                  onChange={(e) => setWhys((w) => w.map((x, j) => (j === i ? e.target.value : x)))}
                  className="mt-1 w-full rounded-md border border-gray-200 p-2 text-sm"
                />
              </div>
            ))}
          </div>
        )}
        <button
          onClick={discover}
          disabled={busy || !surface.trim()}
          className="mt-3 text-sm px-4 py-2 rounded-md bg-indigo-600 text-white font-medium disabled:opacity-40"
        >
          {busy ? 'Discovering…' : 'Discover what I really need'}
        </button>
      </section>

      {/* The reveal */}
      {result && (
        <section className="mt-4 bg-indigo-50 rounded-xl border-2 border-indigo-200 p-5">
          <div className="text-[11px] uppercase tracking-wide text-indigo-500 font-semibold">
            The need behind the need
          </div>
          <div className="text-sm text-gray-600 mt-1">
            You said you want to <b>{result.surface_goal}</b> — but your real objective is:
          </div>
          <div className="text-xl font-bold text-gray-900 mt-1">{result.root_label}</div>
          <div className="text-sm text-gray-600 mt-1">
            That goal is one <b>dependency</b> of this objective. Here&apos;s everything it depends
            on:
          </div>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {result.dependencies.map((d) => (
              <div
                key={d.label}
                className="bg-white rounded-md border border-gray-100 px-3 py-2 text-sm"
              >
                <span className="text-gray-800">{d.label}</span>
                <span className="text-[10px] uppercase text-gray-400 ml-1">{d.domain}</span>
              </div>
            ))}
          </div>
          {result.risks.length > 0 && (
            <div className="mt-3 text-sm">
              <b className="text-rose-700">Risks:</b>{' '}
              <span className="text-gray-700">{result.risks.join(' · ')}</span>
            </div>
          )}
          {result.opportunities.length > 0 && (
            <div className="mt-1 text-sm">
              <b className="text-emerald-700">Opportunities:</b>{' '}
              <span className="text-gray-700">{result.opportunities.join(' · ')}</span>
            </div>
          )}
          <div className="mt-4 flex gap-2">
            <Link
              href="/dashboard/recommendations"
              className="text-sm px-4 py-2 rounded-md bg-indigo-600 text-white font-medium"
            >
              See my roadmap →
            </Link>
            <Link
              href="/dashboard"
              className="text-sm px-4 py-2 rounded-md border border-indigo-200 text-indigo-700"
            >
              Go to dashboard
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
