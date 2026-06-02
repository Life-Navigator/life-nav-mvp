/**
 * Outcome Intelligence — Sprint O shared types.
 *
 * Outcome optimization NEVER overrides:
 *   * Constitutional Governance (Sprint L + L2)
 *   * Character Layer (Sprint N.3)
 *   * Safety Layer (Sprint L + N.2)
 *   * Future Preservation (Sprint L2)
 *
 * Every score-producing helper accepts only safety-compliant inputs
 * (filtered upstream by `safety-gate.ts`). Operators surfacing these
 * scores to optimizers MUST consult the safety gate first.
 */

export type FlourishingAxis =
  | 'health'
  | 'safety'
  | 'relationships'
  | 'education'
  | 'career'
  | 'financial'
  | 'resilience'
  | 'responsibility'
  | 'future_opportunity';

export interface RecommendationContext {
  recommendation_id: string;
  user_id: string;
  tenant_id?: string | null;
  governance_audit_id?: string | null;
  generated_at: string;
  /** Sprint N.3 character review fields, if available. */
  character_score_overall?: number;
  character_score_weakest?: number;
  character_needs_regeneration?: boolean;
  character_dignity_violation?: boolean;
  character_family_table_passes?: boolean;
  character_trusted_advisor_passes?: boolean;
  character_flourishing_harming_axes?: FlourishingAxis[];
  /** Constitutional verdict (Sprint L2). */
  constitutional_verdict?: string;
  /** Sprint L2 risk_level on the audit row. */
  risk_level?: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  /** Sprint L2 governance approval — must be true for the rec to count. */
  governance_approved?: boolean;
  /** Optional goal the rec is associated with. */
  goal_id?: string | null;
}

export interface OutcomeLifecycleState {
  state: 'generated' | 'viewed' | 'accepted' | 'ignored' | 'dismissed' | 'completed';
  generated_at: string;
  viewed_at?: string | null;
  accepted_at?: string | null;
  ignored_at?: string | null;
  dismissed_at?: string | null;
  completed_at?: string | null;
  outcome_score?: number | null;
}

export interface FeedbackPayload {
  helpfulness?: 'helpful' | 'neutral' | 'not_helpful';
  explanation_clarity?: 'clear' | 'confusing';
  trust?: 'trust' | 'neutral' | 'distrust';
  outcome?: 'improved' | 'no_change' | 'worse' | 'unknown';
}

export interface EffectivenessScore {
  effectiveness_score: number; // [0,1]
  acceptance_score: number;
  speed_score: number;
  outcome_score: number;
  reversal_penalty: number;
  attribution_score: number;
  character_score: number;
  is_safety_compliant: boolean;
  attribution_links_count: number;
  computed_at: string;
}

export interface DecisionQualityIndex {
  user_id: string;
  window_days: number;
  dqi_overall: number; // [0,1]
  acceptance_rate: number;
  completion_rate: number;
  reversal_rate: number;
  avg_effectiveness: number;
  avg_character_score: number;
  future_preservation_score: number;
  recommendations_evaluated: number;
  computed_at: string;
}

export interface AttributionLink {
  recommendation_id: string;
  user_id: string;
  goal_id?: string | null;
  delta: number; // [-1, 1]
  attribution_confidence: number; // [0, 1]
  flourishing_axis?: FlourishingAxis;
  lag_days: number;
}

export interface GoalProgressSnapshot {
  goal_id: string;
  progress_pct: number; // [0, 1]
  progress_kind: 'baseline' | 'milestone' | 'periodic' | 'completion' | 'reversal';
  milestone?: string;
  recorded_at: string;
  recommendation_id?: string;
}

export interface LifeProgressSnapshot {
  user_id: string;
  window_days: number;
  health: number;
  safety: number;
  relationships: number;
  education: number;
  career: number;
  financial: number;
  resilience: number;
  responsibility: number;
  future_opportunity: number;
  overall: number;
  trend: 'up' | 'flat' | 'down';
  computed_at: string;
}

export interface TenantOutcomeReport {
  tenant_id: string;
  window_days: number;
  active_users: number;
  recommendations_total: number;
  acceptance_rate: number;
  completion_rate: number;
  avg_effectiveness: number;
  avg_dqi: number;
  avg_life_progress: number;
  safety_compliance_rate: number;
  computed_at: string;
}
