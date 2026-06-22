'use client';

// UploadResult — the "what changed" view for a Document Intelligence upload.
//
// It replaces the passive "Upload successful" message with two honest things:
//   1. A processing state machine (uploaded → classified → text read → facts extracted →
//      applied to life model → readiness updated → completed; plus needs_review / failed).
//   2. The `changed` summary the API returns (e.g. "Will detected", "Guardian recorded: …",
//      "Family readiness will recalculate") and any `needs_review` items.
//
// HARD RULE: render ONLY what the API returns. If `changed` is empty we show an honest
// "stored, but we couldn't extract structured details yet" — we NEVER fabricate a change.
// The component is defensive to the response shape (the Core API bridge is being finalized):
// it reads `changed` / `fields` / `needs_review` / `status` / `status_reason` / `message` /
// `next_steps` / `processing_status` only if present.

import React, { useState } from 'react';

import DocumentEvidence from './DocumentEvidence';
import ResumeImportReview from './ResumeImportReview';

/** Shape the Core API returns from POST /v1/documents and /v1/documents/upload.
 *  Every field optional — we are defensive to a backend contract still being finalized. */
export interface UploadResponse {
  document_id?: string;
  id?: string;
  doc_type?: string;
  category?: string;
  fields_extracted?: number;
  confidence?: number;
  affects_domains?: string[];
  /** 'extracted' | 'needs_review' | 'blocked_pending_confirmation' | 'failed' | string */
  status?: string;
  status_reason?: string;
  message?: string | null;
  next_steps?: string[];
  /** Human-readable life-model changes, e.g. "Will detected", "Guardian recorded: Jane Doe". */
  changed?: string[];
  /** Per-field review flags from the life-model bridge. */
  needs_review?: { field_key?: string; reason?: string; confidence?: number }[];
  /** Backend's own ordered step list (preferred when present). */
  processing_status?: { step: string; done: boolean; detail?: string }[];
  /** Raw extracted fields. */
  fields?: { field_key: string; field_value: string; confidence?: number }[];
  bridged_facts?: { fact_type?: string; ok?: boolean; confirmation_status?: string }[];
  // PII-block path:
  stored?: boolean;
  pii_warning?: boolean;
  requires_confirmation?: boolean;
  detected?: { category: string; label: string; count: number }[];
}

/** The canonical pipeline the upload travels. We derive which steps are reached from the
 *  API response; we never claim a later step than the response supports. */
export type StageKey =
  | 'uploaded'
  | 'classified'
  | 'text_read'
  | 'facts_extracted'
  | 'applied'
  | 'readiness_updated'
  | 'completed';

const STAGE_ORDER: { key: StageKey; label: string }[] = [
  { key: 'uploaded', label: 'Uploaded' },
  { key: 'classified', label: 'Classified' },
  { key: 'text_read', label: 'Text read' },
  { key: 'facts_extracted', label: 'Facts extracted' },
  { key: 'applied', label: 'Applied to life model' },
  { key: 'readiness_updated', label: 'Readiness updated' },
  { key: 'completed', label: 'Completed' },
];

export type StageState = 'done' | 'current' | 'pending' | 'failed';

/** Terminal classification for the whole upload, used for the headline + accent. */
export type Terminal = 'completed' | 'needs_review' | 'blocked' | 'failed';

export function terminalOf(res: UploadResponse): Terminal {
  if (res.status === 'failed') return 'failed';
  if (res.status === 'blocked_pending_confirmation' || res.requires_confirmation) return 'blocked';
  const extracted = (res.fields_extracted ?? res.fields?.length ?? 0) > 0;
  if (res.status === 'needs_review' || !extracted) return 'needs_review';
  return 'completed';
}

/** Map the API response to the reached stage. We are conservative: a stage is only "done"
 *  if the response actually supports it (no optimistic claims). */
