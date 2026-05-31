'use client';

import React, { useEffect, useState } from 'react';
import SectionShell from '../SectionShell';
import type {
  DebtInput,
  DebtType,
  FinancialProfileInput,
  FinancingPreferenceInput,
} from '@/types/intake';

const EMPTY_PROFILE: FinancialProfileInput = {};
const EMPTY_PREFS: FinancingPreferenceInput = {};

const EMPLOYMENT_OPTIONS: {
  value: NonNullable<FinancialProfileInput['employment_type']>;
  label: string;
}[] = [
  { value: 'w2_full_time', label: 'W-2 full time' },
  { value: 'w2_part_time', label: 'W-2 part time' },
  { value: 'self_employed', label: 'Self-employed' },
  { value: '1099_contractor', label: '1099 contractor' },
  { value: 'business_owner', label: 'Business owner' },
  { value: 'retired', label: 'Retired' },
  { value: 'student', label: 'Student' },
  { value: 'unemployed', label: 'Unemployed' },
  { value: 'other', label: 'Other' },
];

const DEBT_TYPES: { value: DebtType; label: string }[] = [
  { value: 'credit_card', label: 'Credit card' },
  { value: 'student_loan', label: 'Student loan' },
  { value: 'personal_loan', label: 'Personal loan' },
  { value: 'medical_debt', label: 'Medical debt' },
  { value: 'tax_debt', label: 'Tax debt' },
  { value: 'family_loan', label: 'Family loan' },
  { value: 'business_loan', label: 'Business loan' },
  { value: 'other', label: 'Other' },
];

function numField(v: number | null | undefined): string {
  return v === null || v === undefined ? '' : String(v);
}

