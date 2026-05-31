'use client';

import React, { useEffect, useState } from 'react';
import SectionShell from '../SectionShell';
import type { InsurancePlanInput, InsurancePlanType } from '@/types/intake';

const PLAN_TYPES: { value: InsurancePlanType; label: string }[] = [
  { value: 'medical', label: 'Medical' },
  { value: 'dental', label: 'Dental' },
  { value: 'vision', label: 'Vision' },
  { value: 'pharmacy', label: 'Pharmacy' },
  { value: 'mental_health', label: 'Mental health' },
  { value: 'long_term_disability', label: 'Long-term disability' },
  { value: 'short_term_disability', label: 'Short-term disability' },
  { value: 'life', label: 'Life' },
  { value: 'accident', label: 'Accident' },
  { value: 'critical_illness', label: 'Critical illness' },
  { value: 'auto', label: 'Auto' },
  { value: 'home', label: 'Home' },
  { value: 'renters', label: 'Renters' },
  { value: 'umbrella', label: 'Umbrella' },
  { value: 'pet', label: 'Pet' },
  { value: 'other', label: 'Other' },
];

const emptyPlan = (): InsurancePlanInput => ({
  plan_type: 'medical',
  carrier: '',
  plan_name: '',
  member_id: '',
  group_number: '',
  is_primary: false,
});

function num(v: number | null | undefined): string {
  return v === null || v === undefined ? '' : String(v);
}

