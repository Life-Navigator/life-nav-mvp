'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

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
    } catch (e) {
      setError((e as Error).message);
      setActivating(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl p-6">
      <h1 className="text-2xl font-semibold text-gray-900">Choose a sample financial profile</h1>
      <p className="mt-2 text-gray-600">
        Use a sample financial profile to explore LifeNavigator without connecting real accounts.
      </p>

      {loading ? (
        <p className="mt-6 text-gray-500">Loading sample profiles…</p>
      ) : (
        <div className="mt-6 space-y-5">
          <div>
            <label htmlFor="persona" className="block text-sm font-medium text-gray-700">
              Sample profile
            </label>
            <select
              id="persona"
              className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              disabled={activating}
            >
              {personas.map((p) => (
                <option key={p.persona_id} value={p.persona_id}>
                  {p.display_name}
                </option>
              ))}
            </select>
          </div>

          {selected && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-medium text-gray-900">{selected.display_name}</h2>
                <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-800">
                  {COMPLEXITY_LABEL[selected.complexity] ?? selected.complexity}
                </span>
              </div>
              <p className="mt-2 text-sm text-gray-600">{selected.description}</p>
              {selected.goals?.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    What you can explore
                  </p>
                  <ul className="mt-1 flex flex-wrap gap-2">
                    {selected.goals.map((g) => (
                      <li
                        key={g}
                        className="rounded-full bg-white px-2.5 py-1 text-xs text-gray-700 ring-1 ring-gray-200"
                      >
                        {g}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <p className="text-xs text-gray-500">
            No real bank credentials are used during this beta experience.
          </p>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="button"
            onClick={activate}
            disabled={activating || !selectedId}
            className="w-full rounded-md bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {activating ? 'Activating financial profile…' : 'Activate Financial Profile'}
          </button>
        </div>
      )}
    </div>
  );
}
