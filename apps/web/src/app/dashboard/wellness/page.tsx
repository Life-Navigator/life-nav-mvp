'use client';

// Health & Wellness — render-only view of the Core API Health DomainViewModel
// (via /api/health/summary). Wellness guidance only; never medical advice. No fake
// data: absent metrics render as missing-data prompts, not zeros. No internals
// (Qdrant/Neo4j/GraphRAG/worker) are ever shown.

import React, { useEffect, useState } from 'react';

interface Boundary {
  boundary_type: string;
  disclaimer_text: string;
  escalation_path?: string;
}
interface HealthRec {
  id: string;
  title: string;
  why_it_matters: string;
  evidence: { statement: string }[];
  assumptions: string[];
  priority: 'high' | 'medium' | 'low';
}
interface HealthVM {
  domain: string;
  data: {
    avg_sleep_hours: number | null;
    target_sleep_hours: number;
    avg_daily_steps: number | null;
    nights_logged: number;
    safety_boundaries: Boundary[];
  };
  recommendations: HealthRec[];
  missing: string[];
  freshness: { as_of?: string };
  confidence: { score: number; basis: string };
}

const PROMPT_COPY: Record<string, { title: string; body: string }> = {
  sleep_logs: {
    title: 'Add your sleep',
    body: 'Log or connect sleep to get wellness coaching grounded in your real data.',
  },
  activity_logs: {
    title: 'Add your activity',
    body: 'Log activity or workouts to see consistency coaching grounded in your data.',
  },
  nutrition_logs: {
    title: 'Add your nutrition',
    body: 'Log meals to unlock nutrition-consistency coaching grounded in your data.',
  },
};

export default function WellnessPage() {
  const [vm, setVm] = useState<HealthVM | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch('/api/health/summary')
      .then(async (r) => (r.ok ? ((await r.json()) as HealthVM) : null))
      .then((data) => {
        if (active) {
          setVm(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setVm(null);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const boundary = vm?.data.safety_boundaries?.[0];
  const sleep = vm?.data.avg_sleep_hours ?? null;
  const steps = vm?.data.avg_daily_steps ?? null;
  const missing = vm?.missing ?? [];

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900">Health &amp; Wellness</h1>
      <p className="text-sm text-gray-500 mt-1">Wellness coaching grounded in your own data.</p>

      {/* Medical safety posture — always visible */}
      <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        {boundary?.disclaimer_text ??
          'General wellness guidance, not medical advice. Consult a licensed clinician for medical concerns.'}
      </div>

      {loading ? (
        <div className="mt-8 text-gray-500">Loading your wellness summary…</div>
      ) : (
        <>
          {/* Summary tiles — absent values become prompts, never fake numbers */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-lg font-semibold text-gray-700">Sleep</h2>
              {sleep != null ? (
                <>
                  <div className="text-2xl font-bold text-gray-900 mt-2">{sleep}h avg</div>
                  <div className="text-sm text-gray-500 mt-1">
                    Target {vm?.data.target_sleep_hours}h · {vm?.data.nights_logged} nights logged
                  </div>
                </>
              ) : (
                <Prompt field="sleep_logs" />
              )}
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-lg font-semibold text-gray-700">Activity</h2>
              {steps != null ? (
                <div className="text-2xl font-bold text-gray-900 mt-2">
                  {steps.toLocaleString()} steps/day
                </div>
              ) : (
                <Prompt field="activity_logs" />
              )}
            </div>
          </div>

          {/* Evidence-backed recommendations only */}
          {vm && vm.recommendations.length > 0 && (
            <div className="mt-8 bg-white p-6 rounded-lg shadow-md">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Recommended next moves</h2>
              <div className="space-y-4">
                {vm.recommendations.map((rec) => (
                  <div key={rec.id} className="border-l-4 border-emerald-600 pl-4 py-2">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-gray-900">{rec.title}</h3>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                        {rec.priority}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{rec.why_it_matters}</p>
                    {rec.evidence.length > 0 && (
                      <ul className="list-disc list-inside text-sm text-gray-700 mt-2">
                        {rec.evidence.map((e, i) => (
                          <li key={i}>{e.statement}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Remaining missing-data prompts */}
          {missing.length > 0 && (
            <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
              {missing.map((field) => (
                <div key={field} className="bg-white p-5 rounded-lg shadow-md text-center">
                  <Prompt field={field} />
                </div>
              ))}
            </div>
          )}

          {vm && (
            <div className="mt-8 text-xs text-gray-400">
              Confidence: {vm.confidence.basis}
              {vm.freshness.as_of
                ? ` · as of ${new Date(vm.freshness.as_of).toLocaleDateString()}`
                : ''}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Prompt({ field }: { field: string }) {
  const copy = PROMPT_COPY[field] ?? {
    title: `Add your ${field.replace(/_/g, ' ').replace(' logs', '')}`,
    body: 'Add your wellness data to unlock grounded coaching.',
  };
  return (
    <div className="text-center py-2">
      <p className="font-medium text-gray-700">{copy.title}</p>
      <p className="text-sm text-gray-500 mt-1">{copy.body}</p>
    </div>
  );
}
