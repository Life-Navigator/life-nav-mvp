'use client';

// Document Intelligence — the data-acquisition layer, extracted into a reusable component so it can be
// the standalone /dashboard/documents page AND a tab inside a domain (e.g. Family → Documents). Upload or
// paste a document; LifeNavigator extracts its fields, scores readiness per category, recommends what to
// add. Extraction invents nothing. Onboarding loop preserved (advisor ?return_to deep-link).

import React, { useEffect, useState } from 'react';

import ConflictReview from './ConflictReview';
import UploadResult, { type UploadResponse } from './UploadResult';

type Status = 'green' | 'yellow' | 'orange' | 'red';
interface CatReadiness {
  category: string;
  status: Status;
  have: number;
  critical: number;
  missing: string[];
}
interface Readiness {
  overall_score: number;
  overall_status: Status;
  categories: CatReadiness[];
  documents_on_file: number;
}
// The upload/register response is the canonical UploadResponse (defensive to the Core API contract).
type RegisterResult = UploadResponse;

const COLOR: Record<Status, string> = {
  green: 'bg-emerald-500',
  yellow: 'bg-amber-400',
  orange: 'bg-orange-500',
  red: 'bg-rose-500',
};

export type DocGroup = { group: string; items: [string, string][] };

// Full catalog (standalone page default).
export const DEFAULT_DOC_GROUPS: DocGroup[] = [
  {
    group: 'Finance',
    items: [
      ['401k_statement', '401(k) Statement'],
      ['pay_stub', 'Pay Stub'],
      ['tax_return', 'Tax Return'],
      ['bank_statement', 'Bank Statement'],
      ['investment_statement', 'Investment / Brokerage Statement'],
      ['insurance_policy', 'Insurance Policy'],
      ['mortgage_statement', 'Mortgage Statement'],
      ['social_security_estimate', 'Social Security Estimate'],
    ],
  },
  {
    group: 'Career',
    items: [
      ['resume', 'Resume / CV'],
      ['offer_letter', 'Offer Letter'],
      ['employment_contract', 'Employment Contract'],
    ],
  },
  {
    group: 'Education',
    items: [
      ['transcript', 'Transcript'],
      ['degree_plan', 'Degree Plan'],
      ['tuition_bill', 'Tuition Bill'],
      ['acceptance_letter', 'Acceptance Letter'],
      ['financial_aid_letter', 'Financial Aid Letter'],
    ],
  },
  {
    group: 'Health',
    items: [
      ['lab_report', 'Lab Report'],
      ['insurance_card', 'Insurance Card'],
      ['medication_list', 'Medication List'],
    ],
  },
  {
    group: 'Family',
    items: [
      ['estate_plan', 'Estate Plan'],
      ['will', 'Will'],
      ['trust', 'Trust'],
      ['beneficiary_document', 'Beneficiary Document'],
      ['life_insurance_policy', 'Life Insurance Policy'],
    ],
  },
  { group: 'Other', items: [['other', 'Other / Not listed']] },
];

export const FAMILY_DOC_GROUPS: DocGroup[] = [
  DEFAULT_DOC_GROUPS.find((g) => g.group === 'Family')!,
  { group: 'Other', items: [['other', 'Other / Not listed']] },
];

interface Props {
  title?: string;
  intro?: string;
  groups?: DocGroup[];
  /** Only show these readiness categories (e.g. family-relevant). Omit → show all. */
  categoryFilter?: string[];
  defaultDocType?: string;
  /** When true, scope upload + readiness to the family domain. */
  domain?: string;
}

