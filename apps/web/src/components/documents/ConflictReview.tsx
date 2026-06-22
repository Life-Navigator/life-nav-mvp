'use client';

// ConflictReview — surface contradictions across documents + user-entered data (Trust Sprint, Phase 6).
//
// When two sources disagree about the same fact, we never pick silently. This panel shows each
// competing value with its source (document page/section or the user's profile), confidence, and
// review status, plus a recommended resolution (by precedence). The user keeps one value, enters a
// correction, or ignores the conflict. Renders nothing when there are no open conflicts.

import React, { useCallback, useEffect, useState } from 'react';

interface ConflictItem {
  id: string;
  source_type: 'document' | 'domain';
  source_table: string;
  source_document_id?: string | null;
  value: string;
  confidence?: number | null;
  review_status?: string | null;
  page_number?: number | null;
  section?: string | null;
}
interface Conflict {
  id: string;
  domain?: string;
  conflict_type: string;
  field_key: string;
  label?: string;
  status: string;
  severity: string;
  items: ConflictItem[];
  recommended?: {
    item_id?: string | null;
    value?: string | null;
    source_label?: string | null;
    text?: string;
  };
}

const SEVERITY: Record<string, string> = {
  critical: 'bg-rose-100 text-rose-800 border-rose-300',
  high: 'bg-orange-100 text-orange-800 border-orange-300',
  medium: 'bg-amber-100 text-amber-800 border-amber-300',
  low: 'bg-gray-100 text-gray-700 border-gray-300',
};

function sourceLabel(it: ConflictItem): string {
  if (it.source_type === 'domain') {
    const t = it.source_table.split('.').pop()?.replace(/_/g, ' ') || 'your profile';
    return `Your ${t}`;
  }
  const loc = it.page_number ? `page ${it.page_number}` : 'pasted text';
  return `Uploaded document (${loc}${it.section ? `, “${it.section}”` : ''})`;
}

export default function ConflictReview({ embedded = false }: { embedded?: boolean }) {
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [editingId, setEditingId] = useState('');
  const [draft, setDraft] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/documents/conflicts', { cache: 'no-store' });
      if (res.ok) setConflicts((await res.json()).conflicts ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const resolve = async (id: string, body: Record<string, unknown>) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/documents/conflicts/${encodeURIComponent(id)}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setConflicts((prev) => prev.filter((c) => c.id !== id)); // resolved → drops out of open list
        setEditingId('');
      }
    } finally {
      setBusyId('');
    }
  };

  if (loading)
    return (
      <div className="text-sm text-gray-500" data-testid="conflicts-loading">
        Checking for conflicts…
      </div>
    );
  if (conflicts.length === 0)
    return embedded ? null : (
      <div className="text-sm text-gray-500" data-testid="conflicts-empty">
        No unresolved conflicts — your documents and profile agree.
      </div>
    );

  return (
    <div className="space-y-3" data-testid="conflict-review">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {conflicts.length} unresolved {conflicts.length === 1 ? 'conflict' : 'conflicts'}
        </h2>
        <span className="text-xs text-gray-500">
          Confirm which value is correct — we never choose silently.
        </span>
      </div>

      {conflicts.map((c) => (
        <div
          key={c.id}
          className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"
          data-testid={`conflict-${c.field_key}`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="font-medium text-gray-900 dark:text-gray-100">
              {c.label || c.field_key.replace(/_/g, ' ')}
            </div>
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${SEVERITY[c.severity] || SEVERITY.low}`}
            >
              {c.severity}
            </span>
          </div>

          {/* Competing values — each cited to its source. */}
          <ul className="mt-2 space-y-2">
            {c.items.map((it) => (
              <li
                key={it.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-gray-100 bg-gray-50 p-2.5 dark:border-gray-700 dark:bg-gray-900/40"
              >
                <div className="text-sm">
                  <span className="font-semibold text-gray-900 dark:text-gray-100">{it.value}</span>
                  <span className="block text-[11px] text-gray-500">
                    {sourceLabel(it)}
                    {typeof it.confidence === 'number'
                      ? ` · ${Math.round(it.confidence * 100)}% confidence`
                      : ''}
                    {it.review_status ? ` · ${it.review_status.replace(/_/g, ' ')}` : ''}
                  </span>
                </div>
                <button
                  onClick={() => resolve(c.id, { resolution: 'keep', item_id: it.id })}
                  disabled={busyId === c.id}
                  className="rounded-md border border-emerald-300 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                  data-testid={`keep-${it.id}`}
                >
                  Keep this
                </button>
              </li>
            ))}
          </ul>

          {c.recommended?.text && (
            <p
              className="mt-2 text-[11px] text-indigo-700 dark:text-indigo-400"
              data-testid="recommendation"
            >
              💡 {c.recommended.text}
            </p>
          )}

          {/* Enter a corrected value, or ignore. */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {editingId === c.id ? (
              <>
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Corrected value"
                  className="rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-900"
                  autoFocus
                />
                <button
                  onClick={() => resolve(c.id, { resolution: 'value', value: draft })}
                  disabled={busyId === c.id || !draft.trim()}
                  className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white disabled:opacity-50"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditingId('')}
                  className="rounded-md border border-gray-300 px-2.5 py-1 text-xs text-gray-600 dark:border-gray-600"
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => {
                    setEditingId(c.id);
                    setDraft(c.recommended?.value || '');
                  }}
                  disabled={busyId === c.id}
                  className="rounded-md border border-sky-300 px-2.5 py-1 text-xs font-medium text-sky-700 hover:bg-sky-50 disabled:opacity-50"
                >
                  Enter corrected value
                </button>
                <button
                  onClick={() => resolve(c.id, { resolution: 'ignore' })}
                  disabled={busyId === c.id}
                  className="rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600"
                  data-testid={`ignore-${c.id}`}
                >
                  Ignore
                </button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
