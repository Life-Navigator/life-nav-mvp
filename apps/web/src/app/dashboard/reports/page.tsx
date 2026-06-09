'use client';

// Reports hub (Sprint 23) — one place to generate a branded, cited report and download it.
// Every report is built from your documents + readiness; reproducible (same inputs → same hash).

import React from 'react';

const REPORTS = [
  {
    type: 'full',
    title: 'Full Life Report',
    desc: 'Your complete picture across finance, family, career, education, and decisions.',
  },
  {
    type: 'financial',
    title: 'Financial Report',
    desc: 'Your position, trends, and recommendations — with progress over time.',
  },
  {
    type: 'compensation',
    title: 'Compensation & Benefits',
    desc: 'The true value of your offer: total comp, 5-year value, FSA/HSA optimization.',
  },
  {
    type: 'family',
    title: 'Family & Protection',
    desc: 'Protection gaps, readiness, and college funding — what protects your family.',
  },
  {
    type: 'decision',
    title: 'Decision Report',
    desc: 'Your analyzed life decisions with scenarios and cited evidence.',
  },
  {
    type: 'education',
    title: 'Education Report',
    desc: 'Programs ranked against your goals, with ROI and a branded comparison.',
  },
];

export default function ReportsPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
      <p className="text-sm text-gray-500 mt-1">
        Generate a polished, cited report you can download or share with an advisor. Built from your
        documents and readiness — every figure traces to its source.
      </p>
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        {REPORTS.map((r) => (
          <div key={r.type} className="bg-white rounded-lg shadow-md p-5 flex flex-col">
            <h2 className="font-semibold text-gray-900">{r.title}</h2>
            <p className="text-sm text-gray-500 mt-1 flex-grow">{r.desc}</p>
            <a
              href={`/api/reports/${r.type}/pdf`}
              className="mt-3 inline-flex w-fit items-center px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
            >
              Generate &amp; download PDF →
            </a>
          </div>
        ))}
      </div>
      <p className="mt-6 text-xs text-gray-400">
        Reports are reproducible — the same inputs always produce the same report. To share a
        redacted view with an advisor, CPA, or family member, open a report and use Share.
      </p>
    </div>
  );
}