export default function DocumentIntelligence({
  title = 'Document Intelligence',
  intro = "Add a document — LifeNavigator extracts the facts and tracks what's missing. Nothing is invented.",
  groups = DEFAULT_DOC_GROUPS,
  categoryFilter,
  defaultDocType,
  domain = '',
}: Props) {
  const knownTypes = new Set(groups.flatMap((g) => g.items.map(([v]) => v)));
  const [r, setR] = useState<Readiness | null>(null);
  const [docType, setDocType] = useState(defaultDocType || groups[0]?.items[0]?.[0] || 'other');
  const [text, setText] = useState('');
  const [result, setResult] = useState<RegisterResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [domainParam, setDomainParam] = useState(domain);
  const [returnTo, setReturnTo] = useState('');
  const [reason, setReason] = useState('');
  const [unlock, setUnlock] = useState('');
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const q = new URLSearchParams(window.location.search);
    const dt = q.get('doc_type');
    if (dt) setDocType(dt);
    setDomainParam(q.get('domain') || domain);
    setReturnTo(q.get('return_to') || '');
    setReason(q.get('reason') || '');
    setUnlock(q.get('unlock') || '');
  }, [domain]);

  const loadReadiness = () =>
    fetch('/api/documents').then(async (x) => (x.ok ? setR(await x.json()) : null));
  useEffect(() => {
    loadReadiness();
  }, []);

  useEffect(() => {
    if (!result || !returnTo) return;
    setRedirecting(true);
    const docId = result.document_id || result.id || '';
    const sep = returnTo.includes('?') ? '&' : '?';
    const url =
      `${returnTo}${sep}uploaded=1&uploaded_domain=${encodeURIComponent(domainParam)}` +
      (docId ? `&uploaded_doc_id=${encodeURIComponent(docId)}` : '');
    const tmr = setTimeout(() => {
      window.location.href = url;
    }, 1800);
    return () => clearTimeout(tmr);
  }, [result, returnTo, domainParam]);

  const submit = async () => {
    if (!text.trim()) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doc_type: docType, text, domain: domainParam || undefined }),
      });
      if (res.ok) {
        setResult(await res.json());
        setText('');
        await loadReadiness();
      }
    } finally {
      setBusy(false);
    }
  };

  const uploadFile = async (file: File) => {
    setBusy(true);
    setResult(null);
    try {
      const form = new FormData();
      form.append('doc_type', docType);
      if (domainParam) form.append('domain', domainParam);
      form.append('file', file);
      const res = await fetch('/api/documents', { method: 'POST', body: form });
      if (res.ok) {
        setResult(await res.json());
        await loadReadiness();
      }
    } finally {
      setBusy(false);
    }
  };

  const requested = !!(returnTo || reason || unlock);
  const cats = r
    ? categoryFilter
      ? r.categories.filter((c) => categoryFilter.includes(c.category))
      : r.categories
    : [];

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{title}</h1>
      <p className="text-sm text-gray-500 mt-1">{intro}</p>

      {requested && (
        <div className="mt-4 rounded-xl border-2 border-indigo-200 bg-indigo-50 p-4">
          <div className="text-[11px] uppercase tracking-wide text-indigo-500 font-semibold">
            Your advisor requested this document
          </div>
          {reason && <p className="mt-1 text-sm text-gray-800">{reason}</p>}
          {unlock && <p className="mt-1 text-xs text-emerald-700">Unlocks: {unlock}</p>}
        </div>
      )}

      <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
        Please avoid uploading documents with Social Security numbers, full account numbers, or
        highly sensitive identifiers unless necessary. During beta, use redacted documents when
        possible.
      </div>

      <div className="mt-4 bg-white rounded-lg shadow-md p-5 dark:bg-gray-800">
        <div className="flex gap-2 items-center flex-wrap">
          <select
            value={docType}
            onChange={(e) => setDocType(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
          >
            {!knownTypes.has(docType) && (
              <option value={docType}>{docType.replace(/_/g, ' ')}</option>
            )}
            {groups.map((g) => (
              <optgroup key={g.group} label={g.group}>
                {g.items.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <button
            onClick={submit}
            disabled={busy || redirecting}
            className="px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium disabled:opacity-50"
          >
            {busy ? 'Reading…' : 'Extract text'}
          </button>
          <label className="px-4 py-2 rounded-md border border-indigo-600 text-indigo-700 text-sm font-medium cursor-pointer hover:bg-indigo-50">
            {busy ? '…' : 'Upload file'}
            <input
              type="file"
              accept=".pdf,.txt,.png,.jpg,.jpeg"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadFile(f);
              }}
              disabled={busy || redirecting}
            />
          </label>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          placeholder="Paste the document text (e.g. Policy Holder: …  Coverage: $500,000 …)"
          className="mt-3 w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-mono dark:border-gray-600 dark:bg-gray-900"
        />

        {busy && !result && (
          <div
            className="mt-3 flex items-center gap-2 text-sm text-gray-500"
            data-testid="upload-busy"
          >
            <span
              className="inline-block h-3 w-3 animate-pulse rounded-full bg-indigo-500"
              aria-hidden
            />
            Reading your document…
          </div>
        )}

        {result && (
          <>
            <UploadResult res={result} />
            {redirecting && (
              <div className="mt-2 text-sm font-medium text-indigo-700" data-testid="redirecting">
                Got it — taking you back…
              </div>
            )}
          </>
        )}
      </div>

      {/* Phase 6: surface contradictions across documents + profile. Re-mounts after each upload. */}
      <div className="mt-6">
        <ConflictReview key={String(result?.document_id ?? 'init')} embedded />
      </div>

      {r && (
        <div className="mt-6">
          <div className="flex items-center gap-3">
            <div
              className={`w-14 h-14 rounded-full ${COLOR[r.overall_status]} flex items-center justify-center text-white font-bold`}
            >
              {r.overall_score}
            </div>
            <div>
              <div className="font-semibold text-gray-900 dark:text-gray-100">
                Document Readiness
              </div>
              <div className="text-sm text-gray-500">{r.documents_on_file} document(s) on file</div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {cats.map((c) => (
              <div key={c.category} className="bg-white rounded-lg shadow-md p-4 dark:bg-gray-800">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-800 capitalize dark:text-gray-200">
                    {c.category.replace(/_/g, ' ')}
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full text-white ${COLOR[c.status]}`}
                  >
                    {c.have}/{c.critical}
                  </span>
                </div>
                {c.missing.length > 0 && (
                  <div className="text-xs text-gray-500 mt-1">Missing: {c.missing.join(', ')}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
