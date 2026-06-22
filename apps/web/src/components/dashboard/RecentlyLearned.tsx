'use client';

import { useEffect, useState } from 'react';

type Fact = {
  id: string;
  label: string;
  value: string;
  domain: string;
  docType?: string | null;
  documentId?: string | null;
  confidence: number;
  needsConfirmation: boolean;
  updatedAt?: string | null;
};

// Format clearly money-like values as currency ($185,000) without mis-formatting non-money facts.
// Only applies when the label/fact looks monetary AND the value is a plain number >= 1000.
const MONEY_HINT =
  /salary|bonus|coverage|premium|amount|value|income|equity|balance|net.?worth|grant|benefit|cost|contribution/i;
function fmtValue(label: string, value: string): string {
  const raw = String(value ?? '').trim();
  if (MONEY_HINT.test(label) && /^\d[\d,]*(\.\d+)?$/.test(raw)) {
    const n = Number(raw.replace(/,/g, ''));
    if (!Number.isNaN(n) && n >= 1000) {
      return n.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
      });
    }
  }
  return raw;
}

const DOMAIN_STYLE: Record<string, string> = {
  family: 'bg-rose-50 text-rose-700',
  career: 'bg-blue-50 text-blue-700',
  education: 'bg-violet-50 text-violet-700',
  finance: 'bg-emerald-50 text-emerald-700',
  health: 'bg-teal-50 text-teal-700',
  core: 'bg-slate-100 text-slate-700',
};

/**
 * "Recently learned about you" — surfaces extracted document facts (life.facts) so the user SEES what
 * the platform learned from their uploads, not just that "N documents are on file". 100% real data
 * from /api/life/facts (confirmed/inferred only; inferred flagged "pending confirmation"); each fact
 * names its source document. Renders nothing until there's something real to show (enrichment strip,
 * not a placeholder) — no fabrication, no dead end.
 */
export default function RecentlyLearned() {
  const [facts, setFacts] = useState<Fact[] | null>(null);

  useEffect(() => {
    let on = true;
    fetch('/api/life/facts?limit=8', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { facts: [] }))
      .then((d) => {
        if (on) setFacts(Array.isArray(d?.facts) ? d.facts : []);
      })
      .catch(() => {
        if (on) setFacts([]);
      });
    return () => {
      on = false;
    };
  }, []);

  if (facts === null || facts.length === 0) return null;

  return (
    <section
      className="rounded-xl border border-slate-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800"
      aria-label="Recently learned about you"
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-gray-100">
          Recently learned about you
        </h2>
        <span className="text-xs text-slate-500 dark:text-gray-400">from your documents</span>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {facts.map((f) => (
          <li
            key={f.id}
            className="flex items-start gap-2 rounded-lg border border-slate-100 px-3 py-2 dark:border-gray-700"
          >
            <span
              className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${
                DOMAIN_STYLE[f.domain] ?? DOMAIN_STYLE.core
              }`}
            >
              {f.domain}
            </span>
            <div className="min-w-0">
              <div className="text-sm text-slate-900 dark:text-gray-100">
                <span className="font-medium">{f.label}:</span> {fmtValue(f.label, f.value)}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-gray-400">
                {f.docType ? `from your ${f.docType.replace(/_/g, ' ')}` : 'from a document'}
                {f.needsConfirmation ? ' · pending your confirmation' : ''}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