export function stageStates(res: UploadResponse): Record<StageKey, StageState> {
  const terminal = terminalOf(res);
  const hasText =
    res.processing_status?.some((s) => /text/i.test(s.step) && s.done) ??
    (res.fields?.length ?? 0) > 0;
  const extracted = (res.fields_extracted ?? res.fields?.length ?? 0) > 0;
  const applied = (res.changed?.length ?? 0) > 0 || (res.bridged_facts?.some((f) => f.ok) ?? false);
  // Readiness recalculation is implied once facts are applied (caller re-fetches readiness).
  const readiness = applied;

  const states: Record<StageKey, StageState> = {
    uploaded: 'done',
    classified: res.doc_type || res.category ? 'done' : 'pending',
    text_read: hasText
      ? 'done'
      : terminal === 'needs_review' || terminal === 'failed'
        ? 'failed'
        : 'pending',
    facts_extracted: extracted ? 'done' : terminal === 'completed' ? 'pending' : 'failed',
    applied: applied ? 'done' : extracted ? 'pending' : 'failed',
    readiness_updated: readiness ? 'done' : 'pending',
    completed: terminal === 'completed' ? 'done' : 'pending',
  };

  if (terminal === 'blocked' || terminal === 'failed') {
    // Nothing past upload should claim success on a blocked/failed upload.
    for (const k of [
      'classified',
      'text_read',
      'facts_extracted',
      'applied',
      'readiness_updated',
      'completed',
    ] as StageKey[]) {
      if (states[k] === 'done' && k !== 'classified')
        states[k] = terminal === 'failed' ? 'failed' : 'pending';
    }
  }
  return states;
}

const DOT: Record<StageState, string> = {
  done: 'bg-emerald-500 border-emerald-500',
  current: 'bg-indigo-500 border-indigo-500 animate-pulse',
  pending: 'bg-gray-200 border-gray-300 dark:bg-gray-700 dark:border-gray-600',
  failed: 'bg-rose-500 border-rose-500',
};

const HEADLINE: Record<Terminal, { title: string; accent: string }> = {
  completed: { title: 'Applied to your life model', accent: 'border-emerald-500' },
  needs_review: { title: 'Stored — needs a little help', accent: 'border-amber-500' },
  blocked: { title: 'Hold on — sensitive data detected', accent: 'border-amber-500' },
  failed: { title: "We couldn't process this document", accent: 'border-rose-500' },
};

/** A single processing step row. */
function StepRow({ label, state, detail }: { label: string; state: StageState; detail?: string }) {
  return (
    <li className="flex items-start gap-2" data-testid={`stage-${label}`} data-state={state}>
      <span
        className={`mt-1 inline-block h-3 w-3 rounded-full border-2 ${DOT[state]}`}
        aria-hidden
      />
      <span className="text-sm">
        <span
          className={
            state === 'failed'
              ? 'text-rose-700 dark:text-rose-400'
              : state === 'done'
                ? 'text-gray-800 dark:text-gray-200'
                : 'text-gray-400 dark:text-gray-500'
          }
        >
          {label}
        </span>
        {detail && <span className="block text-xs text-gray-400">{detail}</span>}
      </span>
    </li>
  );
}

