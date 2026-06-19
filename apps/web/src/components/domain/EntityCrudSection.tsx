'use client';

import { useCallback, useEffect, useState } from 'react';
import { PlusIcon, TrashIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { SchoolLogo } from '@/components/ui/SchoolLogo';
import { SchoolPicker, type SchoolOption } from '@/components/ui/SchoolPicker';

export type FieldType = 'text' | 'textarea' | 'number' | 'date' | 'checkbox' | 'select' | 'school';

export interface FieldDef {
  name: string;
  label: string;
  type?: FieldType;
  placeholder?: string;
  options?: { value: string; label: string }[];
  schoolType?: string;
  // For type 'school': which payload fields receive the picked name/domain/logo.
  mapTo?: { name: string; domain?: string; logo?: string };
  half?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Item = Record<string, any>;

export interface DisplayConfig {
  title: (item: Item) => string;
  subtitle?: (item: Item) => string | undefined;
  logoName?: (item: Item) => string;
  logoUrl?: (item: Item) => string | undefined;
  meta?: (item: Item) => (string | undefined)[];
  badge?: (
    item: Item
  ) => { label: string; tone?: 'green' | 'blue' | 'amber' | 'slate' } | undefined;
}

const toneClass: Record<string, string> = {
  green: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  slate: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
};

export function EntityCrudSection({
  apiBase,
  slug,
  title,
  description,
  icon,
  fields,
  display,
  emptyHint,
}: {
  apiBase: string; // '/api/career' | '/api/education'
  slug: string;
  title: string;
  description?: string;
  icon?: React.ReactNode;
  fields: FieldDef[];
  display: DisplayConfig;
  emptyHint?: string;
}) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Item>({});
  const [school, setSchool] = useState<SchoolOption | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${apiBase}/${slug}`);
      if (res.ok) {
        const d = await res.json();
        setItems(d.items || []);
      } else {
        setItems([]);
      }
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [apiBase, slug]);

  useEffect(() => {
    load();
  }, [load]);

  const reset = () => {
    setForm({});
    setSchool(null);
    setError(null);
    setShowForm(false);
  };

  const submit = async () => {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`${apiBase}/${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => null);
        throw new Error(b?.message || b?.error || `HTTP ${res.status}`);
      }
      reset();
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    await fetch(`${apiBase}/${slug}/${id}`, { method: 'DELETE' });
    await load();
  };

  const onPickSchool = (f: FieldDef, s: SchoolOption | null) => {
    setSchool(s);
    setForm((prev) => {
      const next = { ...prev };
      if (f.mapTo) {
        next[f.mapTo.name] = s?.name ?? '';
        if (f.mapTo.domain) next[f.mapTo.domain] = s?.domain ?? '';
        if (f.mapTo.logo) next[f.mapTo.logo] = s?.logo_url ?? '';
      }
      return next;
    });
  };

  return (
    <section className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-100 dark:border-slate-700">
        <div className="flex items-center gap-3 min-w-0">
          {icon && (
            <span className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              {icon}
            </span>
          )}
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white truncate">
              {title}
              {items.length > 0 && (
                <span className="ml-2 text-sm font-normal text-slate-400">{items.length}</span>
              )}
            </h2>
            {description && (
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{description}</p>
            )}
          </div>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm px-3 py-1.5 transition-colors"
        >
          <PlusIcon className="w-4 h-4" /> Add
        </button>
      </div>

      {showForm && (
        <div className="px-5 py-4 bg-slate-50 dark:bg-slate-900/40 border-b border-slate-100 dark:border-slate-700">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {fields.map((f) => {
              const common =
                'w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-indigo-500';
              const wrap =
                f.half === false
                  ? 'sm:col-span-2'
                  : f.type === 'textarea' || f.type === 'school'
                    ? 'sm:col-span-2'
                    : '';
              return (
                <div key={f.name} className={wrap}>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                    {f.label}
                  </label>
                  {f.type === 'school' ? (
                    <SchoolPicker
                      value={school}
                      onChange={(s) => onPickSchool(f, s)}
                      type={f.schoolType}
                      placeholder={f.placeholder}
                    />
                  ) : f.type === 'textarea' ? (
                    <textarea
                      className={common}
                      rows={2}
                      placeholder={f.placeholder}
                      value={(form[f.name] as string) ?? ''}
                      onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                    />
                  ) : f.type === 'select' ? (
                    <select
                      className={common}
                      value={(form[f.name] as string) ?? ''}
                      onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                    >
                      <option value="">Select…</option>
                      {(f.options || []).map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  ) : f.type === 'checkbox' ? (
                    <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                      <input
                        type="checkbox"
                        className="rounded border-slate-300"
                        checked={!!form[f.name]}
                        onChange={(e) => setForm({ ...form, [f.name]: e.target.checked })}
                      />
                      {f.placeholder || 'Yes'}
                    </label>
                  ) : (
                    <input
                      className={common}
                      type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}
                      placeholder={f.placeholder}
                      value={(form[f.name] as string) ?? ''}
                      onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                    />
                  )}
                </div>
              );
            })}
          </div>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          <div className="mt-3 flex gap-2">
            <button
              onClick={submit}
              disabled={saving}
              className="rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm px-4 py-2"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={reset}
              className="rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm px-4 py-2 inline-flex items-center gap-1"
            >
              <XMarkIcon className="w-4 h-4" /> Cancel
            </button>
          </div>
        </div>
      )}

      <div className="divide-y divide-slate-100 dark:divide-slate-700">
        {loading ? (
          <div className="px-5 py-8 text-center text-sm text-slate-400">Loading…</div>
        ) : items.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-slate-400">
            {emptyHint || 'Nothing here yet — add your first entry.'}
          </div>
        ) : (
          items.map((item) => {
            const badge = display.badge?.(item);
            const meta = (display.meta?.(item) || []).filter(Boolean) as string[];
            return (
              <div key={item.id} className="flex items-start gap-3 px-5 py-3 group">
                {display.logoName && (
                  <SchoolLogo
                    name={display.logoName(item)}
                    logoUrl={display.logoUrl?.(item)}
                    size={40}
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-slate-900 dark:text-white truncate">
                      {display.title(item)}
                    </p>
                    {badge && (
                      <span
                        className={`text-[11px] px-2 py-0.5 rounded-full ${toneClass[badge.tone || 'slate']}`}
                      >
                        {badge.label}
                      </span>
                    )}
                  </div>
                  {display.subtitle?.(item) && (
                    <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
                      {display.subtitle(item)}
                    </p>
                  )}
                  {meta.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-400">
                      {meta.map((m, i) => (
                        <span key={i}>{m}</span>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => remove(item.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-red-500 shrink-0"
                  aria-label="Remove"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
