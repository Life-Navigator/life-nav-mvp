/**
 * @jest-environment node
 *
 * LeadPackageService tests.
 *
 * Critical contracts:
 *   - Sections marked `include_*: false` MUST be absent (not just empty).
 *   - Revoked consent rejects.
 *   - Expired consent rejects.
 *   - Determinism on identical inputs.
 *   - The patient_summary never carries DOB or full name.
 */

import { __test } from '../lead-package-service';
import type {
  ArcanaGoal,
  ArcanaProfile,
  BiometricObservation,
  LabResult,
  LeadPackageConsent,
} from '@/types/arcana';

const { verifyConsentAt, buildLeadPackagePayload } = __test;

const profile: ArcanaProfile = {
  id: 'prof_1',
  user_id: 'u_1',
  intake_source: 'arcana',
  membership_tier: 'arcana_performance',
  dominant_driver: 'performance',
  secondary_driver: 'image',
  readiness_factors: [],
  provider_lead_consent_given: true,
  metadata: {},
  created_at: '',
  updated_at: '',
};

function consent(over: Partial<LeadPackageConsent> = {}): LeadPackageConsent {
  return {
    id: 'c_1',
    user_id: 'u_1',
    recipient_provider_id: 'prov_1',
    consent_kind: 'lead_package',
    include_goals: true,
    include_constraints: true,
    include_motivation: true,
    include_biometrics: true,
    include_labs: false,
    include_protocols: true,
    include_supplements: true,
    include_medications: false,
    include_insurance: false,
    granted_at: '2026-01-01T00:00:00Z',
    metadata: {},
    created_at: '',
    updated_at: '',
    ...over,
  };
}

describe('verifyConsentAt', () => {
  test('granted, unrevoked, unexpired → ok', () => {
    const v = verifyConsentAt(consent(), '2026-05-01T00:00:00Z');
    expect(v.ok).toBe(true);
    expect(v.reasons).toEqual([]);
  });

  test('revoked → reason consent_revoked', () => {
    const v = verifyConsentAt(
      consent({ revoked_at: '2026-04-01T00:00:00Z' }),
      '2026-05-01T00:00:00Z'
    );
    expect(v.ok).toBe(false);
    expect(v.reasons).toContain('consent_revoked');
  });

  test('expired → reason consent_expired', () => {
    const v = verifyConsentAt(
      consent({ expires_at: '2026-02-01T00:00:00Z' }),
      '2026-05-01T00:00:00Z'
    );
    expect(v.ok).toBe(false);
    expect(v.reasons).toContain('consent_expired');
  });
});

describe('buildLeadPackagePayload — section gating', () => {
  test('include_labs=false omits lab_snapshot key entirely (not empty array)', () => {
    const p = buildLeadPackagePayload({
      profile,
      consent: consent({ include_labs: false }),
      initials: 'JD',
      labs_most_recent: [
        {
          id: 'l_1',
          user_id: 'u_1',
          lab_kind: 'a1c',
          collection_date: '2026-04-01',
          result_value: 5.4,
          unit: '%',
          metadata: {},
          created_at: '',
          updated_at: '',
        } as LabResult,
      ],
    });
    expect(p).not.toHaveProperty('lab_snapshot');
  });

  test('include_labs=true includes the labs even if profile says nothing', () => {
    const p = buildLeadPackagePayload({
      profile,
      consent: consent({ include_labs: true }),
      initials: 'JD',
      labs_most_recent: [
        {
          id: 'l_1',
          user_id: 'u_1',
          lab_kind: 'a1c',
          collection_date: '2026-04-01',
          result_value: 5.4,
          unit: '%',
          metadata: {},
          created_at: '',
          updated_at: '',
        } as LabResult,
      ],
    });
    expect(p.lab_snapshot).toHaveLength(1);
    expect(p.lab_snapshot?.[0].lab_kind).toBe('a1c');
  });

  test('include_medications=false omits even when narrative provided', () => {
    const p = buildLeadPackagePayload({
      profile,
      consent: consent({ include_medications: false }),
      initials: 'JD',
      medication_narrative: [{ narrative: 'on metformin', ongoing: true }],
    });
    expect(p).not.toHaveProperty('medications');
  });

  test('patient_summary never carries dob or full name', () => {
    const p = buildLeadPackagePayload({
      profile,
      consent: consent(),
      initials: 'JD',
      age_band: '35-39',
      sex: 'male',
    });
    expect(p.patient_summary).toMatchObject({
      name_initials: 'JD',
      age_band: '35-39',
      sex: 'male',
    });
    expect(Object.keys(p.patient_summary)).not.toEqual(
      expect.arrayContaining(['dob', 'full_name', 'ssn'])
    );
  });

  test('biometric in_reference_range flag computed from low/high', () => {
    const inObs: BiometricObservation = {
      id: 'b_1',
      user_id: 'u_1',
      metric_kind: 'resting_heart_rate',
      value: 58,
      unit: 'bpm',
      reference_low: 50,
      reference_high: 70,
      source: 'wearable',
      collected_at: '2026-04-15T00:00:00Z',
      metadata: {},
      created_at: '',
      updated_at: '',
    };
    const p = buildLeadPackagePayload({
      profile,
      consent: consent(),
      initials: 'JD',
      biometrics_most_recent: [inObs],
    });
    expect(p.biometric_snapshot?.[0].in_reference_range).toBe(true);
  });

  test('determinism', () => {
    const args = {
      profile,
      consent: consent(),
      initials: 'JD',
      age_band: '35-39',
      sex: 'male' as const,
      goals: [
        {
          id: 'g_1',
          user_id: 'u_1',
          profile_id: 'prof_1',
          goal_kind: 'cardiovascular_health' as const,
          domain: 'health' as const,
          title: 'VO2max 50',
          motivation_drivers: {},
          metadata: {},
          created_at: '',
          updated_at: '',
        } as ArcanaGoal,
      ],
      key_risks: ['adherence drop at week 6'],
      recommended_discussion_topics: ['baseline VO2 test order'],
    };
    const a = buildLeadPackagePayload(args);
    const b = buildLeadPackagePayload(args);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
