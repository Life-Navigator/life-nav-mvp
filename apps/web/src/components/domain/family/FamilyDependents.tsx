'use client';

// Family → Dependents: REAL CRUD (add / list / delete) against /api/family/dependents (family schema,
// RLS-isolated). No read-only shell. Persists across reload.
import { useEffect, useState } from 'react';

interface Dependent {
  id: string;
  relationship: string;
  birth_year: number | null;
}

const RELATIONSHIPS = ['child', 'spouse', 'partner', 'parent', 'other'];

export default function FamilyDependents() {
  const [items, setItems] = useState<Dependent[]>([]);
  const [loading, setLoading] = useState(true);
  const [relationship, setRelationship] = useState('child');
  const [birthYear, setBirthYear] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    try {
      const r = await fetch('/api/family/dependents', { cache: 'no-store' });
      if (!r.ok) throw new Error();
      const d = await r.json();
      setItems(d.dependents ?? []);
    } catch {
      setErr('We could not load your dependents just now.');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch('/api/family/dependents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ relationship, birth_year: birthYear ? Number(birthYear) : null }),
      });
      if (!r.ok) throw new Error();
      setBirthYear('');
      await load();
    } catch {
      setErr('We could not add that dependent — please try again.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    setErr(null);
    try {
      const r = await fetch(`/api/family/dependents/${id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error();
      setItems((cur) => cur.filter((x) => x.id !== id));
    } catch {
      setErr('We could not remove that dependent — please try again.');
    }
  };

  return (
    <div className="space-y-5 p-6">
      <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Dependents</h2>

      {err && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
          {err}
        </div>
      )}

      {/* Add form */}
      <form
        onSubmit={add}
        className="flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"
      >
        <label className="text-sm">
          <span className="mb-1 block text-xs font-medium text-gray-500">Relationship</span>
          <select
            value={relationship}
            onChange={(e) => setRelationship(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900"
          >
            {RELATIONSHIPS.map((r) => (
              <option key={r} value={r}>
                {r[0].toUpperCase() + r.slice(1)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs font-medium text-gray-500">
            Birth year (optional)
          </span>
          <input
            type="number"
            value={birthYear}
            onChange={(e) => setBirthYear(e.target.value)}
            placeholder="e.g. 2018"
            min={1900}
            max={2100}
            className="w-32 rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {busy ? 'Adding…' : 'Add dependent'}
        </button>
      </form>

      {/* List */}
      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-500">
          No dependents added yet. Add a child, partner, or parent you support — it powers
          protection-gap and college-funding analysis.
        </p>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white dark:divide-gray-700 dark:border-gray-700 dark:bg-gray-800">
          {items.map((d) => (
            <li key={d.id} className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-gray-800 dark:text-gray-200">
                {d.relationship[0].toUpperCase() + d.relationship.slice(1)}
                {d.birth_year ? ` · born ${d.birth_year}` : ''}
              </span>
              <button
                onClick={() => remove(d.id)}
                className="text-sm text-red-600 hover:underline dark:text-red-400"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
