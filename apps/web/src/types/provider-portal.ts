/**
 * Provider Portal types — Sprint J.
 *
 * The portal is a presentation + workflow layer on top of the
 * Sprint I provider GraphRAG. These types describe the assembled
 * dashboards and view models the portal API routes return; they are
 * not new persisted entities except for the two tables added in
 * migration 087 (messages, lead_workflow_events).
 */

import type {
  EngagementStatus,
  ProviderDomain,
  ProviderRecommendation,
  ProviderRecommendationStatus,
} from './provider';
import type {
  ArcanaDomain,
  ArcanaGoalKind,
  BiometricKind,
  HealthStatus,
  LabKind,
  LeadPackagePayload,
} from './arcana';

// ---------------------------------------------------------------------------
// Lead workflow
// ---------------------------------------------------------------------------

export type LeadEventKind =
  | 'lead_received'
  | 'lead_viewed'
  | 'lead_accepted'
  | 'lead_declined'
  | 'lead_withdrawn_by_patient'
  | 'engagement_paused'
  | 'engagement_resumed'
  | 'engagement_revoked'
  | 'engagement_expired';

export interface LeadWorkflowEvent {
  id: string;
  provider_id: string;
  patient_user_id: string;
  engagement_id?: string | null;
  lead_package_id?: string | null;
  event_kind: LeadEventKind;
  reason?: string | null;
  actor_user_id?: string | null;
  occurred_at: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export type LeadStatus = 'new' | 'pending' | 'accepted' | 'declined' | 'withdrawn';

/** Row shown on the dashboard's "My Leads" list. */
export interface LeadSummary {
  lead_package_id: string;
  patient_user_id: string;
  patient_initials: string;
  age_band?: string | null;
  primary_goal_title?: string | null;
  dominant_driver?: string | null;
  readiness_score?: number | null;
  probability_of_success?: number | null;
  key_risk_count: number;
  status: LeadStatus;
  generated_at: string;
  shared_at?: string | null;
  last_event_at?: string | null;
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

export type MessageKind =
  | 'follow_up_request'
  | 'review_request'
  | 'clarification_request'
  | 'general_note'
  | 'patient_reply'
  | 'system_event';

export type MessageSenderRole = 'provider' | 'patient' | 'system';

export interface ProviderMessage {
  id: string;
  engagement_id: string;
  provider_id: string;
  patient_user_id: string;
  sender_user_id: string;
  sender_role: MessageSenderRole;
  kind: MessageKind;
  subject?: string | null;
  body: string;
  related_recommendation_id?: string | null;
  related_lead_package_id?: string | null;
  read_at?: string | null;
  hidden_for_sender: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export interface DashboardLeadBuckets {
  new_count: number;
  pending_count: number;
  accepted_count: number;
  declined_count: number;
  rows: LeadSummary[];
}

export interface DashboardClientRow {
  engagement_id: string;
  patient_user_id: string;
  patient_initials: string;
  status: EngagementStatus;
  scope_domains: ProviderDomain[];
  most_recent_recommendation_at?: string | null;
  most_recent_outcome_at?: string | null;
  most_recent_readiness?: number | null;
  most_recent_probability?: number | null;
  probability_delta?: number | null;
  open_recommendation_count: number;
  flag_low_readiness: boolean;
  flag_falling_probability: boolean;
  flag_missed_milestones: boolean;
  flag_poor_compliance: boolean;
}

export interface DashboardClientBuckets {
  active_count: number;
  paused_count: number;
  completed_count: number;
  rows: DashboardClientRow[];
}

export interface DashboardAtRiskRow {
  engagement_id: string;
  patient_user_id: string;
  patient_initials: string;
  reasons: string[]; // human-readable risk flags
  severity: 'low' | 'medium' | 'high';
  last_observed_at?: string | null;
}

export interface DashboardUpcomingRow {
  engagement_id: string;
  patient_user_id: string;
  patient_initials: string;
  kind: 'scheduled_review' | 'follow_up' | 'expiring_engagement';
  due_at: string;
  reason?: string;
}

export interface DashboardProviderMetrics {
  active_clients: number;
  recommendation_acceptance_rate: number;
  completion_rate: number;
  mean_outcome_quality?: number | null;
}

export interface PortalDashboard {
  generated_at: string;
  provider_id: string;
  leads: DashboardLeadBuckets;
  clients: DashboardClientBuckets;
  at_risk: DashboardAtRiskRow[];
  upcoming: DashboardUpcomingRow[];
  metrics: DashboardProviderMetrics;
}

// ---------------------------------------------------------------------------
// Lead Workspace (Phase 2)
// ---------------------------------------------------------------------------

export interface LeadWorkspaceView {
  lead_package_id: string;
  patient_user_id: string;
  generated_at: string;
  consent_active: boolean;
  consent_reasons: string[];
  payload: LeadPackagePayload; // already consent-scoped
  workflow: LeadWorkflowEvent[];
}

// ---------------------------------------------------------------------------
// Client Workspace (Phase 3)
// ---------------------------------------------------------------------------

export interface ClientWorkspaceGoalProgress {
  goal_id: string;
  goal_title: string;
  domain: ProviderDomain | ArcanaDomain;
  current_progress?: number | null;
  target_progress?: number | null;
  probability_now?: number | null;
  probability_prior?: number | null;
  probability_delta?: number | null;
  catch_up_status?: HealthStatus | string | null;
  last_observation_at?: string | null;
}

export interface ClientWorkspaceView {
  engagement_id: string;
  patient_user_id: string;
  patient_initials: string;
  scope_domains: ProviderDomain[];
  goals: ClientWorkspaceGoalProgress[];
  recommendations: ProviderRecommendation[];
  recommendation_stats: {
    issued: number;
    accepted: number;
    completed: number;
    abandoned: number;
    rejected: number;
    acceptance_rate: number;
    completion_rate: number;
  };
  xai_summary_url: string; // pointer the UI uses to call /xai
  generated_at: string;
}

// ---------------------------------------------------------------------------
// Recommendation builder (Phase 4)
// ---------------------------------------------------------------------------

export interface RecommendationDraft {
  engagement_id: string;
  patient_user_id: string;
  domain: ProviderDomain;
  title: string;
  body: string;
  rationale?: string;
  expected_horizon_months?: number;
  expected_strength?: number;
  related_goal_id?: string | null;
  citations: Array<{
    label: string;
    source?: string;
    citation_reference?: string;
    confidence?: number;
  }>;
  assumptions: string[];
  risks: string[];
}

export interface RecommendationXAIBundle {
  why_chain: {
    target_kind: 'provider_recommendation';
    target_id: string;
    steps: Array<{
      depth: number;
      claim: string;
      evidence_refs: string[];
    }>;
    computed_at: string;
  };
  evidence_links: Array<{
    label: string;
    source?: string;
    citation_reference?: string;
    confidence?: number;
  }>;
  assumptions: Array<{
    text: string;
    severity: 'critical' | 'load_bearing' | 'informational';
  }>;
  counterfactuals: Array<{
    perturbation: string;
    expected_change: string;
  }>;
  tradeoffs: Array<{
    summary: string;
    gives_up: string;
    gains: string;
  }>;
  confidence: number;
}

// ---------------------------------------------------------------------------
// Progress monitoring (Phase 5)
// ---------------------------------------------------------------------------

export interface BiometricTrendPoint {
  collected_at: string;
  value: number;
  unit?: string | null;
  source?: string | null;
}

export interface BiometricTrend {
  metric_kind: BiometricKind;
  points: BiometricTrendPoint[];
  most_recent?: number | null;
  prior?: number | null;
  delta?: number | null;
}

export interface LabTrendPoint {
  collection_date: string;
  result_value?: number | null;
  unit?: string | null;
  flag?: 'low' | 'normal' | 'borderline' | 'high' | 'critical' | null;
}

export interface LabTrend {
  lab_kind: LabKind;
  points: LabTrendPoint[];
}

export interface ComplianceSummary {
  training_adherence?: number | null;
  nutrition_adherence?: number | null;
  recovery_adherence?: number | null;
  appointment_adherence?: number | null;
}

export interface ProbabilityTrend {
  current?: number | null;
  prior?: number | null;
  delta?: number | null;
}

export interface ProgressMonitoringView {
  engagement_id: string;
  patient_user_id: string;
  scope_domains: ProviderDomain[];
  biometrics: BiometricTrend[];
  labs: LabTrend[];
  compliance: ComplianceSummary;
  probability: ProbabilityTrend;
  goals_summary: ClientWorkspaceGoalProgress[];
  generated_at: string;
}

// ---------------------------------------------------------------------------
// Analytics (Phase 6) — extends ProviderAnalytics with derived fields
// ---------------------------------------------------------------------------

export interface ProviderEffectivenessAggregate {
  provider_id: string;
  period: 'weekly' | 'monthly' | 'quarterly';
  period_start: string;
  active_clients: number;
  acceptance_rate: number;
  completion_rate: number;
  mean_outcome_quality?: number | null;
  client_retention_rate?: number | null;
  readiness_improvement_mean?: number | null;
  probability_improvement_mean?: number | null;
  goal_completion_rate?: number | null;
  effectiveness_score?: number | null;
}

// ---------------------------------------------------------------------------
// Helpers used by the dashboard service
// ---------------------------------------------------------------------------

export type EngagementStatusGroup = 'active' | 'paused' | 'completed' | 'other';

export function classifyEngagementGroup(s: EngagementStatus): EngagementStatusGroup {
  if (s === 'active') return 'active';
  if (s === 'paused') return 'paused';
  if (s === 'expired' || s === 'revoked' || s === 'declined') return 'completed';
  return 'other';
}

export type LeadGoalKind = ArcanaGoalKind;

export type RecommendationStatusGroup = 'open' | 'in_progress' | 'closed';

export function classifyRecommendationGroup(
  s: ProviderRecommendationStatus
): RecommendationStatusGroup {
  if (s === 'issued' || s === 'accepted' || s === 'modified') return 'open';
  if (s === 'completed' || s === 'abandoned' || s === 'rejected' || s === 'superseded')
    return 'closed';
  return 'in_progress';
}
