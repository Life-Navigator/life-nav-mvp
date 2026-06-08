'use client';

// Document Intelligence (Elite Sprint 10) — the data-acquisition layer. Upload/paste a document;
// LifeNavigator extracts its fields, scores document readiness per category (which critical docs
// you have vs need), and recommends what to add. Extraction invents nothing.

import React, { useEffect, useState } from 'react';

type Status = 'green' | 'yellow' | 'orange' | 'red';
interface CatReadiness { category: string; status: Status; have: number; critical: number; missing: string[] }
interface Readiness { overall_score: number; overall_status: Status; categories: CatReadiness[]; documents_on_file: number }
interface RegisterResult { doc_type: string; category: string; fields_extracted: number; confidence: number; affects_domains: string[]; fields: { field_key: string; field_value: string; confidence: number }[] }

const COLOR: Record<Status, string> = { green: 'bg-emerald-500', yellow: 'bg-amber-400', orange: 'bg-orange-500', red: 'bg-rose-500' };
const DOC_TYPES = [
  ['offer_letter', 'Offer Letter'], ['401k_statement', '401(k) Statement'], ['life_insurance_policy', 'Life Insurance Policy'],
  ['brokerage_statement', 'Brokerage Statement'], ['social_security_estimate', 'Social Security Estimate'],
  ['financial_aid_letter', 'Financial Aid Letter'], ['will', 'Will'], ['dd214', 'DD214'], ['va_award_letter', 'VA Award Letter'],
];

export default function DocumentsPage() {
  const [r, setR] = useState<Readiness | null>(null);
  const [docType, setDocType] = useState('offer_letter');
  const [text, setText] = useState('');
  const [result, setResult] = useState<RegisterResult | null>(null);
  const [busy, setBusy] = useState(false);

  const loadReadiness = () => fetch('/api/documents').then(async (x) => (x.ok ? setR(await x.json()) : null));
  useEffect(() => { loadReadiness(); }, []);

  const submit = async () => {
    if (!text.trim()) return;
    setBusy(true); setResult(null);
    try {
      const res = await fetch('/api/documents', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ doc_type: docType, text }) });
      if (res.ok) { setResult(await res.json()); setText(''); await loadReadiness(); }
    } finally { setBusy(false); }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900">Document Intelligence</h1>
      <p className="text-sm text-gray-500 mt-1">Add a document — LifeNavigator extracts the facts and tracks what's missing. Nothing is invented.</p>

      {/* Upload / paste */}
      <div className="mt-5 bg-white rounded-lg shadow-md p-5">
        <div className="flex gap-2 items-center">
          <select value={docType} onChange={(e) => setDocType(e.target.value)} className="border border-gray-300 rounded-md px-3 py-2 text-sm">
            {DOC_TYPES.map(([v, l]) => (<option key={v} value={v}>{l}</option>))}
          </select>
          <button onClick={submit} disabled={busy} className="px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium disabled:opacity-50">
            {busy ? 'Reading…' : 'Extract'}
          </button>
        </div>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5}
          placeholder="Paste the document text (e.g. Base Salary: $185,000  Start Date: 2026-08-01 …)"
          className="mt-3 w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-mono" />
        {result && (
          <div className="mt-3 border-l-4 border-emerald-500 pl-3">
            <div className="text-sm text-gray-700">Extracted <b>{result.fields_extracted}</b> fields ({Math.round(result.confidence * 100)}% confidence) · feeds {result.affects_domains.join(', ')}</div>
            <div className="mt-1 flex flex-wrap gap-1">
              {result.fields.map((f) => (<span key={f.field_key} className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">{f.field_key.replace(/_/g, ' ')}: {f.field_value}</span>))}
            </div>
          </div>
        )}
      </div>

      {/* Readiness */}
      {r && (
        <div className="mt-6">
          <div className="flex items-center gap-3">
            <div className={`w-14 h-14 rounded-full ${COLOR[r.overall_status]} flex items-center justify-center text-white font-bold`}>{r.overall_score}</div>
            <div>
              <div className="font-semibold text-gray-900">Document Readiness</div>
              <div className="text-sm text-gray-500">{r.documents_on_file} document(s) on file</div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {r.categories.map((c) => (
              <div key={c.category} className="bg-white rounded-lg shadow-md p-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-800 capitalize">{c.category.replace(/_/g, ' ')}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full text-white ${COLOR[c.status]}`}>{c.have}/{c.critical}</span>
                </div>
                {c.missing.length > 0 && <div className="text-xs text-gray-500 mt-1">Missing: {c.missing.join(', ')}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
