'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mark } from '@/components/brand/Logo';

interface PublicPersona {
  persona_id: string;
  display_name: string;
  description: string;
  goals: string[];
  complexity: 'simple' | 'moderate' | 'complex';
  life_stage: string;
}

const COMPLEXITY_LABEL: Record<string, string> = {
  simple: 'Simple',
  moderate: 'Moderate',
  complex: 'Complex',
};

export default function SampleFinancialProfile() {
  const router = useRouter();
  const [personas, setPersonas] = useState<PublicPersona[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/integrations/plaid/personas');
        if (!res.ok) throw new Error('Could not load sample profiles.');
        const data = await res.json();
        if (!active) return;
        setPersonas(data.personas || []);
        if (data.personas?.length) setSelectedId(data.personas[0].persona_id);
      } catch (e) {
        if (active) setError((e as Error).message);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const selected = personas.find((p) => p.persona_id === selectedId);

  async function activate() {
    if (!selectedId) return;
    setActivating(true);
    setError(null);
    try {
      const res = await fetch('/api/integrations/plaid/activate-persona', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ persona_id: selectedId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Activation failed. Please try again.');
      router.push('/dashboard');
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setActivating(false);
    }
  }

  const inputClass =
    'w-full rounded-xl border border-white/12 bg-white/[0.03] px-4 py-3 text-white outline-none transition focus:border-[#2dd4bf]/50 focus:ring-2 focus:ring-[#2dd4bf]/25 disabled:opacity-60';

  return (
    <div className="mx-auto max-w-xl">
      <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.18em] text-[#5eead4]">
        <span className="h-1 w-1 rounded-full bg-[#2dd4bf]" /> Step 1 of 1 · Almost there
      </div>
      <h1 className="mt-3 font-display text-3xl font-medium tracking-tight sm:text-4xl">
        Your account is ready
      </h1>
      <p className="mt-3 text-white/55">
        Pick a sample financial profile to explore the full system safely — no real bank
        credentials, just real reasoning grounded in the data.
      </p>

      {activating && (
        <div className="mt-6 flex items-center gap-3 rounded-xl border border-[#2dd4bf]/20 bg-[#2dd4bf]/[0.06] p-3 text-sm text-[#a7f3e4]">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/15 border-t-[#2dd4bf]" />
          Preparing your profile…
        </div>
      )}

      {loading ? (
        <p className="mt-8 text-white/45">Loading sample profiles…</p>
      ) : (
        <div className="mt-8 space-y-5">
          <div>
            <label htmlFor="persona" className="mb-1.5 block text-sm font-medium text-white/70">
              Sample profile
            </label>
            <select
              id="persona"
              className={inputClass}
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              disabled={activating}
            >
              {personas.map((p) => (
                <option key={p.persona_id} value={p.persona_id} className="bg-[#0b0b0f]">
                  {p.display_name}
                </option>
              ))}
            </select>
          </div>

          {selected && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-medium text-white">{selected.display_name}</h2>
                <span className="rounded-full border border-[#2dd4bf]/25 bg-[#2dd4bf]/10 px-2.5 py-0.5 text-xs font-medium text-[#5eead4]">
                  {COMPLEXITY_LABEL[selected.complexity] ?? selected.complexity}
                </span>
              </div>
              <p className="mt-2 text-sm text-white/55">{selected.description}</p>
              {selected.goals?.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-white/40">
                    What you can explore
                  </p>
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {selected.goals.map((g) => (
                      <li
                        key={g}
                        className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-white/70"
                      >
                        {g}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <p className="text-xs text-white/40">
            No real bank credentials are used during this beta experience.
          </p>

          {error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={activate}
            disabled={activating || !selectedId}
            className="btn-primary inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-70"
          >
            <Mark className="h-4 w-4" size={16} />
            {activating ? 'Preparing your profile…' : 'Activate & enter LifeNavigator'}
          </button>
        </div>
      )}
    </div>
  );
}
