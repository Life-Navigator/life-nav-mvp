'use client';

import React, { useEffect, useState } from 'react';
import SectionShell from '../SectionShell';
import type { EducationIntakeInput, EducationCredentialInput } from '@/types/intake';

function num(v: number | null | undefined): string {
  return v === null || v === undefined ? '' : String(v);
}

export default function EducationIntakeSection() {
  const [intake, setIntake] = useState<EducationIntakeInput>({});
  const [credentials, setCredentials] = useState<EducationCredentialInput[]>([]);
  const [schoolInput, setSchoolInput] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/onboarding/education-intake')
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (body?.intake) setIntake(body.intake);
        if (body?.credentials)
          setCredentials(
            body.credentials.map((c: any) => ({
              credential_kind: c.credential_kind,
              name: c.name,
              issuer: c.issuer,
              status: c.status,
              issued_at: c.issued_at,
              expires_at: c.expires_at,
              url: c.url,
              notes: c.notes,
            }))
          );
      });
  }, []);

  const addSchool = () => {
    const v = schoolInput.trim();
    if (!v) return;
    setIntake((i) => ({ ...i, desired_schools: [...(i.desired_schools ?? []), v] }));
    setSchoolInput('');
  };

  const addCredential = () =>
    setCredentials((c) => [...c, { credential_kind: 'certification', name: '', status: 'active' }]);
  const updateCredential = (i: number, patch: Partial<EducationCredentialInput>) =>
    setCredentials((c) => c.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  const removeCredential = (i: number) => setCredentials((c) => c.filter((_, idx) => idx !== i));

  const onSave = async () => {
    setSaving(true);
    try {
      await fetch('/api/onboarding/education-intake', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intake,
          credentials: credentials.filter((c) => c.name.trim()),
          source: 'onboarding',
        }),
      });
      await fetch('/api/onboarding/sections', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section: 'education',
          status: 'completed',
          fields_captured: {
            credential_count: credentials.filter((c) => c.name.trim()).length,
            target_schools: (intake.desired_schools ?? []).length,
          },
        }),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <SectionShell
      title="Education"
      description="Highest degree, current programs, target credentials, and how you'd pay for them."
      onSave={onSave}
      saving={saving}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <label>
          <span className="block text-gray-700 dark:text-gray-200 mb-1">
            Highest completed degree
          </span>
          <input
            type="text"
            value={intake.highest_completed_degree ?? ''}
            onChange={(e) => setIntake((d) => ({ ...d, highest_completed_degree: e.target.value }))}
            className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2"
          />
        </label>
        <label>
          <span className="block text-gray-700 dark:text-gray-200 mb-1">
            Current program (if any)
          </span>
          <input
            type="text"
            value={intake.current_program ?? ''}
            onChange={(e) => setIntake((d) => ({ ...d, current_program: e.target.value }))}
            className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2"
          />
        </label>
        <label>
          <span className="block text-gray-700 dark:text-gray-200 mb-1">Current institution</span>
          <input
            type="text"
            value={intake.current_institution ?? ''}
            onChange={(e) => setIntake((d) => ({ ...d, current_institution: e.target.value }))}
            className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2"
          />
        </label>
        <label>
          <span className="block text-gray-700 dark:text-gray-200 mb-1">
            Hours / week for study
          </span>
          <input
            type="number"
            min={0}
            value={num(intake.time_available_for_study_hours_per_week)}
            onChange={(e) =>
              setIntake((d) => ({
                ...d,
                time_available_for_study_hours_per_week:
                  e.target.value === '' ? null : Number(e.target.value),
              }))
            }
            className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2"
          />
        </label>
        <label>
          <span className="block text-gray-700 dark:text-gray-200 mb-1">
            Tuition budget (total)
          </span>
          <input
            type="number"
            min={0}
            value={num(intake.tuition_budget_total)}
            onChange={(e) =>
              setIntake((d) => ({
                ...d,
                tuition_budget_total: e.target.value === '' ? null : Number(e.target.value),
              }))
            }
            className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2"
          />
        </label>
        <label>
          <span className="block text-gray-700 dark:text-gray-200 mb-1">
            Tuition budget (annual)
          </span>
          <input
            type="number"
            min={0}
            value={num(intake.tuition_budget_annual)}
            onChange={(e) =>
              setIntake((d) => ({
                ...d,
                tuition_budget_annual: e.target.value === '' ? null : Number(e.target.value),
              }))
            }
            className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2"
          />
        </label>
        <label>
          <span className="block text-gray-700 dark:text-gray-200 mb-1">ROI preference</span>
          <select
            value={intake.expected_roi_preference ?? ''}
            onChange={(e) =>
              setIntake((d) => ({
                ...d,
                expected_roi_preference: (e.target.value ||
                  null) as EducationIntakeInput['expected_roi_preference'],
              }))
            }
            className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2"
          >
            <option value="">—</option>
            <option value="fast_payback">Fast payback</option>
            <option value="balanced">Balanced</option>
            <option value="long_term_value">Long-term value</option>
          </select>
        </label>
        <label>
          <span className="block text-gray-700 dark:text-gray-200 mb-1">Credential urgency</span>
          <select
            value={intake.credential_urgency ?? ''}
            onChange={(e) =>
              setIntake((d) => ({
                ...d,
                credential_urgency: (e.target.value ||
                  null) as EducationIntakeInput['credential_urgency'],
              }))
            }
            className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2"
          >
            <option value="">—</option>
            <option value="none">None</option>
            <option value="within_year">Within a year</option>
            <option value="within_2_years">Within 2 years</option>
            <option value="within_5_years">Within 5 years</option>
          </select>
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm pt-4 border-t border-gray-200 dark:border-gray-700">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={!!intake.willing_to_take_loans}
            onChange={(e) => setIntake((d) => ({ ...d, willing_to_take_loans: e.target.checked }))}
          />
          Willing to take loans
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={!!intake.has_gi_bill}
            onChange={(e) => setIntake((d) => ({ ...d, has_gi_bill: e.target.checked }))}
          />
          Has GI Bill
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={!!intake.has_va_benefits}
            onChange={(e) => setIntake((d) => ({ ...d, has_va_benefits: e.target.checked }))}
          />
          Has VA benefits
        </label>
        <label>
          <span className="block text-gray-700 dark:text-gray-200 mb-1">
            Employer tuition reimbursement / year
          </span>
          <input
            type="number"
            min={0}
            value={num(intake.employer_tuition_reimbursement_annual)}
            onChange={(e) =>
              setIntake((d) => ({
                ...d,
                employer_tuition_reimbursement_annual:
                  e.target.value === '' ? null : Number(e.target.value),
              }))
            }
            className="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2"
          />
        </label>
      </div>

      <div className="pt-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
        <label className="block text-sm text-gray-700 dark:text-gray-200">
          Desired schools / programs
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={schoolInput}
            onChange={(e) => setSchoolInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addSchool();
              }
            }}
            placeholder="e.g. Stanford MBA"
            className="flex-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2 text-sm"
          />
          <button
            type="button"
            onClick={addSchool}
            className="px-3 py-1 text-sm rounded bg-blue-600 hover:bg-blue-700 text-white"
          >
            Add
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {(intake.desired_schools ?? []).map((s, i) => (
            <span
              key={`${s}-${i}`}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200"
            >
              {s}
              <button
                type="button"
                onClick={() =>
                  setIntake((d) => ({
                    ...d,
                    desired_schools: (d.desired_schools ?? []).filter((_, idx) => idx !== i),
                  }))
                }
                className="text-red-600 hover:underline"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      </div>

      <div className="pt-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
        <div className="flex items-center justify-between">
          <label className="block text-sm text-gray-700 dark:text-gray-200">
            Credentials & licenses
          </label>
          <button
            type="button"
            onClick={addCredential}
            className="text-sm text-blue-600 hover:underline"
          >
            + Add credential
          </button>
        </div>
        <ul className="space-y-2">
          {credentials.map((c, i) => (
            <li
              key={i}
              className="border border-gray-200 dark:border-gray-700 rounded p-3 grid grid-cols-1 sm:grid-cols-4 gap-2 text-sm"
            >
              <select
                value={c.credential_kind}
                onChange={(e) =>
                  updateCredential(i, {
                    credential_kind: e.target.value as EducationCredentialInput['credential_kind'],
                  })
                }
                className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2"
              >
                <option value="certification">Certification</option>
                <option value="license">License</option>
                <option value="badge">Badge</option>
                <option value="target_credential">Target credential</option>
              </select>
              <input
                type="text"
                value={c.name}
                onChange={(e) => updateCredential(i, { name: e.target.value })}
                placeholder="Name"
                className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2"
              />
              <input
                type="text"
                value={c.issuer ?? ''}
                onChange={(e) => updateCredential(i, { issuer: e.target.value })}
                placeholder="Issuer"
                className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2"
              />
              <div className="flex items-center justify-between gap-2">
                <select
                  value={c.status ?? 'active'}
                  onChange={(e) =>
                    updateCredential(i, {
                      status: e.target.value as EducationCredentialInput['status'],
                    })
                  }
                  className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 p-2"
                >
                  <option value="active">Active</option>
                  <option value="in_progress">In progress</option>
                  <option value="target">Target</option>
                  <option value="expired">Expired</option>
                  <option value="lapsed">Lapsed</option>
                </select>
                <button
                  type="button"
                  onClick={() => removeCredential(i)}
                  className="text-xs text-red-600 hover:underline"
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </SectionShell>
  );
}
