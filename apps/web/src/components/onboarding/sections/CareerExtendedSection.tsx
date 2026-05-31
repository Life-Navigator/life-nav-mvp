'use client';

import React, { useEffect, useState } from 'react';
import SectionShell from '../SectionShell';
import type { CareerExtendedInput } from '@/types/intake';

function num(v: number | null | undefined): string {
  return v === null || v === undefined ? '' : String(v);
}

export default function CareerExtendedSection() {
  const [data, setData] = useState<CareerExtendedInput>({});
  const [skillInput, setSkillInput] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/onboarding/career-extended')
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => body?.extended && setData(body.extended));
  }, []);

  const onSave = async () => {
    setSaving(true);
    try {
      await fetch('/api/onboarding/career-extended', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      await fetch('/api/onboarding/sections', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section: 'career',
          status: 'completed',
          fields_captured: { skill_gaps_count: (data.skill_gaps ?? []).length },
        }),
      });
    } finally {
      setSaving(false);
    }
  };

  const addSkillGap = () => {
    const v = skillInput.trim();
    if (!v) return;
    setData((d) => ({ ...d, skill_gaps: [...(d.skill_gaps ?? []), v] }));
    setSkillInput('');
  };
  const removeSkillGap = (i: number) =>
    setData((d) => ({
      ...d,
      skill_gaps: (d.skill_gaps ?? []).filter((_, idx) => idx !== i),
    }));

  return (
    <SectionShell
      title="Career (extended)"
      description="Where you are, where you want to go, and what you'd need to get there."
      onSave={onSave}
      saving={saving}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <label>
          <span className="block text-gray-700 dark:text-gray-200 mb-1">Current income</span>
          <input
            type="number"
            value={num(data.current_income)}
            onChange={(e) =>
              setData((d) => ({
                ...d,
                current_income: e.target.value === '' ? null : Number(e.target.value),
              }))
            }
            className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2"
          />
        </label>
        <label>
          <span className="block text-gray-700 dark:text-gray-200 mb-1">Income trajectory</span>
          <select
            value={data.income_trajectory ?? ''}
            onChange={(e) =>
              setData((d) => ({
                ...d,
                income_trajectory: (e.target.value ||
                  null) as CareerExtendedInput['income_trajectory'],
              }))
            }
            className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2"
          >
            <option value="">—</option>
            <option value="declining">Declining</option>
            <option value="stable">Stable</option>
            <option value="growing">Growing</option>
            <option value="rapidly_growing">Rapidly growing</option>
          </select>
        </label>
        <label>
          <span className="block text-gray-700 dark:text-gray-200 mb-1">Promotion target</span>
          <input
            type="text"
            value={data.promotion_target ?? ''}
            onChange={(e) => setData((d) => ({ ...d, promotion_target: e.target.value }))}
            className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2"
          />
        </label>
        <label>
          <span className="block text-gray-700 dark:text-gray-200 mb-1">Target income</span>
          <input
            type="number"
            value={num(data.target_income)}
            onChange={(e) =>
              setData((d) => ({
                ...d,
                target_income: e.target.value === '' ? null : Number(e.target.value),
              }))
            }
            className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2"
          />
        </label>
        <label>
          <span className="block text-gray-700 dark:text-gray-200 mb-1">
            Hours / week for upskilling
          </span>
          <input
            type="number"
            min={0}
            max={168}
            value={num(data.time_for_upskilling_hours_per_week)}
            onChange={(e) =>
              setData((d) => ({
                ...d,
                time_for_upskilling_hours_per_week:
                  e.target.value === '' ? null : Number(e.target.value),
              }))
            }
            className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2"
          />
        </label>
        <label>
          <span className="block text-gray-700 dark:text-gray-200 mb-1">
            Job-change willingness
          </span>
          <select
            value={data.job_change_willingness ?? ''}
            onChange={(e) =>
              setData((d) => ({
                ...d,
                job_change_willingness: (e.target.value ||
                  null) as CareerExtendedInput['job_change_willingness'],
              }))
            }
            className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2"
          >
            <option value="">—</option>
            <option value="not_open">Not open</option>
            <option value="passive">Passively curious</option>
            <option value="active">Active</option>
            <option value="actively_searching">Actively searching</option>
          </select>
        </label>
        <label>
          <span className="block text-gray-700 dark:text-gray-200 mb-1">
            Entrepreneurial interest
          </span>
          <select
            value={data.entrepreneurial_interest ?? ''}
            onChange={(e) =>
              setData((d) => ({
                ...d,
                entrepreneurial_interest: (e.target.value ||
                  null) as CareerExtendedInput['entrepreneurial_interest'],
              }))
            }
            className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2"
          >
            <option value="">—</option>
            <option value="none">None</option>
            <option value="curious">Curious</option>
            <option value="side_hustle">Side hustle</option>
            <option value="committed">Committed</option>
            <option value="currently_running">Currently running one</option>
          </select>
        </label>
        <label>
          <span className="block text-gray-700 dark:text-gray-200 mb-1">Networking capacity</span>
          <select
            value={data.networking_capacity ?? ''}
            onChange={(e) =>
              setData((d) => ({
                ...d,
                networking_capacity: (e.target.value ||
                  null) as CareerExtendedInput['networking_capacity'],
              }))
            }
            className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2"
          >
            <option value="">—</option>
            <option value="very_low">Very low</option>
            <option value="low">Low</option>
            <option value="moderate">Moderate</option>
            <option value="high">High</option>
            <option value="very_high">Very high</option>
          </select>
        </label>
        <label>
          <span className="block text-gray-700 dark:text-gray-200 mb-1">
            Relocation willingness
          </span>
          <select
            value={data.relocation_willingness ?? ''}
            onChange={(e) =>
              setData((d) => ({
                ...d,
                relocation_willingness: (e.target.value ||
                  null) as CareerExtendedInput['relocation_willingness'],
              }))
            }
            className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2"
          >
            <option value="">—</option>
            <option value="not_willing">Not willing</option>
            <option value="regional_only">Regional only</option>
            <option value="national">National</option>
            <option value="international">International</option>
          </select>
        </label>
      </div>

      <div className="pt-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
        <label className="block text-sm text-gray-700 dark:text-gray-200">
          Skill gaps you'd like to close
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={skillInput}
            onChange={(e) => setSkillInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addSkillGap();
              }
            }}
            placeholder="e.g. financial modeling"
            className="flex-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2 text-sm"
          />
          <button
            type="button"
            onClick={addSkillGap}
            className="px-3 py-1 text-sm rounded bg-blue-600 hover:bg-blue-700 text-white"
          >
            Add
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {(data.skill_gaps ?? []).map((s, i) => (
            <span
              key={`${s}-${i}`}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200"
            >
              {s}
              <button
                type="button"
                onClick={() => removeSkillGap(i)}
                className="text-red-600 hover:underline"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      </div>
    </SectionShell>
  );
}
