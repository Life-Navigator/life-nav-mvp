'use client';

import React, { useEffect, useState } from 'react';
import SectionShell from '../SectionShell';
import type { FamilyLifestyleInput, FamilyProfileFieldsInput } from '@/types/intake';

const PRIORITY_OPTIONS = [
  'financial_security',
  'kids_education',
  'family_time',
  'career_growth',
  'health',
  'travel',
  'community',
  'creative_pursuits',
];

function num(v: number | null | undefined): string {
  return v === null || v === undefined ? '' : String(v);
}

export default function FamilyLifestyleSection() {
  const [lifestyle, setLifestyle] = useState<FamilyLifestyleInput>({});
  const [profileFields, setProfileFields] = useState<FamilyProfileFieldsInput>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/onboarding/family-lifestyle')
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (body?.profile) setLifestyle(body.profile);
        if (body?.profile_fields) setProfileFields(body.profile_fields);
      });
  }, []);

  const togglePriority = (p: string) => {
    setLifestyle((cur) => {
      const list = cur.household_priorities ?? [];
      return {
        ...cur,
        household_priorities: list.includes(p) ? list.filter((x) => x !== p) : [...list, p],
      };
    });
  };

  const onSave = async () => {
    setSaving(true);
    try {
      await fetch('/api/onboarding/family-lifestyle', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile: lifestyle,
          profile_fields: profileFields,
          source: 'onboarding',
        }),
      });
      await fetch('/api/onboarding/sections', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section: 'family_lifestyle',
          status: 'completed',
          fields_captured: {
            marital_status: profileFields.marital_status ?? null,
            dependents_count: profileFields.dependents_count ?? null,
          },
        }),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <SectionShell
      title="Family & Lifestyle"
      description="Marital status, dependents, caregiving load, geography, and household priorities."
      onSave={onSave}
      saving={saving}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <label>
          <span className="block text-gray-700 dark:text-gray-200 mb-1">Marital status</span>
          <select
            value={profileFields.marital_status ?? ''}
            onChange={(e) =>
              setProfileFields((p) => ({
                ...p,
                marital_status: (e.target.value ||
                  null) as FamilyProfileFieldsInput['marital_status'],
              }))
            }
            className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2"
          >
            <option value="">—</option>
            <option value="single">Single</option>
            <option value="partnered">Partnered</option>
            <option value="married">Married</option>
            <option value="separated">Separated</option>
            <option value="divorced">Divorced</option>
            <option value="widowed">Widowed</option>
            <option value="prefer_not_to_say">Prefer not to say</option>
          </select>
        </label>
        <label>
          <span className="block text-gray-700 dark:text-gray-200 mb-1">Dependents</span>
          <input
            type="number"
            min={0}
            value={num(profileFields.dependents_count)}
            onChange={(e) =>
              setProfileFields((p) => ({
                ...p,
                dependents_count: e.target.value === '' ? null : Number(e.target.value),
              }))
            }
            className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2"
          />
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm pt-4 border-t border-gray-200 dark:border-gray-700">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={!!lifestyle.has_elder_care_responsibilities}
            onChange={(e) =>
              setLifestyle((p) => ({ ...p, has_elder_care_responsibilities: e.target.checked }))
            }
          />
          I have elder-care responsibilities
        </label>
        <label>
          <span className="block text-gray-700 dark:text-gray-200 mb-1">
            Caregiving hours / week
          </span>
          <input
            type="number"
            min={0}
            value={num(lifestyle.caregiving_hours_per_week)}
            onChange={(e) =>
              setLifestyle((p) => ({
                ...p,
                caregiving_hours_per_week: e.target.value === '' ? null : Number(e.target.value),
              }))
            }
            className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2"
          />
        </label>
        <label>
          <span className="block text-gray-700 dark:text-gray-200 mb-1">
            Family financial obligations / month
          </span>
          <input
            type="number"
            min={0}
            value={num(lifestyle.family_financial_obligations_monthly)}
            onChange={(e) =>
              setLifestyle((p) => ({
                ...p,
                family_financial_obligations_monthly:
                  e.target.value === '' ? null : Number(e.target.value),
              }))
            }
            className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2"
          />
        </label>
        <label>
          <span className="block text-gray-700 dark:text-gray-200 mb-1">
            Willingness to relocate
          </span>
          <select
            value={lifestyle.willing_to_relocate ?? ''}
            onChange={(e) =>
              setLifestyle((p) => ({
                ...p,
                willing_to_relocate: (e.target.value ||
                  null) as FamilyLifestyleInput['willing_to_relocate'],
              }))
            }
            className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2"
          >
            <option value="">—</option>
            <option value="no">No</option>
            <option value="regional">Regional only</option>
            <option value="national">National</option>
            <option value="international">International</option>
          </select>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={!!lifestyle.must_stay_near_family}
            onChange={(e) =>
              setLifestyle((p) => ({ ...p, must_stay_near_family: e.target.checked }))
            }
          />
          Must stay near family
        </label>
        <label>
          <span className="block text-gray-700 dark:text-gray-200 mb-1">Travel target</span>
          <select
            value={lifestyle.travel_frequency_target ?? ''}
            onChange={(e) =>
              setLifestyle((p) => ({
                ...p,
                travel_frequency_target: (e.target.value ||
                  null) as FamilyLifestyleInput['travel_frequency_target'],
              }))
            }
            className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2"
          >
            <option value="">—</option>
            <option value="rarely">Rarely</option>
            <option value="occasional">Occasional</option>
            <option value="frequent">Frequent</option>
            <option value="extensive">Extensive</option>
          </select>
        </label>
        <label>
          <span className="block text-gray-700 dark:text-gray-200 mb-1">Travel budget / year</span>
          <input
            type="number"
            min={0}
            value={num(lifestyle.travel_budget_annual)}
            onChange={(e) =>
              setLifestyle((p) => ({
                ...p,
                travel_budget_annual: e.target.value === '' ? null : Number(e.target.value),
              }))
            }
            className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2"
          />
        </label>
      </div>

      <div className="pt-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
        <label className="block text-sm text-gray-700 dark:text-gray-200">
          Lifestyle goals (free text)
        </label>
        <textarea
          rows={3}
          value={lifestyle.lifestyle_goals ?? ''}
          onChange={(e) => setLifestyle((p) => ({ ...p, lifestyle_goals: e.target.value }))}
          className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2 text-sm"
        />
      </div>

      <div className="pt-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
        <label className="block text-sm text-gray-700 dark:text-gray-200">
          Household priorities (pick all that apply)
        </label>
        <div className="flex flex-wrap gap-2">
          {PRIORITY_OPTIONS.map((p) => {
            const active = lifestyle.household_priorities?.includes(p) ?? false;
            return (
              <button
                type="button"
                key={p}
                onClick={() => togglePriority(p)}
                className={`px-3 py-1 text-xs rounded-full border ${
                  active
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600'
                }`}
              >
                {p.replace(/_/g, ' ')}
              </button>
            );
          })}
        </div>
      </div>
    </SectionShell>
  );
}
