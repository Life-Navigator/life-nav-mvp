'use client';

// DocumentEvidence — the "View Evidence" drawer (Document Intelligence Trust Sprint, P0).
//
// Answers, for every document-derived field, "Where did this come from?" and "Why does the system
// believe it?" in one click: source page, section, character span, confidence band, extraction
// method, and review status. The user can then Confirm / Edit / Reject each value — the trust loop
// the advisor honors (user_confirmed/user_edited > extracted > inferred).
//
// HARD RULE: render ONLY what the evidence endpoint returns. We never fabricate a page or a value.

import React, { useEffect, useState } from 'react';

interface EvidenceField {
  id: string;
  field_key: string;
  field_value: string;
  field_type?: string;
  confidence?: number; // 0..1
  page_number?: number | null;
  section?: string | null;
  char_start?: number | null;
  char_end?: number | null;
  extraction_method?: string | null;
  review_status?: string;
}
interface EvidenceDoc {
  id: string;
  doc_type?: string;
  title?: string;
  confidence?: number;
  status?: string;
  uploaded_at?: string;
}
interface EvidencePayload {
  document: EvidenceDoc | null;
  fields: EvidenceField[];
}

// Phase 4 — confidence bands. confidence is a 0..1 float; show the band + percent honestly.
function band(conf?: number): { label: string; cls: string } {
  const pct = Math.round((conf ?? 0) * 100);
  if (pct >= 95)
    return { label: 'Verified', cls: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
  if (pct >= 80) return { label: 'High confidence', cls: 'bg-sky-100 text-sky-800 border-sky-300' };
  if (pct >= 60)
    return { label: 'Review recommended', cls: 'bg-amber-100 text-amber-800 border-amber-300' };
  return { label: 'Needs review', cls: 'bg-rose-100 text-rose-800 border-rose-300' };
}

const REVIEW_LABEL: Record<string, string> = {
  extracted: 'Extracted',
  needs_review: 'Needs review',
  user_confirmed: 'Confirmed by you',
  user_edited: 'Edited by you',
  rejected: 'Rejected',
};

function ReviewBadge({ status }: { status?: string }) {
  if (!status) return null;
  const cls =
    status === 'user_confirmed' || status === 'user_edited'
      ? 'bg-emerald-600 text-white'
      : status === 'rejected'
        ? 'bg-gray-400 text-white line-through'
        : status === 'needs_review'
          ? 'bg-amber-500 text-white'
          : 'bg-gray-200 text-gray-700';
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${cls}`}>
      {REVIEW_LABEL[status] || status}
    </span>
  );
}

export default function DocumentEvidence({ documentId }: { documentId: string }) {
  const [data, setData] = useState<EvidencePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [editing, setEditing] = useState<string>('');
  const [draft, setDraft] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/documents/${encodeURIComponent(documentId)}/evidence`, {
        cache: 'no-store',
      });
      if (!res.ok) {
        setError('Could not load evidence for this document.');
        return;
      }
      setData(await res.json());
    } catch {
      setError('Could not load evidence for this document.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId]);

  const review = async (
    fieldId: string,
    action: 'confirm' | 'edit' | 'reject',
    newValue?: string
  ) => {
    setBusyId(fieldId);
    try {
      const res = await fetch(`/api/documents/fields/${encodeURIComponent(fieldId)}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, new_value: newValue ?? '' }),
      });
      if (res.ok) {
        const r = await res.json();
        setData((prev) =>
          prev
            ? {
                ...prev,
                fields: prev.fields.map((f) =>
                  f.id === fieldId
                    ? {
                        ...f,
                        review_status: r.review_status ?? f.review_status,
                        field_value: r.field_value ?? f.field_value,
                      }
                    : f
                ),
              }
            : prev
        );
        setEditing('');
      }
    } finally {
      setBusyId('');
    }
  };

  if (loading)
    return (
      <div className="mt-3 text-sm text-gray-500" data-testid="evidence-loading">
        Loading evidence…
      </div>
    );
  if (error)
    return (
      <div className="mt-3 text-sm text-rose-700" data-testid="evidence-error">
        {error}
      </div>
    );
  if (!data?.document)
    return (
      <div className="mt-3 text-sm text-gray-500" data-testid="evidence-empty">
        No evidence on file for this document yet.
      </div>
    );

  const { document: doc, fields } = data;

  return (
    <div
      className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/40"
      data-testid="document-evidence"
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            Evidence
          </div>
          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {doc.title || (doc.doc_type || 'Document').replace(/_/g, ' ')}
          </div>
        </div>
      </div>

      {fields.length === 0 ? (
        <p className="mt-2 text-sm text-gray-500">
          No structured fields were extracted from this document.
        </p>
      ) : (
        <ul className="mt-3 space-y-2" data-testid="evidence-fields">
          {fields.map((f) => {
            const b = band(f.confidence);
            const rejected = f.review_status === 'rejected';
            return (
              <li
                key={f.id}
                className={`rounded-md border bg-white p-3 dark:bg-gray-800 ${rejected ? 'opacity-60' : ''}`}
                data-testid={`evidence-field-${f.field_key}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm text-gray-800 dark:text-gray-200">
                    <span className="font-medium capitalize">{f.field_key.replace(/_/g, ' ')}</span>
                    {': '}
                    {editing === f.id ? (
                      <input
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        className="ml-1 rounded border border-gray-300 px-2 py-0.5 text-sm dark:border-gray-600 dark:bg-gray-900"
                        autoFocus
                      />
                    ) : (
                      <span className={rejected ? 'line-through' : ''}>{f.field_value}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${b.cls}`}
                    >
                      {b.label} · {Math.round((f.confidence ?? 0) * 100)}%
                    </span>
                    <ReviewBadge status={f.review_status} />
                  </div>
                </div>

                {/* Provenance line — where this came from (Phase 3). */}
                <div className="mt-1 text-[11px] text-gray-500">
                  {f.page_number ? `Page ${f.page_number}` : 'Pasted text (no page)'}
                  {f.section ? ` · section “${f.section}”` : ''}
                  {typeof f.char_start === 'number' && typeof f.char_end === 'number'
                    ? ` · chars ${f.char_start}–${f.char_end}`
                    : ''}
                  {f.extraction_method ? ` · via ${f.extraction_method}` : ''}
                </div>

                {/* Review actions — confirm / edit / reject (Phase 5). */}
                <div className="mt-2 flex flex-wrap gap-2">
                  {editing === f.id ? (
                    <>
                      <button
                        onClick={() => review(f.id, 'edit', draft)}
                        disabled={busyId === f.id || !draft.trim()}
                        className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white disabled:opacity-50"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditing('')}
                        className="rounded-md border border-gray-300 px-2.5 py-1 text-xs text-gray-600 dark:border-gray-600"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => review(f.id, 'confirm')}
                        disabled={busyId === f.id || f.review_status === 'user_confirmed'}
                        className="rounded-md border border-emerald-300 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => {
                          setEditing(f.id);
                          setDraft(f.field_value);
                        }}
                        disabled={busyId === f.id}
                        className="rounded-md border border-sky-300 px-2.5 py-1 text-xs font-medium text-sky-700 hover:bg-sky-50 disabled:opacity-50"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => review(f.id, 'reject')}
                        disabled={busyId === f.id || f.review_status === 'rejected'}
                        className="rounded-md border border-rose-300 px-2.5 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