export default function InsuranceSection() {
  const [plans, setPlans] = useState<InsurancePlanInput[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/onboarding/insurance')
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (body?.plans?.length) {
          // Server response excludes encrypted fields — present them as blank
          setPlans(
            body.plans.map((p: any) => ({
              plan_type: p.plan_type,
              carrier: p.carrier ?? '',
              plan_name: p.plan_name ?? '',
              is_primary: !!p.is_primary,
              source_of_coverage: p.source_of_coverage,
              monthly_premium: p.monthly_premium,
              annual_deductible: p.annual_deductible,
              out_of_pocket_max: p.out_of_pocket_max,
              copay_primary_care: p.copay_primary_care,
              copay_specialist: p.copay_specialist,
              copay_er: p.copay_er,
              copay_urgent_care: p.copay_urgent_care,
              coinsurance_percent: p.coinsurance_percent,
              hsa_eligible: p.hsa_eligible,
              fsa_eligible: p.fsa_eligible,
              hra_eligible: p.hra_eligible,
              network_type: p.network_type,
            }))
          );
        }
      });
  }, []);

  const addPlan = () => setPlans((p) => [...p, emptyPlan()]);
  const update = (i: number, patch: Partial<InsurancePlanInput>) =>
    setPlans((p) => p.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  const remove = (i: number) => setPlans((p) => p.filter((_, idx) => idx !== i));

  const onSave = async () => {
    setSaving(true);
    try {
      const useful = plans.filter((p) => p.carrier || p.plan_name || p.member_id);
      if (useful.length > 0) {
        await fetch('/api/onboarding/insurance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ plans: useful, source: 'onboarding' }),
        });
      }
      await fetch('/api/onboarding/sections', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section: 'insurance_benefits',
          status: 'completed',
          fields_captured: { plan_count: useful.length },
        }),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <SectionShell
      title="Insurance & Benefits"
      description="Add the plans that cover you today. Member IDs and group numbers are encrypted at rest with AES-256."
      onSave={onSave}
      saving={saving}
    >
      <div className="flex justify-end">
        <button type="button" onClick={addPlan} className="text-sm text-blue-600 hover:underline">
          + Add a plan
        </button>
      </div>

      {plans.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400 italic">
          No plans yet. Click "Add a plan" to start.
        </p>
      )}

      <ul className="space-y-4">
        {plans.map((p, i) => (
          <li key={i} className="border border-gray-200 dark:border-gray-700 rounded p-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase font-semibold text-gray-500">Plan #{i + 1}</span>
              <button
                type="button"
                onClick={() => remove(i)}
                className="text-xs text-red-600 hover:underline"
              >
                Remove
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              <label>
                <span className="block text-gray-700 dark:text-gray-200 mb-1">Plan type</span>
                <select
                  value={p.plan_type}
                  onChange={(e) => update(i, { plan_type: e.target.value as InsurancePlanType })}
                  className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2"
                >
                  {PLAN_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="block text-gray-700 dark:text-gray-200 mb-1">Carrier</span>
                <input
                  type="text"
                  value={p.carrier ?? ''}
                  onChange={(e) => update(i, { carrier: e.target.value })}
                  className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2"
                />
              </label>
              <label>
                <span className="block text-gray-700 dark:text-gray-200 mb-1">Plan name</span>
                <input
                  type="text"
                  value={p.plan_name ?? ''}
                  onChange={(e) => update(i, { plan_name: e.target.value })}
                  className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2"
                />
              </label>
              <label>
                <span className="block text-gray-700 dark:text-gray-200 mb-1">
                  Source of coverage
                </span>
                <select
                  value={p.source_of_coverage ?? ''}
                  onChange={(e) =>
                    update(i, {
                      source_of_coverage: (e.target.value ||
                        null) as InsurancePlanInput['source_of_coverage'],
                    })
                  }
                  className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2"
                >
                  <option value="">—</option>
                  <option value="employer">Employer</option>
                  <option value="marketplace">Marketplace</option>
                  <option value="medicare">Medicare</option>
                  <option value="medicaid">Medicaid</option>
                  <option value="va">VA</option>
                  <option value="private">Private</option>
                </select>
              </label>
              <label>
                <span className="block text-gray-700 dark:text-gray-200 mb-1">
                  Member ID (encrypted on save)
                </span>
                <input
                  type="text"
                  value={p.member_id ?? ''}
                  onChange={(e) => update(i, { member_id: e.target.value })}
                  className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2 font-mono"
                />
              </label>
              <label>
                <span className="block text-gray-700 dark:text-gray-200 mb-1">
                  Group number (encrypted on save)
                </span>
                <input
                  type="text"
                  value={p.group_number ?? ''}
                  onChange={(e) => update(i, { group_number: e.target.value })}
                  className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2 font-mono"
                />
              </label>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
              <label>
                <span className="block text-gray-700 dark:text-gray-200 mb-1">Monthly premium</span>
                <input
                  type="number"
                  value={num(p.monthly_premium)}
                  onChange={(e) =>
                    update(i, {
                      monthly_premium: e.target.value === '' ? null : Number(e.target.value),
                    })
                  }
                  className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2"
                />
              </label>
              <label>
                <span className="block text-gray-700 dark:text-gray-200 mb-1">Deductible</span>
                <input
                  type="number"
                  value={num(p.annual_deductible)}
                  onChange={(e) =>
                    update(i, {
                      annual_deductible: e.target.value === '' ? null : Number(e.target.value),
                    })
                  }
                  className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2"
                />
              </label>
              <label>
                <span className="block text-gray-700 dark:text-gray-200 mb-1">OOP max</span>
                <input
                  type="number"
                  value={num(p.out_of_pocket_max)}
                  onChange={(e) =>
                    update(i, {
                      out_of_pocket_max: e.target.value === '' ? null : Number(e.target.value),
                    })
                  }
                  className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2"
                />
              </label>
              <label>
                <span className="block text-gray-700 dark:text-gray-200 mb-1">Coinsurance %</span>
                <input
                  type="number"
                  value={num(p.coinsurance_percent)}
                  onChange={(e) =>
                    update(i, {
                      coinsurance_percent: e.target.value === '' ? null : Number(e.target.value),
                    })
                  }
                  className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2"
                />
              </label>
            </div>

            <div className="flex flex-wrap gap-3 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={!!p.hsa_eligible}
                  onChange={(e) => update(i, { hsa_eligible: e.target.checked })}
                />
                HSA eligible
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={!!p.fsa_eligible}
                  onChange={(e) => update(i, { fsa_eligible: e.target.checked })}
                />
                FSA eligible
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={!!p.hra_eligible}
                  onChange={(e) => update(i, { hra_eligible: e.target.checked })}
                />
                HRA eligible
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={!!p.is_primary}
                  onChange={(e) => update(i, { is_primary: e.target.checked })}
                />
                Primary plan
              </label>
            </div>
          </li>
        ))}
      </ul>
    </SectionShell>
  );
}
