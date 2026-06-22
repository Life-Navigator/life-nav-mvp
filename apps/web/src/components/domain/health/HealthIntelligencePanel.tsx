'use client';

// Health Intelligence panel — labs vs reference ranges (factual flag, never a diagnosis), supplements,
// medications, fitness, nutrition, readiness, action items — from GET /v1/health/intelligence
// (HealthIntelligenceService). Extracted from the former orphan /dashboard/health-intelligence page so it
// can be surfaced INSIDE the Health experience (the Analysis tab). Strict medical boundary; not medical advice.

import React, { useEffect, useState } from 'react';

interface Marker {
  marker: string;
  label: string;
  value: number;
  unit: string;
  ideal: string;
  flag: string;
}
interface HI {
  readiness: { status: string; score: number; in_place: string[]; missing: string[] };
  labs: { markers: Marker[]; tracked: number; within_range: number; status: string; note: string };
  supplements: { count: number; items: string[]; note: string };
  medications: { count: number; items: string[]; note: string };
  fitness: {
    has_plan: boolean;
    weekly_workouts: number | null;
    goal?: string;
    status: string;
    note: string;
  };
  nutrition: {
    has_log: boolean;
    daily_calories: number | null;
    protein_g: number | null;
    note: string;
  };
  action_items: string[];
  missing_documents: string[];
  boundary: { disclaimer_text: string };
}

export default function HealthIntelligencePanel() {
  const [d, setD] = useState<HI | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let on = true;
    fetch('/api/health/intelligence')
      .then(async (r) => (r.ok ? ((await r.json()) as HI) : null))
      .then((x) => {
        if (on) {
          setD(x);
          setLoading(false);
        }
      })
      .catch(() => {
        if (on) setLoading(false);
      });
    return () => {
      on = false;
    };
  }, []);
  if (loading) return <div className="py-6 text-gray-500">Reading your health documents…</div>;
  // Honest empty state — never fabricate health data.
  if (!d)
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-gray-500">
        Your Health Intelligence appears once you upload lab reports, a medication list, or a
        fitness/ nutrition plan — every value is read from your real documents, never invented.
      </div>
    );

  return (
    <div>
      <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800">
        {d.boundary.disclaimer_text}
      </div>

      {d.action_items.length > 0 && (
        <div className="mt-4 bg-white rounded-lg shadow-md p-5">
          <h2 className="font-semibold text-gray-800 mb-2">Action items</h2>
          <ul className="list-disc list-inside text-sm text-gray-700">
            {d.action_items.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 bg-white rounded-lg shadow-md p-5">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold text-gray-800">Lab Markers</h2>
          <span className="text-xs text-gray-400">
            {d.labs.within_range}/{d.labs.tracked} within range
          </span>
        </div>
        {d.labs.markers.length === 0 ? (
          <p className="text-sm text-gray-400">{d.labs.note}</p>
        ) : (
          <div className="space-y-1.5">
            {d.labs.markers.map((m) => (
              <div key={m.marker} className="flex items-center justify-between text-sm">
                <span className="text-gray-700">{m.label}</span>
                <span className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900">
                    {m.value} {m.unit}
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${m.flag === 'within_range' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}
                  >
                    {m.flag === 'within_range' ? 'in range' : `outside (${m.ideal})`}
                  </span>
                </span>
              </div>
            ))}
            <p className="text-xs text-gray-400 mt-2">{d.labs.note}</p>
          </div>
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card
          title={`Supplements (${d.supplements.count})`}
          items={d.supplements.items}
          note={d.supplements.note}
        />
        <Card
          title={`Medications (${d.medications.count})`}
          items={d.medications.items}
          note={d.medications.note}
        />
        <div className="bg-white rounded-lg shadow-md p-5">
          <h2 className="font-semibold text-gray-800 mb-1">Fitness</h2>
          {d.fitness.has_plan ? (
            <p className="text-sm text-gray-700">
              {d.fitness.weekly_workouts} workouts/wk{d.fitness.goal ? ` · ${d.fitness.goal}` : ''}
            </p>
          ) : (
            <p className="text-sm text-gray-400">{d.fitness.note}</p>
          )}
        </div>
        <div className="bg-white rounded-lg shadow-md p-5">
          <h2 className="font-semibold text-gray-800 mb-1">Nutrition</h2>
          {d.nutrition.has_log ? (
            <p className="text-sm text-gray-700">
              {d.nutrition.daily_calories} kcal/day · {d.nutrition.protein_g}g protein
            </p>
          ) : (
            <p className="text-sm text-gray-400">{d.nutrition.note}</p>
          )}
        </div>
      </div>

      {d.missing_documents.length > 0 && (
        <div className="mt-4 rounded-md border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-800">
          Upload to complete your health picture: {d.missing_documents.join(', ')}.
        </div>
      )}
    </div>
  );
}

function Card({ title, items, note }: { title: string; items: string[]; note: string }) {
  return (
    <div className="bg-white rounded-lg shadow-md p-5">
      <h2 className="font-semibold text-gray-800 mb-1">{title}</h2>
      {items.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {items.map((it, i) => (
            <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
              {it}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-400">{note}</p>
      )}
      {items.length > 0 && <p className="text-xs text-gray-400 mt-2">{note}</p>}
    </div>
  );
}