export default function FinancialSection() {
  const [profile, setProfile] = useState<FinancialProfileInput>(EMPTY_PROFILE);
  const [prefs, setPrefs] = useState<FinancingPreferenceInput>(EMPTY_PREFS);
  const [debts, setDebts] = useState<DebtInput[]>([]);
  const [saving, setSaving] = useState(false);

  // Hydrate from server on mount so the user can come back and edit.
  useEffect(() => {
    (async () => {
      const [p, d] = await Promise.all([
        fetch('/api/onboarding/financial-profile').then((r) => (r.ok ? r.json() : null)),
        fetch('/api/onboarding/debts').then((r) => (r.ok ? r.json() : null)),
      ]);
      if (p?.profile) setProfile(p.profile);
      if (p?.preferences) setPrefs(p.preferences);
      if (d?.debts) {
        setDebts(
          d.debts.map((x: any) => ({
            debt_name: x.debt_name,
            debt_type: x.debt_type,
            lender: x.lender,
            original_amount: x.original_amount,
            current_balance: Number(x.current_balance ?? 0),
            interest_rate: x.interest_rate,
            minimum_payment: x.minimum_payment,
            payoff_strategy: x.payoff_strategy,
          }))
        );
      }
    })();
  }, []);

  const upd = (patch: Partial<FinancialProfileInput>) => setProfile((p) => ({ ...p, ...patch }));
  const updPrefs = (patch: Partial<FinancingPreferenceInput>) =>
    setPrefs((p) => ({ ...p, ...patch }));

  const addDebt = () =>
    setDebts((d) => [...d, { debt_name: '', debt_type: 'credit_card', current_balance: 0 }]);
  const updateDebt = (i: number, patch: Partial<DebtInput>) =>
    setDebts((d) => d.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  const removeDebt = (i: number) => setDebts((d) => d.filter((_, idx) => idx !== i));

  const onSave = async () => {
    setSaving(true);
    try {
      await fetch('/api/onboarding/financial-profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile, preferences: prefs, source: 'onboarding' }),
      });
      const usefulDebts = debts.filter((d) => d.debt_name.trim());
      if (usefulDebts.length > 0) {
        await fetch('/api/onboarding/debts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            debts: usefulDebts,
            replace_existing: true,
            source: 'onboarding',
          }),
        });
      }
      await fetch('/api/onboarding/sections', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section: 'financial',
          status: 'completed',
          fields_captured: {
            has_profile: Object.keys(profile).length > 0,
            has_prefs: Object.keys(prefs).length > 0,
            debt_count: usefulDebts.length,
          },
        }),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <SectionShell
      title="Financial"
      description="Income, expenses, debts, emergency fund, and tax-advantaged accounts. All fields optional — fill in what you know."
      onSave={onSave}
      saving={saving}
    >
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Income</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="text-sm">
            <span className="block text-gray-700 dark:text-gray-200 mb-1">Annual income</span>
            <input
              type="number"
              value={numField(profile.annual_income)}
              onChange={(e) =>
                upd({ annual_income: e.target.value === '' ? null : Number(e.target.value) })
              }
              className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2 text-sm"
            />
          </label>
          <label className="text-sm">
            <span className="block text-gray-700 dark:text-gray-200 mb-1">Income stability</span>
            <select
              value={profile.income_stability ?? ''}
              onChange={(e) =>
                upd({
                  income_stability: (e.target.value ||
                    null) as FinancialProfileInput['income_stability'],
                })
              }
              className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2 text-sm"
            >
              <option value="">—</option>
              <option value="very_stable">Very stable</option>
              <option value="stable">Stable</option>
              <option value="variable">Variable</option>
              <option value="unstable">Unstable</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="block text-gray-700 dark:text-gray-200 mb-1">Employment type</span>
            <select
              value={profile.employment_type ?? ''}
              onChange={(e) =>
                upd({
                  employment_type: (e.target.value ||
                    null) as FinancialProfileInput['employment_type'],
                })
              }
              className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2 text-sm"
            >
              <option value="">—</option>
              {EMPLOYMENT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="block text-gray-700 dark:text-gray-200 mb-1">Household size</span>
            <input
              type="number"
              min={1}
              value={numField(profile.household_size)}
              onChange={(e) =>
                upd({ household_size: e.target.value === '' ? null : Number(e.target.value) })
              }
              className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2 text-sm"
            />
          </label>
          <label className="text-sm">
            <span className="block text-gray-700 dark:text-gray-200 mb-1">Spouse income</span>
            <input
              type="number"
              value={numField(profile.spouse_annual_income)}
              onChange={(e) =>
                upd({ spouse_annual_income: e.target.value === '' ? null : Number(e.target.value) })
              }
              className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2 text-sm"
            />
          </label>
        </div>
      </section>

      <section className="space-y-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
          Cash flow & emergency fund
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="text-sm">
            <span className="block text-gray-700 dark:text-gray-200 mb-1">Monthly expenses</span>
            <input
              type="number"
              value={numField(profile.monthly_expenses)}
              onChange={(e) =>
                upd({ monthly_expenses: e.target.value === '' ? null : Number(e.target.value) })
              }
              className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2 text-sm"
            />
          </label>
          <label className="text-sm">
            <span className="block text-gray-700 dark:text-gray-200 mb-1">
              Monthly discretionary income
            </span>
            <input
              type="number"
              value={numField(profile.monthly_discretionary_income)}
              onChange={(e) =>
                upd({
                  monthly_discretionary_income:
                    e.target.value === '' ? null : Number(e.target.value),
                })
              }
              className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2 text-sm"
            />
          </label>
          <label className="text-sm">
            <span className="block text-gray-700 dark:text-gray-200 mb-1">Emergency fund $</span>
            <input
              type="number"
              value={numField(profile.emergency_fund_amount)}
              onChange={(e) =>
                upd({
                  emergency_fund_amount: e.target.value === '' ? null : Number(e.target.value),
                })
              }
              className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2 text-sm"
            />
          </label>
          <label className="text-sm">
            <span className="block text-gray-700 dark:text-gray-200 mb-1">Credit score range</span>
            <select
              value={profile.credit_score_range ?? ''}
              onChange={(e) =>
                upd({
                  credit_score_range: (e.target.value ||
                    null) as FinancialProfileInput['credit_score_range'],
                })
              }
              className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2 text-sm"
            >
              <option value="">—</option>
              <option value="below_580">Below 580</option>
              <option value="580_669">580–669</option>
              <option value="670_739">670–739</option>
              <option value="740_799">740–799</option>
              <option value="800_plus">800+</option>
              <option value="unknown">Don't know</option>
            </select>
          </label>
        </div>
      </section>

      <section className="space-y-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
          Tax-advantaged & employer
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={!!profile.hsa_eligible}
              onChange={(e) => upd({ hsa_eligible: e.target.checked })}
            />
            HSA eligible
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={!!profile.fsa_eligible}
              onChange={(e) => upd({ fsa_eligible: e.target.checked })}
            />
            FSA eligible
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={!!profile.has_pension}
              onChange={(e) => upd({ has_pension: e.target.checked })}
            />
            Has pension
          </label>
          <label>
            <span className="block text-gray-700 dark:text-gray-200 mb-1">
              Employer 401(k) match %
            </span>
            <input
              type="number"
              step={0.5}
              value={numField(profile.employer_match_percent)}
              onChange={(e) =>
                upd({
                  employer_match_percent: e.target.value === '' ? null : Number(e.target.value),
                })
              }
              className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2 text-sm"
            />
          </label>
        </div>
      </section>

      <section className="space-y-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
          Financing preference
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <label>
            <span className="block text-gray-700 dark:text-gray-200 mb-1">
              Liquidity preference
            </span>
            <select
              value={prefs.liquidity_preference ?? ''}
              onChange={(e) =>
                updPrefs({
                  liquidity_preference: (e.target.value ||
                    null) as FinancingPreferenceInput['liquidity_preference'],
                })
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
              Target months of expenses liquid
            </span>
            <input
              type="number"
              step={1}
              value={numField(prefs.liquidity_target_months)}
              onChange={(e) =>
                updPrefs({
                  liquidity_target_months: e.target.value === '' ? null : Number(e.target.value),
                })
              }
              className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2"
            />
          </label>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          For an extra dollar this month, how should we split it?
        </p>
        <div className="grid grid-cols-3 gap-3 text-sm">
          {(['debt_pay_weight', 'invest_weight', 'save_weight'] as const).map((k) => (
            <label key={k}>
              <span className="block text-gray-700 dark:text-gray-200 mb-1">
                {k === 'debt_pay_weight' ? 'Pay debt' : k === 'invest_weight' ? 'Invest' : 'Save'}
              </span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={prefs[k] ?? 0.33}
                onChange={(e) => updPrefs({ [k]: Number(e.target.value) } as any)}
                className="w-full"
              />
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {Math.round((prefs[k] ?? 0.33) * 100)}%
              </span>
            </label>
          ))}
        </div>
      </section>

      <section className="space-y-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Debts</h3>
          <button type="button" onClick={addDebt} className="text-sm text-blue-600 hover:underline">
            + Add debt
          </button>
        </div>
        <ul className="space-y-3">
          {debts.length === 0 && (
            <li className="text-sm text-gray-500 dark:text-gray-400 italic">
              No debts yet. Add one above if you have credit-card balances, student loans, etc.
            </li>
          )}
          {debts.map((d, i) => (
            <li
              key={i}
              className="border border-gray-200 dark:border-gray-700 rounded p-3 space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase font-semibold text-gray-500">Debt #{i + 1}</span>
                <button
                  type="button"
                  onClick={() => removeDebt(i)}
                  className="text-xs text-red-600 hover:underline"
                >
                  Remove
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                <input
                  type="text"
                  value={d.debt_name}
                  onChange={(e) => updateDebt(i, { debt_name: e.target.value })}
                  placeholder="Name (e.g. Chase Sapphire)"
                  className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2"
                />
                <select
                  value={d.debt_type}
                  onChange={(e) => updateDebt(i, { debt_type: e.target.value as DebtType })}
                  className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2"
                >
                  {DEBT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  value={numField(d.current_balance)}
                  onChange={(e) => updateDebt(i, { current_balance: Number(e.target.value || 0) })}
                  placeholder="Current balance"
                  className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2"
                />
                <input
                  type="number"
                  step="0.0001"
                  value={numField(d.interest_rate)}
                  onChange={(e) =>
                    updateDebt(i, {
                      interest_rate: e.target.value === '' ? null : Number(e.target.value),
                    })
                  }
                  placeholder="APR (e.g. 0.2199)"
                  className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2"
                />
                <input
                  type="number"
                  value={numField(d.minimum_payment)}
                  onChange={(e) =>
                    updateDebt(i, {
                      minimum_payment: e.target.value === '' ? null : Number(e.target.value),
                    })
                  }
                  placeholder="Minimum payment"
                  className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2"
                />
              </div>
            </li>
          ))}
        </ul>
      </section>
    </SectionShell>
  );
}
