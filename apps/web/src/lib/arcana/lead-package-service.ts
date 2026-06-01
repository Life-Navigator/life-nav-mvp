/**
 * Lead Package Service (Phase 7)
 *
 * Generates a frozen, consent-bounded snapshot of an Arcana patient for
 * a provider. The contract:
 *
 *   1. A consent row gates EVERY section. Sections marked false in the
 *      consent are NEVER materialized — not even as empty arrays.
 *   2. Identifiable data is reduced: initials + age band + sex. No DOB,
 *      no full name, no SSN, no address.
 *   3. The package is immutable once generated. Revoking the consent
 *      blocks future ACCESS, not the bytes already issued.
 *   4. Determinism: same inputs + frozen now() → byte-identical payload.
 *
 * Pure logic. Persistence is handled at the API route.
 */

import type {
  ArcanaGoal,
  ArcanaConstraint,
  ArcanaMotivation,
  ArcanaProfile,
  BiometricObservation,
  LabResult,
  LeadPackageConsent,
  LeadPackagePayload,
  MembershipTier,
  SupplementProtocol,
  TrainingProtocol,
} from '@/types/arcana';
import type { DominantDriver } from '@/types/conversation-intel';

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

export interface LeadPackageInputs {
  profile: ArcanaProfile;
  consent: LeadPackageConsent;
  initials: string;
  age_band?: string; // e.g. '35-39'
  sex?: 'male' | 'female' | 'other' | 'prefer_not_to_say';

  goals?: ArcanaGoal[];
  constraints?: ArcanaConstraint[];
  motivations?: ArcanaMotivation[];

  biometrics_most_recent?: BiometricObservation[];
  labs_most_recent?: LabResult[];

  training_protocols?: TrainingProtocol[];
  supplement_protocols?: SupplementProtocol[];
  medication_narrative?: Array<{ narrative: string; ongoing: boolean }>;

  insurance_plan_summary?: string;
  insurance_coverage_notes?: string;

  readiness_score?: number;
  probability_of_success?: number;
  key_risks?: string[];
  recommended_discussion_topics?: string[];
}

// ---------------------------------------------------------------------------
// Consent gate
// ---------------------------------------------------------------------------

export interface ConsentVerdict {
  ok: boolean;
  reasons: string[];
}

export function verifyConsentAt(consent: LeadPackageConsent, now: string): ConsentVerdict {
  const reasons: string[] = [];
  if (!consent) {
    reasons.push('missing_consent_row');
    return { ok: false, reasons };
  }
  if (consent.revoked_at) reasons.push('consent_revoked');
  if (consent.expires_at && consent.expires_at < now) reasons.push('consent_expired');
  if (!consent.granted_at) reasons.push('consent_not_granted');
  return { ok: reasons.length === 0, reasons };
}

// ---------------------------------------------------------------------------
// Section materializers — each one is "off by default" if the consent flag is false
// ---------------------------------------------------------------------------

function membershipTier(p: ArcanaProfile): MembershipTier | null {
  return p.membership_tier ?? null;
}

function goalsSection(consent: LeadPackageConsent, goals?: ArcanaGoal[]) {
  if (!consent.include_goals || !goals?.length) return undefined;
  return goals.map((g) => ({
    title: g.title,
    kind: g.goal_kind,
    domain: g.domain,
    target_value: g.target_value ?? undefined,
    target_unit: g.target_unit ?? undefined,
    target_date: g.target_date ?? undefined,
    why: g.why_text ?? undefined,
  }));
}

function constraintsSection(consent: LeadPackageConsent, cs?: ArcanaConstraint[]) {
  if (!consent.include_constraints || !cs?.length) return undefined;
  return cs
    .filter((c) => c.is_active)
    .map((c) => ({
      kind: c.constraint_kind,
      severity: c.severity,
      description: c.description,
      value_numeric: c.value_numeric ?? undefined,
      value_unit: c.value_unit ?? undefined,
    }));
}

function motivationSection(
  consent: LeadPackageConsent,
  profile: ArcanaProfile,
  motivations?: ArcanaMotivation[]
) {
  if (!consent.include_motivation) return undefined;

  const driversInferred = Boolean(
    profile.dominant_driver || (motivations && motivations.length > 0)
  );
  if (!driversInferred) return undefined;

  // Take the highest-intensity self-reported motivation as the short quote.
  const top = (motivations ?? [])
    .filter((m) => typeof m.intensity === 'number')
    .sort((a, b) => (b.intensity ?? 0) - (a.intensity ?? 0))[0];

  return {
    dominant_driver: profile.dominant_driver ?? undefined,
    secondary_driver: profile.secondary_driver ?? undefined,
    drivers_inferred_from_session: driversInferred,
    short_quote: top?.motivation_text,
  } as {
    dominant_driver?: DominantDriver;
    secondary_driver?: DominantDriver;
    drivers_inferred_from_session: boolean;
    short_quote?: string;
  };
}

