'use client';

// Real domain reports — each links to the WORKING report pipeline (/api/reports/{type}/pdf →
// Core API → WeasyPrint branded PDF). No placeholders: every listed report actually generates.
import { useState } from 'react';

export interface DomainReportItem {
  type: string; // 'compensation' | 'education' | 'family' | 'financial' | 'full' | …
  title: string;
  description: string;
}

export function DomainReports({
  heading,
  reports,
  note,
}: {
  heading: string;
  reports: DomainReportItem[];
  note?: string;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const download = async (item: DomainReportItem) => {
    setBusy(item.type);
    setErr(null);
    try {
      const res = await fetch(`/api/reports/${item.type}/pdf`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `lifenavigator-${item.type}-report.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setErr(`We couldn't generate the ${item.title} just now — please try again.`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4 p-6">
      <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{heading}</h2>
      {note && <p className="text-sm text-gray-600 dark:text-gray-300">{note}</p>}
      {err && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
          {err}
        </div>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        {reports.map((r) => (
          <div
            key={r.type}
            className="flex flex-col justify-between rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"
          >
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">{r.title}</h3>
              <p className="mt-1 text-sm text-gray-500">{r.description}</p>
            </div>
            <button
              onClick={() => download(r)}
              disabled={busy === r.type}
              className="mt-3 inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {busy === r.type ? 'Generating…' : 'Generate & download PDF →'}
            </button>
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-400">
        Reports are generated on demand from your real data, with cited sources. Missing inputs
        render as honest gaps — never fabricated numbers.
      </p>
    </div>
  );
}
