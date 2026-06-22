'use client';

// ResumeImportReview — the Resume Import Review screen (Trust Sprint, Phase 8C).
//
// After a resume is uploaded, its extracted records are shown grouped by section (Employment,
// Education, Certifications, …), each with confidence, source page, and review status. Nothing
// auto-imports: the user ignores items they don't want, then imports the rest into Career +
// Education. Pre-import conflicts (reusing the Phase 6 engine) are surfaced first.

import React, { useCallback, useEffect, useState } from 'react';

interface Item {
  id: string;
  fields: Record<string, unknown>;
  confidence?: number | null;
  page_number?: number | null;
  review_status?: string;
}
interface Section {
  section: string;
  title: string;
  items: Item[];
}
interface PreviewConflict {
  concept: string;
  label?: string;
  severity: string;
  items: { value: string; source_label?: string | null }[];
  recommended?: { text?: string };
}

function band(conf?: number | null): string {
  const pct = Math.round((conf ?? 0) * 100);
  if (pct >= 80) return 'text-emerald-700';
  if (pct >= 60) return 'text-amber-700';
  return 'text-rose-700';
}

function summarize(section: string, f: Record<string, unknown>): string {
  const g = (k: string) => (f[k] == null ? '' : String(f[k]));
  if (section === 'employment')
    return [g('title'), g('employer')].filter(Boolean).join(' @ ') || '(untitled role)';
  if (section === 'volunteer')
    return [g('role'), g('organization')].filter(Boolean).join(' @ ') || g('organization');
  if (section === 'projects') return g('name') || '(untitled project)';
  if (section === 'education')
    return (
      [g('degree_type'), g('institution_name')].filter(Boolean).join(' · ') || g('institution_name')
    );
  if (section === 'certifications')
    return [g('name'), g('issuer')].filter(Boolean).join(' — ') || g('name');
  if (section === 'skills') return g('name');
  return JSON.stringify(f);
}

export default function ResumeImportReview({
  documentId,
  onImported,
}: {
  documentId: string;
  onImported?: (summary: unknown) => void;
}) {
  const [sections, setSections] = useState<Section[]>([]);
  const [conflicts, setConflicts] = useState<PreviewConflict[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [ignored, setIgnored] = useState<Set<string>>(new Set());
  const [done, setDone] = useState<null | { imported_total: number }>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rev, conf] = await Promise.all([
        fetch(`/api/documents/resume/${encodeURIComponent(documentId)}/review`, {
          cache: 'no-store',
        }),
        fetch(`/api/documents/resume/${encodeURIComponent(documentId)}/conflicts`, {
          cache: 'no-store',
        }),
      ]);
      if (rev.ok) setSections((await rev.json()).sections ?? []);
      if (conf.ok) setConflicts((await conf.json()).conflicts ?? []);
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleIgnore = async (item: Item) => {
    const next = new Set(ignored);
    const willIgnore = !next.has(item.id);
    willIgnore ? next.add(item.id) : next.delete(item.id);
    setIgnored(next);
    await fetch(`/api/documents/resume/items/${encodeURIComponent(item.id)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: willIgnore ? 'ignore' : 'reset' }),
    });
  };

  const importApproved = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/documents/resume/${encodeURIComponent(documentId)}/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const summary = await res.json();
        setDone({ imported_total: summary.imported_total ?? 0 });
        onImported?.(summary);
      }
    } finally {
      setBusy(false);
    }
  };

  if (loading)
    return (
      <div className="text-sm text-gray-500" data-testid="resume-loading">
        Reading your resume…
      </div>
    );
  if (done)
    return (
      <div
        className="rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-800"
        data-testid="resume-imported"
      >
        Imported {done.imported_total} record(s) into your Career and Education domains. Each traces
        back to this resume.
      </div>
    );
  if (sections.length === 0)
    return (
      <div className="text-sm text-gray-500" data-testid="resume-empty">
        No resume records to review.
      </div>
    );

  const totalImportable = sections.reduce(
    (n, s) => n + s.items.filter((i) => !ignored.has(i.id)).length,
    0
  );

  return (
    <div className="space-y-4" data-testid="resume-import-review">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Review what we found
        </h2>
        <button
          onClick={importApproved}
          disabled={busy || totalImportable === 0}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          data-testid="import-approved"
        >
          {busy ? 'Importing…' : `Import ${totalImportable} approved`}
        </button>
      </div>

      {conflicts.length > 0 && (
        <div
          className="rounded-lg border border-amber-300 bg-amber-50 p-3"
          data-testid="resume-conflicts"
        >
          <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">
            {conflicts.length} conflict(s) with your existing profile — review before importing
          </div>
          <ul className="mt-1 space-y-1 text-xs text-amber-800">
            {conflicts.map((c) => (
              <li key={c.concept}>
                <span className="font-medium">{c.label || c.concept}:</span>{' '}
                {c.items.map((i) => `${i.value} (${i.source_label})`).join(' vs ')}
                {c.recommended?.text ? ` — 💡 ${c.recommended.text}` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}

      {sections.map((s) => (
        <div key={s.section} data-testid={`resume-section-${s.section}`}>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            {s.title}
          </div>
          <ul className="mt-1 space-y-1.5">
            {s.items.map((it) => {
              const isIgnored = ignored.has(it.id);
              return (
                <li
                  key={it.id}
                  className={`flex items-center justify-between gap-2 rounded-md border border-gray-200 bg-white p-2.5 dark:border-gray-700 dark:bg-gray-800 ${isIgnored ? 'opacity-50' : ''}`}
                >
                  <div className="text-sm">
                    <span
                      className={isIgnored ? 'line-through' : 'text-gray-900 dark:text-gray-100'}
                    >
                      {summarize(s.section, it.fields)}
                    </span>
                    <span className="block text-[11px] text-gray-500">
                      <span className={band(it.confidence)}>
                        {Math.round((it.confidence ?? 0) * 100)}% confidence
                      </span>
                      {it.page_number ? ` · page ${it.page_number}` : ''}
                      {it.review_status === 'needs_review' ? ' · needs review' : ''}
                    </span>
                  </div>
                  <button
                    onClick={() => toggleIgnore(it)}
                    className="rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-600"
                    data-testid={`ignore-${it.id}`}
                  >
                    {isIgnored ? 'Include' : 'Ignore'}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