function biometricSection(consent: LeadPackageConsent, obs?: BiometricObservation[]) {
  if (!consent.include_biometrics || !obs?.length) return undefined;
  return obs.map((o) => ({
    metric_kind: o.metric_kind,
    most_recent_value: o.value,
    unit: o.unit ?? undefined,
    collected_at: o.collected_at,
    in_reference_range:
      typeof o.reference_low === 'number' && typeof o.reference_high === 'number'
        ? o.value >= o.reference_low && o.value <= o.reference_high
        : undefined,
  }));
}

function labsSection(consent: LeadPackageConsent, labs?: LabResult[]) {
  if (!consent.include_labs || !labs?.length) return undefined;
  return labs.map((l) => ({
    lab_kind: l.lab_kind,
    collection_date: l.collection_date,
    result_value: l.result_value ?? undefined,
    unit: l.unit ?? undefined,
    flag: l.flag ?? undefined,
  }));
}

function protocolsSection(consent: LeadPackageConsent, ts?: TrainingProtocol[]) {
  if (!consent.include_protocols || !ts?.length) return undefined;
  return ts
    .filter((p) => p.protocol_kind !== 'supplement' && p.protocol_kind !== 'medication_note')
    .map((p) => ({
      kind: p.protocol_kind as 'training' | 'nutrition' | 'sleep' | 'recovery' | 'behavior',
      protocol_name: p.protocol_name,
      sessions_per_week: p.sessions_per_week ?? undefined,
      active: p.active,
    }));
}

function supplementsSection(consent: LeadPackageConsent, ss?: SupplementProtocol[]) {
  if (!consent.include_supplements || !ss?.length) return undefined;
  return ss
    .filter((s) => s.active)
    .map((s) => ({
      name: s.supplement_name,
      dose: s.dose ?? undefined,
      dose_unit: s.dose_unit ?? undefined,
      frequency: s.frequency ?? undefined,
      source: s.source,
    }));
}

function medicationsSection(
  consent: LeadPackageConsent,
  meds?: Array<{ narrative: string; ongoing: boolean }>
) {
  if (!consent.include_medications || !meds?.length) return undefined;
  return meds.map((m) => ({ narrative: m.narrative, ongoing: m.ongoing }));
}

function insuranceSection(consent: LeadPackageConsent, summary?: string, notes?: string) {
  if (!consent.include_insurance) return undefined;
  if (!summary && !notes) return undefined;
  return { plan_summary: summary, coverage_notes: notes };
}

// ---------------------------------------------------------------------------
// Assemble
// ---------------------------------------------------------------------------

function setIfDefined<T extends object, K extends string, V>(
  obj: T,
  key: K,
  value: V | undefined
): asserts obj is T & Partial<Record<K, V>> {
  if (value !== undefined) {
    (obj as Record<string, unknown>)[key] = value;
  }
}

export function buildLeadPackagePayload(inputs: LeadPackageInputs): LeadPackagePayload {
  const { profile, consent } = inputs;

  // Patient summary is always present (initials are required). We only
  // include age_band/sex when provided.
  const patient_summary: LeadPackagePayload['patient_summary'] = {
    name_initials: inputs.initials,
    membership_tier: membershipTier(profile),
  };
  setIfDefined(patient_summary, 'age_band', inputs.age_band);
  setIfDefined(patient_summary, 'sex', inputs.sex);

  // Build the rest of the payload by adding only the keys whose
  // matching consent flag is on. This keeps the determinism contract
  // intact (key ordering is fixed) AND prevents `key: undefined`
  // appearing on the object.
  const payload: LeadPackagePayload = {
    schema_version: 'v1',
    patient_summary,
    key_risks: inputs.key_risks ?? [],
    recommended_discussion_topics: inputs.recommended_discussion_topics ?? [],
  };

  setIfDefined(payload, 'goals', goalsSection(consent, inputs.goals));
  setIfDefined(payload, 'constraints', constraintsSection(consent, inputs.constraints));
  setIfDefined(
    payload,
    'motivation_summary',
    motivationSection(consent, profile, inputs.motivations)
  );
  setIfDefined(
    payload,
    'biometric_snapshot',
    biometricSection(consent, inputs.biometrics_most_recent)
  );
  setIfDefined(payload, 'lab_snapshot', labsSection(consent, inputs.labs_most_recent));
  setIfDefined(payload, 'protocols', protocolsSection(consent, inputs.training_protocols));
  setIfDefined(payload, 'supplements', supplementsSection(consent, inputs.supplement_protocols));
  setIfDefined(payload, 'medications', medicationsSection(consent, inputs.medication_narrative));
  setIfDefined(
    payload,
    'insurance',
    insuranceSection(consent, inputs.insurance_plan_summary, inputs.insurance_coverage_notes)
  );
  setIfDefined(payload, 'readiness_score', inputs.readiness_score);
  setIfDefined(payload, 'probability_of_success', inputs.probability_of_success);

  return payload;
}

export const __test = {
  verifyConsentAt,
  buildLeadPackagePayload,
  goalsSection,
  constraintsSection,
  biometricSection,
  labsSection,
  supplementsSection,
  medicationsSection,
  insuranceSection,
};
