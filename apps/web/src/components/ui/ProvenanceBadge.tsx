'use client';

// Reusable provenance badge (User Truth Model). Shows whether an item is confirmed / on-record /
// calculated / suggested / inferred / assumed, with a hover tooltip of source + confidence + last-updated.
// The platform must never present an inferred or assumed item as a plain fact — this is how we say so.

export type ProvenanceType =
  | 'user_confirmed'
  | 'user_stated'
  | 'document_extracted'
  | 'connected_account'
  | 'system_calculated'
  | 'recommendation_generated'
  | 'advisor_inferred'
  | 'assumption';

export interface Provenance {
  provenance_type?: ProvenanceType | null;
  source?: string | null;
  confidence?: number | null;
  updated_at?: string | null;
}

const META: Record<ProvenanceType, { label: string; cls: string }> = {
  user_confirmed: {
    label: 'Confirmed',
    cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  },
  user_stated: {
    label: 'On record',
    cls: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  },
  document_extracted: {
    label: 'From document',
    cls: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  },
  connected_account: {
    label: 'Linked account',
    cls: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  },
  system_calculated: {
    label: 'Calculated',
    cls: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  },
  recommendation_generated: {
    label: 'Suggested',
    cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  },
  advisor_inferred: {
    label: 'Inferred',
    cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  },
  assumption: {
    label: 'Assumed',
    cls: 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200',
  },
};

export default function ProvenanceBadge({ provenance }: { provenance?: Provenance | null }) {
  const t = provenance?.provenance_type;
  if (!t || !META[t]) return null;
  const m = META[t];
  const conf =
    provenance?.confidence != null
      ? `${Math.round(provenance.confidence * 100)}% confidence`
      : null;
  const when = provenance?.updated_at
    ? `updated ${new Date(provenance.updated_at).toLocaleDateString()}`
    : null;
  const tip = [provenance?.source && `Source: ${provenance.source}`, conf, when]
    .filter(Boolean)
    .join(' · ');
  return (
    <span
      title={tip || m.label}
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${m.cls}`}
    >
      {m.label}
    </span>
  );
}
