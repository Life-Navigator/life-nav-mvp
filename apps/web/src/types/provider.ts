/**
 * Provider GraphRAG types — mirror migration 085.
 *
 * Provider identity is a Supabase auth user with a row in
 * `providers.provider_profiles` linking the auth user to credentials.
 * A single auth user can be both a patient (personal LifeNavigator)
 * AND a provider (their patient panel) — the schema separates roles
 * cleanly.
 *
 * Access control: every provider read against patient data passes
 * through the SECURITY DEFINER function
 * `providers.has_access_to(provider_user_id, patient_user_id, domain,
 * min_sensitivity)`. The TS layer is the thin caller — RLS + the
 * function are the actual gatekeepers.
 */

export type ProviderType =
  | 'physician'
  | 'nurse_practitioner'
  | 'coach'
  | 'nutritionist'
  | 'trainer'
  | 'other_licensed';

export type EngagementStatus = 'pending' | 'active' | 'paused' | 'revoked' | 'expired' | 'declined';

export type SensitivityLevel = 'low' | 'medium' | 'high';

export type ProviderDomain =
  | 'health'
  | 'financial'
  | 'career'
  | 'education'
  | 'estate'
  | 'benefits'
  | 'insurance'
  | 'behavioral'
  | 'rehabilitation'
  // Sprint C — Arcana sub-domains; providers may scope here too
  | 'performance'
  | 'recovery'
  | 'longevity'
  | 'body_composition'
  | 'preventative_care';

export type ProviderRecommendationStatus =
  | 'issued'
  | 'accepted'
  | 'rejected'
  | 'modified'
  | 'completed'
  | 'abandoned'
  | 'superseded';

export type KnowledgeEntryKind =
  | 'protocol'
  | 'template'
  | 'assessment'
  | 'reading'
  | 'reference'
  | 'case_note';

export type KnowledgeVisibility =
  | 'provider_only'
  | 'shared_with_patients'
  | 'shared_with_providers';

// ---------------------------------------------------------------------------
// Provider profile
// ---------------------------------------------------------------------------

export interface ProviderProfile {
  id: string;
  user_id: string;
  provider_type: ProviderType;
  legal_name: string;
  display_name?: string | null;
  primary_license_number?: string | null;
  primary_license_state?: string | null;
  primary_license_jurisdiction?: string | null;
  specialties: string[];
  primary_domains: ProviderDomain[];
  bio?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  verified: boolean;
  verified_at?: string | null;
  verified_by?: string | null;
  tos_accepted_at?: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Engagement
// ---------------------------------------------------------------------------

export interface ProviderEngagement {
  id: string;
  provider_id: string;
  patient_user_id: string;
  status: EngagementStatus;
  allowed_domains: ProviderDomain[];
  max_sensitivity: SensitivityLevel;
  can_issue_recommendations: boolean;
  initiated_by: 'patient' | 'provider' | 'admin';
  invited_at: string;
  accepted_at?: string | null;
  expires_at?: string | null;
  revoked_at?: string | null;
  revoked_reason?: string | null;
  notes_for_patient?: string | null;
  notes_for_provider?: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Consent scope override
// ---------------------------------------------------------------------------

export interface ProviderConsentScope {
  id: string;
  engagement_id: string;
  patient_user_id: string;
  scope_kind: 'grant' | 'deny';
  entity_type: string;
  entity_filter: Record<string, unknown>;
  granted_at: string;
  revoked_at?: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Provider recommendation
// ---------------------------------------------------------------------------

export interface ProviderRecommendation {
  id: string;
  provider_id: string;
  patient_user_id: string;
  engagement_id: string;
  domain: ProviderDomain;
  title: string;
  body: string;
  rationale?: string | null;
  related_goal_id?: string | null;
  expected_horizon_months?: number | null;
  expected_strength?: number | null;
  citations: Array<{
    label: string;
    source?: string;
    citation_reference?: string;
    confidence?: number;
  }>;
  issued_at: string;
  acknowledged_at?: string | null;
  accepted_at?: string | null;
  rejected_at?: string | null;
  rejected_reason?: string | null;
  completed_at?: string | null;
  superseded_by?: string | null;
  status: ProviderRecommendationStatus;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Provider outcome
// ---------------------------------------------------------------------------

export interface ProviderOutcome {
  id: string;
  recommendation_id: string;
  patient_user_id: string;
  provider_id: string;
  observed_at: string;
  dimension: string;
  observed_value?: number | null;
  observed_unit?: string | null;
  expected_value?: number | null;
  delta?: number | null;
  accuracy_score?: number | null;
  user_satisfaction?: number | null;
  outcome_quality?: number | null;
  source: 'self_report' | 'provider_report' | 'wearable' | 'lab' | 'computed';
  notes?: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Provider knowledge entry
// ---------------------------------------------------------------------------

export interface ProviderKnowledgeEntry {
  id: string;
  provider_id: string;
  entry_kind: KnowledgeEntryKind;
  title: string;
  body: string;
  domain: ProviderDomain;
  tags: string[];
  citations: unknown[];
  visibility: KnowledgeVisibility;
  version: number;
  archived_at?: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Provider analytics
// ---------------------------------------------------------------------------

export interface ProviderAnalytics {
  id: string;
  provider_id: string;
  period_start: string;
  period: 'weekly' | 'monthly' | 'quarterly' | 'annual';
  active_patient_count: number;
  recommendations_issued: number;
  recommendations_accepted: number;
  recommendations_completed: number;
  recommendations_rejected: number;
  recommendations_abandoned: number;
  success_rate?: number | null;
  completion_rate?: number | null;
  mean_outcome_quality?: number | null;
  mean_user_satisfaction?: number | null;
  computed_at: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Patient view — the scoped output assembled by ProviderViewService
// ---------------------------------------------------------------------------

export interface PatientViewRow {
  goal_id: string;
  goal_title: string;
  goal_domain: string;
  current_progress: number;
  most_likely_prob: number;
  probability_range: string;
  confidence: number;
  recommendation_count: number;
  last_observation_at?: string | null;
}

export interface PatientView {
  patient_user_id: string;
  provider_id: string;
  scope_domain: ProviderDomain;
  granted_at: string;
  computed_at: string;
  rows: PatientViewRow[];
  /** Provider can NEVER see fields not declared here. */
  visible_fields: string[];
}

// ---------------------------------------------------------------------------
// Access decision
// ---------------------------------------------------------------------------

export interface AccessDecision {
  allowed: boolean;
  /** Reasons access was denied (empty when allowed). */
  reasons: Array<
    | 'engagement_missing'
    | 'engagement_not_active'
    | 'engagement_not_accepted'
    | 'engagement_revoked'
    | 'engagement_expired'
    | 'domain_out_of_scope'
    | 'sensitivity_exceeds_max'
    | 'provider_not_verified'
  >;
}
