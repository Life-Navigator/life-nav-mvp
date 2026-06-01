/**
 * Arcana Health & Performance — types mirroring migration 086.
 *
 * Six first-class health domains (extending the cross-cutting Domain union):
 *   - health: general health
 *   - performance: athletic / cognitive / capability
 *   - recovery: sleep / HRV / training stress
 *   - longevity: healthspan / lifespan / biological age
 *   - body_composition: fat mass / lean mass / waist
 *   - preventative_care: screenings / vaccinations / labs
 *
 * ETHICAL CONTRACT (enforced in application layer):
 *   Arcana RECOMMENDS. Arcana does not DIAGNOSE or PRESCRIBE.
 *   Clinical decisions are gated through licensed providers.
 *   All wearable/lab data shown to providers requires explicit consent.
 */

import type { DominantDriver } from './conversation-intel';

// ---------------------------------------------------------------------------
// Domain unions
// ---------------------------------------------------------------------------

export type ArcanaDomain =
  | 'health'
  | 'performance'
  | 'recovery'
  | 'longevity'
  | 'body_composition'
  | 'preventative_care';

export type IntakeSource =
  | 'arcana'
  | 'clinic'
  | 'coach'
  | 'physician'
  | 'trainer'
  | 'nutritionist'
  | 'self';

export type MembershipTier = 'arcana_core' | 'arcana_performance' | 'arcana_concierge';

export type MembershipStatus = 'active' | 'paused' | 'cancelled' | 'expired' | 'trial';

export type AssessmentKind =
  | 'baseline'
  | 'readiness'
  | 'goal_discovery'
  | 'protocol_review'
  | 'lab_review'
  | 'progress_review'
  | 'provider_handoff';

export type ArcanaGoalKind =
  | 'weight_loss'
  | 'fat_loss'
  | 'muscle_gain'
  | 'longevity'
  | 'recovery'
  | 'athletic_performance'
  | 'energy'
  | 'sleep'
  | 'hormone_optimization'
  | 'chronic_condition_management'
  | 'body_composition'
  | 'cardiovascular_health'
  | 'lab_optimization'
  | 'compliance'
  | 'custom';

export type ConstraintKind =
  | 'time'
  | 'budget'
  | 'travel'
  | 'family'
  | 'work_schedule'
  | 'injury'
  | 'medical_restriction'
  | 'dietary_restriction'
  | 'equipment_access'
  | 'other';

export type ConstraintSeverity = 'hard' | 'soft';

export type CapabilityKind =
  | 'training_experience'
  | 'diet_experience'
  | 'cooking_skill'
  | 'recovery_habits'
  | 'equipment_access'
  | 'gym_access'
  | 'travel_frequency'
  | 'sleep_routine'
  | 'stress_management'
  | 'other';

export type CapabilityProficiency = 'novice' | 'intermediate' | 'advanced' | 'expert';

export type MotivationDriver = DominantDriver | 'mixed';

export type ProtocolSource =
  | 'self_report'
  | 'provider_recommended'
  | 'arcana_suggested'
  | 'imported';

export type BiometricKind =
  | 'weight'
  | 'body_fat_pct'
  | 'lean_mass'
  | 'waist_circumference'
  | 'resting_blood_pressure_systolic'
  | 'resting_blood_pressure_diastolic'
  | 'resting_heart_rate'
  | 'hrv'
  | 'vo2_max'
  | 'sleep_duration_min'
  | 'sleep_efficiency_pct'
  | 'rem_minutes'
  | 'deep_minutes'
  | 'step_count'
  | 'active_calories'
  | 'training_load'
  | 'recovery_score'
  | 'body_temperature'
  | 'spo2';

export type BiometricSource =
  | 'self_report'
  | 'wearable'
  | 'provider_measured'
  | 'imported'
  | 'computed';

export type WearableProvider =
  | 'apple_health'
  | 'google_fit'
  | 'fitbit'
  | 'garmin'
  | 'whoop'
  | 'oura'
  | 'other';

export type WearableStatus = 'pending' | 'active' | 'paused' | 'revoked' | 'expired' | 'error';

