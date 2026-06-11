'use client';

// Generic Family entity CRUD (add / list / delete) against /api/family/[entity] (family schema, RLS).
// Config-driven so emergency-contacts / beneficiaries / trusted-advisors share one component.
import { useEffect, useState } from 'react';

export interface FieldDef {
  name: string;
  label: string;
  type?: 'text' | 'number' | 'select';
  options?: string[];
  required?: boolean;
}

interface Row {
  id: string;
  [k: string]: unknown;
}

export default function FamilyEntityCrud({
  slug,
  title,
  fields,
  summarize,
  legal,
}: {
  slug: string;
  title: string;
  fields: FieldDef[];
  summarize: (row: Row) => string;
  legal?: boolean;
}) {
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    try {
      const r = await fetch(`/api/family/${slug}`, { cache: 'no-store' });
      if (!r.ok) throw new Error();
      const d = await r.json();
      setItems(d.items ?? []);
    } catch {
      setErr('We could not load this list just now.');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, [slug]); // eslint-disable-line react-hooks/exhaustive-deps

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(`/api/family/${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!r.ok) throw new Error();
      setForm({});
      await load();
    } catch {
      setErr('We could not save that — please check the fields and try again.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    setErr(null);
    try {
      const r = await fetch(`/api/family/${slug}/${id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error();
      setItems((cur) => cur.filter((x) => x.id !== id));
    } catch {
      setErr('We could not remove that — please try again.');
    }
  };

  return (
    <div className="space-y-5 p-6">
      <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{title}</h2>
      {err && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
          {err}
        </div>
      )}

      <form
        onSubmit={add}
        className="flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"
      >
        {fields.map((f) => (
          <label key={f.name} className="text-sm">
            <span className="mb-1 block text-xs font-medium text-gray-500">
              {f.label}
              {f.required ? ' *' : ''}
            </span>
            {f.type === 'select' ? (
              <select
                value={form[f.name] ?? ''}
                onChange={(e) => setForm((s) => ({ ...s, [f.name]: e.target.value }))}
                className="rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900"
              >
                <option value="">—</option>
                {(f.options ?? []).map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type={f.type === 'number' ? 'number' : 'text'}
                required={f.required}
                value={form[f.name] ?? ''}
                onChange={(e) => setForm((s) => ({ ...s, [f.name]: e.target.value }))}
                className="w-40 rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900"
              />
            )}
          </label>
        ))}
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {busy ? 'Adding…' : 'Add'}
        </button>
      </form>

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-500">
          Nothing added yet. Use the form above to add your first entry.
        </p>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white dark:divide-gray-700 dark:border-gray-700 dark:bg-gray-800">
          {items.map((row) => (
            <li key={row.id} className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-gray-800 dark:text-gray-200">{summarize(row)}</span>
              <button
                onClick={() => remove(row.id)}
                className="text-sm text-red-600 hover:underline dark:text-red-400"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      {legal && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          LifeNavigator is not a law firm and does not provide legal advice. Estate planning
          decisions should be reviewed with a qualified attorney.
        </p>
      )}
    </div>
  );
}
