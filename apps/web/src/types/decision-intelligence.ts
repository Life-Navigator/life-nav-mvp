/**
 * Decision-intelligence types — mirror migration 080.
 *
 * All numeric fields in [0,1] unless otherwise noted. Timestamps are
 * ISO 8601 strings.
 */

export type ProgressEventType =
  | 'decision_made'
  | 'outcome_observed'
  | 'milestone_reached'
  | 'snapshot_taken'
  | 'manual_adjustment'
  | 'rollback';

export type ProgressPeriod = 'weekly' | 'monthly' | 'quarterly' | 'annual';

export type AttributionLabel =
  | 'CONTRIBUTED_TO'
  | 'INFLUENCED'
  | 'ACCELERATED'
  | 'DELAYED'
  | 'BLOCKED'
  | 'SUPPORTED';

export type DomainKey =
  | 'financial'
  | 'career'
  | 'education'
  | 'health'
  | 'insurance'
  | 'benefits'
  | 'estate'
  | 'entrepreneurship'
  | 'family'
  | 'cross_domain';

// ---------------------------------------------------------------------------
// Phase 1 — Goal Progress
// ---------------------------------------------------------------------------

export interface GoalProgressSnapshot {
  id: string;
  user_id: string;
  goal_id: string;
  snapshot_at: string;
  score: number;
  confidence?: number | null;
  source: 'engine' | 'self_report' | 'computed' | 'admin';
  inputs: Record<string, unknown>;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface GoalProgressEvent {
  id: string;
  user_id: string;
  goal_id: string;
  event_type: ProgressEventType;
  delta: number;
  occurred_at: string;
  decision_id?: string | null;
  outcome_id?: string | null;
  snapshot_id?: string | null;
  reason?: string | null;
  confidence?: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface GoalProgressScore {
  id: string;
  user_id: string;
  goal_id: string;
  period: ProgressPeriod;
  period_start: string;
  period_end?: string | null;
  score: number;
  delta: number;
  confidence?: number | null;
  events_count: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface GoalProgressPrediction {
  id: string;
  user_id: string;
  goal_id: string;
  predicted_at: string;
  target_date: string;
  predicted_score: number;
  confidence: number;
  model_version: string;
  inputs: Record<string, unknown>;
  validated_at?: string | null;
  validation_score?: number | null;
  validation_error?: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

/** Output of GoalProgressService.score() — pure function result. */
export interface GoalProgressComputation {
  goal_progress_delta: number;
  goal_progress_score: number;
  confidence: number;
  reasoning: string[];
}

// ---------------------------------------------------------------------------
// Phase 2 — Cross-Domain Attribution
// ---------------------------------------------------------------------------

export interface CrossDomainImpact {
  id: string;
  user_id: string;
  source_domain: DomainKey;
  target_domain: DomainKey;
  label: AttributionLabel;
  strength: number;
  confidence: number;
  evidence: Array<Record<string, unknown>>;
  observed_at: string;
  source_outcome_id?: string | null;
  source_goal_id?: string | null;
  target_goal_id?: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface OutcomeAttribution {
  id: string;
  user_id: string;
  outcome_id: string;
  attributed_to_decision_id?: string | null;
  attributed_to_action_id?: string | null;
  attributed_to_recommendation_summary?: string | null;
  attribution_share: number;
  confidence: number;
  reasoning?: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Phase 3 — Calibration
// ---------------------------------------------------------------------------

export interface PredictionCalibration {
  id: string;
  user_id: string;
  predicted_at: string;
  predicted_confidence: number;
  predicted_value?: number | null;
  actual_correct?: boolean | null;
  actual_value?: number | null;
  bucket: string;
  source_run_id?: string | null;
  source_action_id?: string | null;
  source_decision_id?: string | null;
  source_outcome_id?: string | null;
  validated_at?: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface RecommendationAccuracy {
  id: string;
  user_id: string;
  advisor_run_id?: string | null;
  action_id: string;
  predicted_strength?: number | null;
  predicted_confidence?: number | null;
  observed_outcome_quality?: number | null;
  observed_strength?: number | null;
  accuracy_score?: number | null;
  computed_at: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AdvisorAccuracy {
  id: string;
  user_id: string;
  advisor_run_id: string;
  computed_at: string;
  total_actions: number;
  completed_actions: number;
  abandoned_actions: number;
  rejected_actions: number;
  mean_predicted_confidence?: number | null;
  mean_observed_outcome_quality?: number | null;
  brier_score?: number | null;
  calibration_error?: number | null;
  confidence_accuracy_gap?: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CalibrationBin {
  bucket: string; // e.g. '0.8-0.9'
  range_lo: number;
  range_hi: number;
  n: number;
  mean_predicted: number;
  mean_actual: number;
  gap: number; // mean_predicted - mean_actual
}

export interface CalibrationCurve {
  brier_score: number;
  calibration_error: number;
  confidence_accuracy_gap: number;
  bins: CalibrationBin[];
  n: number;
}

// ---------------------------------------------------------------------------
// Phase 4 — Recommendation Quality
// ---------------------------------------------------------------------------

export interface RecommendationQualityMetric {
  id: string;
  user_id: string;
  period: ProgressPeriod;
  period_start: string;
  recommendation_type: string;
  domain: string;
  root_goal_id?: string | null;
  advisor_run_id?: string | null;
  total: number;
  accepted: number;
  rejected: number;
  modified: number;
  deferred: number;
  completed: number;
  abandoned: number;
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
// Phase 5 — Pathway Effectiveness
// ---------------------------------------------------------------------------

export interface PathwayEffectiveness {
  id: string;
  user_id?: string | null; // NULL = global cohort
  root_goal_concept: string;
  pathway_signature: string;
  pathway_label: string;
  pathway_edges: Array<{ label: string; target_canonical_name?: string }>;
  sample_size: number;
  success_count: number;
  success_rate?: number | null;
  completion_rate?: number | null;
  mean_duration_months?: number | null;
  confidence?: number | null;
  computed_at: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}