export type LabKind =
  | 'cbc'
  | 'cmp'
  | 'lipid_panel'
  | 'a1c'
  | 'vitamin_d_25oh'
  | 'vitamin_b12'
  | 'folate'
  | 'ferritin'
  | 'total_testosterone'
  | 'free_testosterone'
  | 'shbg'
  | 'estradiol'
  | 'dhea_s'
  | 'progesterone'
  | 'prolactin'
  | 'tsh'
  | 'free_t3'
  | 'free_t4'
  | 'reverse_t3'
  | 'tpo_antibody'
  | 'crp'
  | 'hs_crp'
  | 'apo_b'
  | 'lp_a'
  | 'homocysteine'
  | 'fasting_glucose'
  | 'fasting_insulin'
  | 'homa_ir'
  | 'uric_acid'
  | 'psa'
  | 'magnesium'
  | 'calcium_serum'
  | 'phosphorus'
  | 'cortisol_am'
  | 'cortisol_pm'
  | 'igf_1'
  | 'custom';

export type LabFlag = 'low' | 'normal' | 'borderline' | 'high' | 'critical';

export type InsuranceDocumentKind =
  | 'insurance_card_front'
  | 'insurance_card_back'
  | 'plan_document'
  | 'benefit_summary'
  | 'eob'
  | 'sbc'
  | 'formulary'
  | 'other';

export type OcrStatus = 'pending' | 'processing' | 'succeeded' | 'failed' | 'skipped';

export type LeadConsentKind = 'lead_package' | 'full_record_share' | 'prescreen_only';

// ---------------------------------------------------------------------------
// Profile, assessment, goals, constraints, motivations, readiness
// ---------------------------------------------------------------------------

