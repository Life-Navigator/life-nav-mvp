'use client';

import { useEffect, useState } from 'react';
import {
  Combobox,
  ComboboxButton,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
} from '@headlessui/react';
import { ChevronUpDownIcon } from '@heroicons/react/24/outline';
import { SchoolLogo } from './SchoolLogo';

export interface SchoolOption {
  id?: string;
  name: string;
  domain?: string | null;
  logo_url?: string | null;
  type?: string | null;
  location?: string | null;
}

/**
 * Searchable school/issuer picker backed by /api/schools (the global catalog), with
 * logos. Free-text is fully supported: whatever the user types is a valid value even
 * if it isn't in the catalog (it just won't carry a logo). Calls onChange with the
 * selected/typed school so the parent can persist name + domain + logo_url.
 */
export function SchoolPicker({
  value,
  onChange,
  type,
  placeholder = 'Search schools or type your own…',
}: {
  value: SchoolOption | null;
  onChange: (school: SchoolOption | null) => void;
  type?: string;
  placeholder?: string;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SchoolOption[]>([]);

  useEffect(() => {
    let active = true;
    const t = setTimeout(async () => {
      try {
        const params = new URLSearchParams();
        if (query) params.set('q', query);
        if (type) params.set('type', type);
        const res = await fetch(`/api/schools?${params}`);
        if (!res.ok) return;
        const data = await res.json();
        if (active) setResults(data.schools || []);
      } catch {
        /* ignore */
      }
    }, 200);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [query, type]);

  // The free-text option: if the typed query isn't an exact catalog match, offer it.
  const typedIsNew =
    query.trim().length > 0 &&
    !results.some((r) => r.name.toLowerCase() === query.trim().toLowerCase());

  return (
    <Combobox value={value} onChange={(s: SchoolOption | null) => onChange(s)}>
      <div className="relative">
        <div className="relative flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 py-1.5">
          {value && <SchoolLogo name={value.name} logoUrl={value.logo_url} size={24} />}
          <ComboboxInput
            className="w-full bg-transparent text-sm text-slate-900 dark:text-white outline-none placeholder:text-slate-400"
            placeholder={placeholder}
            displayValue={(s: SchoolOption | null) => s?.name || ''}
            onChange={(e) => setQuery(e.target.value)}
          />
          <ComboboxButton className="text-slate-400">
            <ChevronUpDownIcon className="w-5 h-5" />
          </ComboboxButton>
        </div>
        <ComboboxOptions className="absolute z-50 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg">
          {typedIsNew && (
            <ComboboxOption
              value={{ name: query.trim() }}
              className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer data-[focus]:bg-indigo-50 dark:data-[focus]:bg-slate-700"
            >
              <SchoolLogo name={query.trim()} size={24} />
              <span className="text-slate-900 dark:text-white">
                Use “{query.trim()}”<span className="text-slate-400"> (not in catalog)</span>
              </span>
            </ComboboxOption>
          )}
          {results.map((s) => (
            <ComboboxOption
              key={s.id || s.name}
              value={s}
              className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer data-[focus]:bg-indigo-50 dark:data-[focus]:bg-slate-700"
            >
              <SchoolLogo name={s.name} logoUrl={s.logo_url} size={24} />
              <span className="min-w-0">
                <span className="block truncate text-slate-900 dark:text-white">{s.name}</span>
                {s.location && (
                  <span className="block truncate text-xs text-slate-400">{s.location}</span>
                )}
              </span>
            </ComboboxOption>
          ))}
          {!results.length && !typedIsNew && (
            <div className="px-3 py-2 text-sm text-slate-400">Type to search schools…</div>
          )}
        </ComboboxOptions>
      </div>
    </Combobox>
  );
}
