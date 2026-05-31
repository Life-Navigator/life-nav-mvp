'use client';

import React, { useState } from 'react';
import SectionShell from '@/components/onboarding/SectionShell';

interface HealthPayload {
  height_cm?: number | null;
  weight_kg?: number | null;
  target_weight_kg?: number | null;
  activity_level?: string | null;
  sessions_per_week_target?: number | null;
  gym_access?: boolean;
  swimming_access?: boolean;
  sleep_hours?: number | null;
  energy_score?: number | null;
  stress_score?: number | null;
  daily_calorie_target?: number | null;
  protein_target_g?: number | null;
}

function num(v: number | null | undefined): string {
  return v === null || v === undefined ? '' : String(v);
}

export default function Page() {
  const [data, setData] = useState<HealthPayload>({});
  const [saving, setSaving] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);

  const onSave = async () => {
    setSaving(true);
    setWarning(null);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const body = {
        training_profile: {
          activity_level: data.activity_level ?? null,
          sessions_per_week_target: data.sessions_per_week_target ?? null,
          gym_access: data.gym_access ?? null,
          swimming_access: data.swimming_access ?? null,
        },
        body_measurements: {
          height_cm: data.height_cm ?? null,
          weight_kg: data.weight_kg ?? null,
          target_weight_kg: data.target_weight_kg ?? null,
        },
        daily_wellbeing: {
          observed_on: today,
          sleep_hours: data.sleep_hours ?? null,
          energy_score: data.energy_score ?? null,
          stress_score: data.stress_score ?? null,
        },
        nutrition_profile: {
          daily_calorie_target: data.daily_calorie_target ?? null,
          protein_target_g: data.protein_target_g ?? null,
        },
        source: 'onboarding',
      };

      const res = await fetch('/api/onboarding/health-intake', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await res.json();
      if (!res.ok || result?.success === false) {
        // Health tables are gated by is_health_enabled(). The route
        // returns the underlying error verbatim — surface a friendly note.
        setWarning(
          'Health & wellness storage is currently locked. Your responses are validated and ready — they will persist as soon as the health feature is enabled.'
        );
      }

      await fetch('/api/onboarding/sections', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section: 'health_wellness',
          status: 'completed',
          fields_captured: { feature_locked: !res.ok || result?.success === false },
        }),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <SectionShell
      title="Health & Wellness"
      description="Body, training, sleep, and nutrition basics. This becomes the foundation for the Arcana Health lead package when you opt in."
      onSave={onSave}
      saving={saving}
    >
      {warning && (
        <div className="rounded border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/30 p-3 text-sm text-amber-800 dark:text-amber-200">
          {warning}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
        <label>
          <span className="block text-gray-700 dark:text-gray-200 mb-1">Height (cm)</span>
          <input
            type="number"
            value={num(data.height_cm)}
            onChange={(e) =>
              setData((d) => ({
                ...d,
                height_cm: e.target.value === '' ? null : Number(e.target.value),
              }))
            }
            className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2"
          />
        </label>
        <label>
          <span className="block text-gray-700 dark:text-gray-200 mb-1">Weight (kg)</span>
          <input
            type="number"
            value={num(data.weight_kg)}
            onChange={(e) =>
              setData((d) => ({
                ...d,
                weight_kg: e.target.value === '' ? null : Number(e.target.value),
              }))
            }
            className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2"
          />
        </label>
        <label>
          <span className="block text-gray-700 dark:text-gray-200 mb-1">Target weight (kg)</span>
          <input
            type="number"
            value={num(data.target_weight_kg)}
            onChange={(e) =>
              setData((d) => ({
                ...d,
                target_weight_kg: e.target.value === '' ? null : Number(e.target.value),
              }))
            }
            className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2"
          />
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm pt-4 border-t border-gray-200 dark:border-gray-700">
        <label>
          <span className="block text-gray-700 dark:text-gray-200 mb-1">Activity level</span>
          <select
            value={data.activity_level ?? ''}
            onChange={(e) => setData((d) => ({ ...d, activity_level: e.target.value || null }))}
            className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2"
          >
            <option value="">—</option>
            <option value="sedentary">Sedentary</option>
            <option value="lightly_active">Lightly active</option>
            <option value="moderately_active">Moderately active</option>
            <option value="very_active">Very active</option>
            <option value="athlete">Athlete</option>
          </select>
        </label>
        <label>
          <span className="block text-gray-700 dark:text-gray-200 mb-1">
            Sessions / week target
          </span>
          <input
            type="number"
            min={0}
            max={14}
            value={num(data.sessions_per_week_target)}
            onChange={(e) =>
              setData((d) => ({
                ...d,
                sessions_per_week_target: e.target.value === '' ? null : Number(e.target.value),
              }))
            }
            className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2"
          />
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={!!data.gym_access}
            onChange={(e) => setData((d) => ({ ...d, gym_access: e.target.checked }))}
          />
          Gym access
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={!!data.swimming_access}
            onChange={(e) => setData((d) => ({ ...d, swimming_access: e.target.checked }))}
          />
          Swimming access
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm pt-4 border-t border-gray-200 dark:border-gray-700">
        <label>
          <span className="block text-gray-700 dark:text-gray-200 mb-1">Sleep hours / night</span>
          <input
            type="number"
            step={0.5}
            value={num(data.sleep_hours)}
            onChange={(e) =>
              setData((d) => ({
                ...d,
                sleep_hours: e.target.value === '' ? null : Number(e.target.value),
              }))
            }
            className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2"
          />
        </label>
        <label>
          <span className="block text-gray-700 dark:text-gray-200 mb-1">Energy (0–10)</span>
          <input
            type="number"
            min={0}
            max={10}
            value={num(data.energy_score)}
            onChange={(e) =>
              setData((d) => ({
                ...d,
                energy_score: e.target.value === '' ? null : Number(e.target.value),
              }))
            }
            className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2"
          />
        </label>
        <label>
          <span className="block text-gray-700 dark:text-gray-200 mb-1">Stress (0–10)</span>
          <input
            type="number"
            min={0}
            max={10}
            value={num(data.stress_score)}
            onChange={(e) =>
              setData((d) => ({
                ...d,
                stress_score: e.target.value === '' ? null : Number(e.target.value),
              }))
            }
            className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2"
          />
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm pt-4 border-t border-gray-200 dark:border-gray-700">
        <label>
          <span className="block text-gray-700 dark:text-gray-200 mb-1">Daily calorie target</span>
          <input
            type="number"
            value={num(data.daily_calorie_target)}
            onChange={(e) =>
              setData((d) => ({
                ...d,
                daily_calorie_target: e.target.value === '' ? null : Number(e.target.value),
              }))
            }
            className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2"
          />
        </label>
        <label>
          <span className="block text-gray-700 dark:text-gray-200 mb-1">Protein target (g)</span>
          <input
            type="number"
            value={num(data.protein_target_g)}
            onChange={(e) =>
              setData((d) => ({
                ...d,
                protein_target_g: e.target.value === '' ? null : Number(e.target.value),
              }))
            }
            className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2"
          />
        </label>
      </div>
    </SectionShell>
  );
}