export default function UploadResult({ res }: { res: UploadResponse }) {
  const [showEvidence, setShowEvidence] = useState(false);

  // PII block is its own terminal — surface the detected categories + the API's own message.
  if (res.requires_confirmation || res.status === 'blocked_pending_confirmation') {
    return (
      <div
        className="mt-3 rounded-lg border-l-4 border-amber-500 bg-amber-50 p-4 dark:bg-amber-950/30"
        data-testid="upload-result"
      >
        <div className="font-semibold text-amber-900 dark:text-amber-200">
          {HEADLINE.blocked.title}
        </div>
        {res.message && (
          <p className="mt-1 text-sm text-amber-800 dark:text-amber-300">{res.message}</p>
        )}
        {(res.detected?.length ?? 0) > 0 && (
          <ul className="mt-2 space-y-0.5 text-xs text-amber-800 dark:text-amber-300">
            {res.detected!.map((d) => (
              <li key={d.category}>
                {d.label}: {d.count}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  const terminal = terminalOf(res);
  const head = HEADLINE[terminal];
  const states = stageStates(res);
  const changed = res.changed ?? [];
  const needsReview = res.needs_review ?? [];
  const fields = res.fields ?? [];
  const nextSteps = res.next_steps ?? [];
  const docId = res.document_id || res.id || '';

  // Prefer the backend's own step list (with its details) when present; otherwise our derived stages.
  const usingBackendSteps = (res.processing_status?.length ?? 0) > 0;

  return (
    <div
      className={`mt-3 rounded-lg border-l-4 ${head.accent} bg-white p-4 shadow-sm dark:bg-gray-800`}
      data-testid="upload-result"
    >
      <div className="font-semibold text-gray-900 dark:text-gray-100">{head.title}</div>

      {/* Processing state machine */}
      <ul className="mt-3 space-y-1.5" data-testid="upload-stages">
        {usingBackendSteps
          ? res.processing_status!.map((s) => (
              <StepRow
                key={s.step}
                label={s.step}
                state={s.done ? 'done' : 'pending'}
                detail={s.detail}
              />
            ))
          : STAGE_ORDER.map((s) => <StepRow key={s.key} label={s.label} state={states[s.key]} />)}
      </ul>

      {/* What changed — ONLY what the API returned. Honest fallback when empty. */}
      <div className="mt-4">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
          What changed
        </div>
        {changed.length > 0 ? (
          <ul className="mt-1 space-y-1" data-testid="changed-list">
            {changed.map((c, i) => (
              <li
                key={`${c}-${i}`}
                className="flex items-start gap-1.5 text-sm text-gray-800 dark:text-gray-200"
              >
                <span className="text-emerald-600" aria-hidden>
                  ✓
                </span>
                <span>{c}</span>
              </li>
            ))}
          </ul>
        ) : terminal === 'failed' ? (
          <p className="mt-1 text-sm text-rose-700 dark:text-rose-400" data-testid="changed-empty">
            {res.message ||
              'We could not process this document. Please try a clearer copy or paste the text.'}
          </p>
        ) : (
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300" data-testid="changed-empty">
            {res.message ||
              "Stored, but we couldn't extract structured details yet — it's queued for review, or you can add the details manually."}
          </p>
        )}
      </div>

      {/* Needs review */}
      {needsReview.length > 0 && (
        <div
          className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-2.5 dark:border-amber-900 dark:bg-amber-950/30"
          data-testid="needs-review"
        >
          <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
            Needs your review
          </div>
          <ul className="mt-1 space-y-0.5 text-xs text-amber-800 dark:text-amber-300">
            {needsReview.map((nr, i) => (
              <li key={`${nr.field_key}-${i}`}>
                {(nr.field_key || 'field').replace(/_/g, ' ')}
                {typeof nr.confidence === 'number' &&
                  ` — ${Math.round(nr.confidence * 100)}% confidence`}
                {nr.reason === 'low_confidence_or_scanned' &&
                  ' (low confidence — confirm this value)'}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Next steps (only when the API offers them, typically on needs_review) */}
      {nextSteps.length > 0 && (
        <div className="mt-3" data-testid="next-steps">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            Next steps
          </div>
          <ul className="mt-1 list-disc pl-5 text-xs text-gray-600 dark:text-gray-300">
            {nextSteps.map((s, i) => (
              <li key={`${s}-${i}`}>{s}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Raw extracted fields (provenance) */}
      {fields.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1" data-testid="extracted-fields">
          {fields.map((f) => (
            <span
              key={f.field_key}
              className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700 dark:bg-gray-700 dark:text-gray-200"
            >
              {f.field_key.replace(/_/g, ' ')}: {f.field_value}
            </span>
          ))}
        </div>
      )}

      {/* Resume → the Import Review screen (Phase 8): review extracted records, then import to domains. */}
      {docId && res.doc_type === 'resume' && (
        <div className="mt-4 border-t border-gray-100 pt-4 dark:border-gray-700">
          <ResumeImportReview documentId={docId} />
        </div>
      )}

      {/* View Evidence — trace every field to its source page/section + confirm/edit/reject (P0 trust). */}
      {docId && res.doc_type !== 'resume' && terminal !== 'failed' && (
        <div className="mt-3">
          <button
            onClick={() => setShowEvidence((v) => !v)}
            className="text-xs font-semibold text-indigo-700 hover:underline dark:text-indigo-400"
            data-testid="view-evidence-toggle"
          >
            {showEvidence ? 'Hide evidence' : 'View evidence'}
          </button>
          {showEvidence && <DocumentEvidence documentId={docId} />}
        </div>
      )}
    </div>
  );
}
