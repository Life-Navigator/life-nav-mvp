'use client';

// Explicit beta-persona selection (P0.1): the user must CHOOSE a persona card, then CONFIRM the
// sandbox data, before the advisor starts. No auto-selection, no silent activation.

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
  profession: string;
  risk_profile: string;
  income_type: string;
  asset_profile: string;
  liability_profile: string;
  investment_profile: string;
}

const COMPLEXITY_LABEL: Record<string, string> = {
  simple: 'Simple',
  moderate: 'Moderate',
  complex: 'Complex',
};

export default function SampleFinancialProfile() {
  const router = useRouter();
  const [personas, setPersonas] = useState<PublicPersona[]>([]);
  const [selectedId, setSelectedId] = useState<string>(''); // empty = nothing chosen yet
  const [step, setStep] = useState<'select' | 'confirm'>('select');
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
        // NOTE: do NOT pre-select — the user must explicitly choose (P0.1).
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
      router.push('/dashboard/advisor?onboarding=1');
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setActivating(false);
    }
  }

  if (loading) {
    return <p className="mx-auto max-w-3xl mt-8 text-white/45">Loading sample profiles…</p>;
  }

  // ---- Step 2: confirm sandbox data ----
  if (step === 'confirm' && selected) {
    return (
      <div className="mx-auto max-w-xl">
        <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.18em] text-[#5eead4]">
          <span className="h-1 w-1 rounded-full bg-[#2dd4bf]" /> Step 2 of 2 · Confirm
        </div>
        <h1 className="mt-3 font-display text-3xl font-medium tracking-tight sm:text-4xl">
          You selected {selected.display_name}
        </h1>
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5 space-y-3">
          <Row label="Profession" value={selected.profession} />
          <Row label="Income" value={selected.income_type} />
          <Row label="Assets" value={selected.asset_profile} />
          <Row label="Liabilities" value={selected.liability_profile} />
          <Row label="Investments / Retirement" value={selected.investment_profile} />
          <Row label="Risk profile" value={selected.risk_profile} />
        </div>
        <div className="mt-5 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] p-4 text-sm text-amber-100/90">
          This is <b>Plaid sandbox data</b> used for beta testing. It is <b>not</b> your real
          financial account — it lets you explore the full system safely.
        </div>
        {error && (
          <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">
            {error}
          </div>
        )}
        <div className="mt-6 flex flex-col gap-2">
          <button
            type="button"
            onClick={activate}
            disabled={activating}
            className="btn-primary inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-70"
          >
            <Mark className="h-4 w-4" size={16} />
            {activating ? 'Preparing your profile…' : 'Start Advisor Onboarding'}
          </button>
          <button
            type="button"
            onClick={() => {
              setStep('select');
              setSelectedId('');
            }}
            disabled={activating}
            className="text-xs text-white/45 underline hover:text-white/70 disabled:opacity-50"
          >
            Choose a different profile
          </button>
        </div>
      </div>
    );
  }

  // ---- Step 1: choose a persona ----
  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.18em] text-[#5eead4]">
        <span className="h-1 w-1 rounded-full bg-[#2dd4bf]" /> Step 1 of 2 · Choose a beta profile
      </div>
      <h1 className="mt-3 font-display text-3xl font-medium tracking-tight sm:text-4xl">
        Choose a sample financial profile
      </h1>
      <p className="mt-3 text-white/55">
        Pick a persona to explore the full system safely — real reasoning, grounded in Plaid sandbox
        data. No real bank credentials are used.
      </p>

      {error && (
        <div className="mt-6 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">
          {error}
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {personas.map((p) => (
          <button
            key={p.persona_id}
            type="button"
            onClick={() => {
              setSelectedId(p.persona_id);
              setStep('confirm');
            }}
            className="text-left rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-[#2dd4bf]/40 hover:bg-white/[0.05]"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-white">{p.display_name}</h2>
              <span className="rounded-full border border-[#2dd4bf]/25 bg-[#2dd4bf]/10 px-2.5 py-0.5 text-xs font-medium text-[#5eead4]">
                {COMPLEXITY_LABEL[p.complexity] ?? p.complexity}
              </span>
            </div>
            <p className="mt-2 text-sm text-white/55">{p.description}</p>
            <dl className="mt-3 space-y-1 text-xs text-white/55">
              <CardLine label="Income" value={p.income_type} />
              <CardLine label="Assets" value={p.asset_profile} />
              <CardLine label="Liabilities" value={p.liability_profile} />
              <CardLine label="Investments" value={p.investment_profile} />
            </dl>
            <span className="mt-3 inline-block text-xs font-medium text-[#5eead4]">Select →</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-xs uppercase tracking-wide text-white/40">{label}</span>
      <span className="text-sm text-white/80 text-right">{value}</span>
    </div>
  );
}
function CardLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-white/40">{label}</dt>
      <dd className="text-white/65 text-right">{value}</dd>
    </div>
  );
}