export interface ArcanaProfile {
  id: string;
  user_id: string;
  intake_source: IntakeSource;
  referring_provider_id?: string | null;
  membership_tier?: MembershipTier | null;
  membership_activated_at?: string | null;
  financial_security_score?: number | null;
  image_score?: number | null;
  performance_score?: number | null;
  dominant_driver?: DominantDriver | null;
  secondary_driver?: DominantDriver | null;
  readiness_score?: number | null;
  readiness_factors: ReadinessFactor[];
  provider_lead_consent_given: boolean;
  provider_lead_consent_at?: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ArcanaAssessment {
  id: string;
  user_id: string;
  profile_id: string;
  assessment_kind: AssessmentKind;
  discovery_session_id?: string | null;
  conducted_at: string;
  summary?: string | null;
  findings: Record<string, unknown>;
  confidence?: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ArcanaGoal {
  id: string;
  user_id: string;
  profile_id: string;
  goal_id?: string | null;
  goal_kind: ArcanaGoalKind;
  domain: ArcanaDomain;
  title: string;
  description?: string | null;
  target_value?: number | null;
  target_unit?: string | null;
  target_date?: string | null;
  why_text?: string | null;
  motivation_drivers: Partial<Record<DominantDriver, number>>;
  current_value?: number | null;
  baseline_value?: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ArcanaConstraint {
  id: string;
  user_id: string;
  profile_id: string;
  constraint_kind: ConstraintKind;
  description: string;
  value_numeric?: number | null;
  value_unit?: string | null;
  severity: ConstraintSeverity;
  starts_at?: string | null;
  ends_at?: string | null;
  is_active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ArcanaCapability {
  id: string;
  user_id: string;
  profile_id: string;
  capability_kind: CapabilityKind;
  proficiency: CapabilityProficiency;
  description?: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ArcanaMotivation {
  id: string;
  user_id: string;
  profile_id: string;
  motivation_text: string;
  driver: MotivationDriver;
  intensity?: number | null;
  surfaced_at_depth?: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ReadinessFactor {
  dimension: 'motivation' | 'capability' | 'capacity' | 'consistency';
  contribution: number;
  reason: string;
}

export interface ArcanaReadiness {
  id: string;
  user_id: string;
  profile_id: string;
  computed_at: string;
  overall_score: number;
  motivation_score?: number | null;
  capability_score?: number | null;
  capacity_score?: number | null;
  consistency_score?: number | null;
  drivers: ReadinessFactor[];
  risks: Array<{ risk: string; severity: 'low' | 'medium' | 'high'; mitigation?: string }>;
  recommended_membership?: MembershipTier | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Protocols & milestones
// ---------------------------------------------------------------------------

export interface SupplementProtocol {
  id: string;
  user_id: string;
  profile_id?: string | null;
  supplement_name: string;
  brand?: string | null;
  dose?: number | null;
  dose_unit?: string | null;
  frequency?: string | null;
  timing?: string | null;
  started_on?: string | null;
  ended_on?: string | null;
  source: ProtocolSource;
  notes?: string | null;
  active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface TrainingProtocol {
  id: string;
  user_id: string;
  profile_id?: string | null;
  protocol_name: string;
  protocol_kind:
    | 'supplement'
    | 'training'
    | 'nutrition'
    | 'sleep'
    | 'recovery'
    | 'behavior'
    | 'medication_note';
  weekly_structure: Record<string, unknown>;
  sessions_per_week?: number | null;
  duration_min_per_session?: number | null;
  periodization_kind?: string | null;
  started_on?: string | null;
  ended_on?: string | null;
  source: ProtocolSource;
  active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface HealthMilestone {
  id: string;
  user_id: string;
  arcana_goal_id?: string | null;
  title: string;
  description?: string | null;
  target_date?: string | null;
  achieved_at?: string | null;
  evidence: Array<{ source: string; reference: string; observed_at?: string }>;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Biometrics + labs
// ---------------------------------------------------------------------------

export interface BiometricObservation {
  id: string;
  user_id: string;
  metric_kind: BiometricKind;
  value: number;
  unit?: string | null;
  reference_low?: number | null;
  reference_high?: number | null;
  source: BiometricSource;
  source_wearable?: WearableProvider | null;
  collected_at: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface LabResult {
  id: string;
  user_id: string;
  lab_kind: LabKind;
  panel_name?: string | null;
  ordered_by?: string | null;
  ordered_by_provider_id?: string | null;
  collection_date: string;
  result_value?: number | null;
  result_text?: string | null;
  unit?: string | null;
  reference_low?: number | null;
  reference_high?: number | null;
  flag?: LabFlag | null;
  lab_source?: string | null;
  notes?: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface WearableConnection {
  id: string;
  user_id: string;
  provider: WearableProvider;
  status: WearableStatus;
  connected_at?: string | null;
  last_sync_at?: string | null;
  scopes: string[];
  vault_reference?: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Insurance
// ---------------------------------------------------------------------------

export interface InsuranceDocument {
  id: string;
  user_id: string;
  insurance_plan_id?: string | null;
  document_kind: InsuranceDocumentKind;
  storage_path: string;
  mime_type?: string | null;
  ocr_status: OcrStatus;
  extracted_fields: Record<string, unknown>;
  uploaded_at: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Lead packages + consent
// ---------------------------------------------------------------------------

export interface LeadPackageConsent {
  id: string;
  user_id: string;
  recipient_provider_id?: string | null;
  consent_kind: LeadConsentKind;
  include_goals: boolean;
  include_constraints: boolean;
  include_motivation: boolean;
  include_biometrics: boolean;
  include_labs: boolean;
  include_protocols: boolean;
  include_supplements: boolean;
  include_medications: boolean;
  include_insurance: boolean;
  granted_at: string;
  revoked_at?: string | null;
  expires_at?: string | null;
  granted_via?: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

/**
 * Frozen snapshot of what a provider sees when a patient grants
 * consent. The payload is immutable. Sections are populated only when
 * the matching `include_*` flag was true at consent time.
 */
export interface LeadPackagePayload {
  schema_version: 'v1';
  patient_summary: {
    name_initials: string; // never full name
    age_band?: string; // never DOB
    sex?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
    membership_tier?: MembershipTier | null;
  };
  goals?: Array<{
    title: string;
    kind: ArcanaGoalKind;
    domain: ArcanaDomain;
    target_value?: number;
    target_unit?: string;
    target_date?: string;
    why?: string;
  }>;
  constraints?: Array<{
    kind: ConstraintKind;
    severity: ConstraintSeverity;
    description: string;
    value_numeric?: number;
    value_unit?: string;
  }>;
  motivation_summary?: {
    dominant_driver?: DominantDriver;
    secondary_driver?: DominantDriver;
    drivers_inferred_from_session: boolean;
    short_quote?: string;
  };
  biometric_snapshot?: Array<{
    metric_kind: BiometricKind;
    most_recent_value: number;
    unit?: string;
    collected_at: string;
    in_reference_range?: boolean;
  }>;
  lab_snapshot?: Array<{
    lab_kind: LabKind;
    collection_date: string;
    result_value?: number;
    unit?: string;
    flag?: LabFlag;
  }>;
  protocols?: Array<{
    kind: 'training' | 'nutrition' | 'sleep' | 'recovery' | 'behavior';
    protocol_name: string;
    sessions_per_week?: number;
    active: boolean;
  }>;
  supplements?: Array<{
    name: string;
    dose?: number;
    dose_unit?: string;
    frequency?: string;
    source: ProtocolSource;
  }>;
  // Medications: opt-in. We deliberately store narrative only — no NDC,
  // no prescriber IDs, no Rx numbers — to keep the package light and
  // PHI-minimal.
  medications?: Array<{ narrative: string; ongoing: boolean }>;
  insurance?: { plan_summary?: string; coverage_notes?: string };
  readiness_score?: number;
  probability_of_success?: number;
  key_risks: string[];
  recommended_discussion_topics: string[];
}

export interface LeadPackage {
  id: string;
  user_id: string;
  consent_id: string;
  recipient_provider_id?: string | null;
  generated_at: string;
  payload: LeadPackagePayload;
  payload_version: string;
  readiness_score?: number | null;
  probability_of_success?: number | null;
  key_risks: string[];
  recommended_discussion_topics: string[];
  shared_at?: string | null;
  accessed_count: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Concierge + membership
// ---------------------------------------------------------------------------

export interface ConciergePreferences {
  id: string;
  user_id: string;
  travel_profile: {
    travels_for_work?: boolean;
    typical_trips_per_month?: number;
    typical_trip_duration_days?: number;
    common_destinations?: string[];
  };
  gym_access_preferences: {
    home_gym?: boolean;
    commercial_gym?: boolean;
    boutique_studio?: boolean;
    outdoor?: boolean;
    travel_friendly_only?: boolean;
  };
  recovery_preferences: {
    sauna?: boolean;
    cold_plunge?: boolean;
    massage?: boolean;
    physical_therapy?: boolean;
    chiropractor?: boolean;
  };
  provider_preferences: {
    prefers_in_person?: boolean;
    prefers_telehealth?: boolean;
    preferred_provider_type?: string[];
  };
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ArcanaMembership {
  id: string;
  user_id: string;
  tier: MembershipTier;
  status: MembershipStatus;
  started_at: string;
  renewed_at?: string | null;
  ends_at?: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Engine I/O — Catch-Up & Cross-Domain
// ---------------------------------------------------------------------------

export type HealthStatus =
  | 'ahead_of_plan'
  | 'on_track'
  | 'slightly_behind'
  | 'meaningfully_behind'
  | 'critically_behind'
  | 'unknown';

export interface HealthCatchUpAction {
  id: string;
  title: string;
  rationale: string;
  goal_kind: ArcanaGoalKind | 'cross';
  domains_touched: ArcanaDomain[];
  effort: 'small' | 'medium' | 'large';
  realistic_recovery_pct: number; // 0..1 — fraction of gap recoverable
  horizon_months: number; // how long until it bites
  citations: Array<{ source: string; label: string }>;
  contraindications: string[]; // e.g. "uncontrolled hypertension"
  needs_provider_clearance: boolean;
}

export interface HealthCatchUpResult {
  status: HealthStatus;
  gap_size: number; // signed: negative = behind
  smallest_realistic_recovery: HealthCatchUpAction[];
  // Honest framing: tells the user what realistic recovery looks like.
  // We never suggest "start over." We suggest the smallest credible
  // delta-improvement compatible with their constraints.
  notes: string[];
}

export type CrossDomainHealthEffect =
  | 'energy'
  | 'productivity'
  | 'mood'
  | 'cognition'
  | 'sleep_quality'
  | 'metabolic_health'
  | 'cardiovascular_health'
  | 'longevity_quality';

export interface CrossDomainHealthLink {
  source_metric: BiometricKind | LabKind | ArcanaGoalKind;
  affects: CrossDomainHealthEffect;
  downstream_domain: 'career' | 'financial' | 'family' | 'longevity';
  effect_direction: 'positive' | 'negative';
  effect_magnitude_label: 'weak' | 'moderate' | 'strong';
  citation: { source: string; label: string };
}
