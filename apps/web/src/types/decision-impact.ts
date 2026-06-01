/**
 * Decision-impact + probability-distribution types — mirror migration 081.
 *
 * Every numeric field that represents a probability is `[0,1]`.
 * Every delta is `[-1, 1]`.
 *
 * The quantile fields on `ProbabilityDistribution` are enforced
 * monotonic by a DB CHECK constraint; the TS side trusts the DB.
 */

export type TimeHorizon =
  | 'immediate'
  | '3_month'
  | '1_year'
  | '3_year'
  | '5_year'
  | '10_year'
  | '20_year';

/** All horizons in calendar order. Used by ranking + dampening code. */
export const TIME_HORIZONS_ORDER: TimeHorizon[] = [
  'immediate',
  '3_month',
  '1_year',
  '3_year',
  '5_year',
  '10_year',
  '20_year',
];

/** Approximate months for each horizon (used in dampening curve). */
export const HORIZON_MONTHS: Record<TimeHorizon, number> = {
  immediate: 0,
  '3_month': 3,
  '1_year': 12,
  '3_year': 36,
  '5_year': 60,
  '10_year': 120,
  '20_year': 240,
};

export type CatchUpStatus = 'on_track' | 'ahead' | 'behind' | 'at_risk';

export type DomainKey =
  | 'financial'
  | 'career'
  | 'education'
  | 'health'
  | 'insurance'
  | 'benefits'
  | 'estate'
  | 'entrepreneurship'
  | 'family';

/**
 * The eight structural variables that allow a single decision to keep
 * meaningful long-horizon impact instead of being dampened.
 *
 * Per spec: income trajectory, education credential, health trajectory,
 * debt structure, family obligations, business ownership, career path,
 * legal/estate structure.
 */
export type StructuralVariable =
  | 'income_trajectory'
  | 'education_credential'
  | 'health_trajectory'
  | 'debt_structure'
  | 'family_obligations'
  | 'business_ownership'
  | 'career_path'
  | 'legal_estate_structure';

// ---------------------------------------------------------------------------
// XAI — every engine output wraps this in
// ---------------------------------------------------------------------------

export interface XAIExplanation {
  assumptions: string[];
  variance_factors: Array<{
    kind: string;
    label: string;
    effect: number; // -widens, +narrows
    confidence: number;
  }>;
  evidence: Array<{
    label: string;
    source:
      | 'central_ontology'
      | 'personal_history'
      | 'pathway_effectiveness'
      | 'recommendation_quality'
      | 'self_report';
    citation_reference?: string;
    confidence: number;
  }>;
  confidence: number;
  calibrated_confidence?: number;
  what_would_change_estimate: string[];
  related_goals_affected: Array<{ goal_id: string; effect: number }>;
  domains_affected: DomainKey[];
}

// ---------------------------------------------------------------------------
// Probability distribution
// ---------------------------------------------------------------------------

export interface ProbabilityDistribution {
  goal_id: string;
  time_horizon: TimeHorizon;
  scenario_id?: string;
  decision_id?: string;
  worst_case: number;
  p10: number;
  p25: number;
  most_likely: number;
  p75: number;
  p90: number;
  best_case: number;
  confidence: number;
  /** Same shape as XAIExplanation; bundled for completeness. */
  explanation: XAIExplanation;
}

// ---------------------------------------------------------------------------
// Decision impact
// ---------------------------------------------------------------------------

export interface HorizonImpact {
  time_horizon: TimeHorizon;
  probability_delta: number;
  timeline_delta_months?: number;
  risk_delta?: number;
  confidence: number;
}

export interface DecisionImpact {
  goal_id: string;
  decision_label: string;
  decision_id?: string;
  is_structural: boolean;
  structural_variable?: StructuralVariable;
  per_horizon: HorizonImpact[];
  related_goal_effects: Array<{ goal_id: string; delta: number }>;
  blocked_goal_effects: Array<{ goal_id: string; delta: number }>;
  reason: string;
  explanation: XAIExplanation;
}

// ---------------------------------------------------------------------------
// Catch-up + ahead-of-plan
// ---------------------------------------------------------------------------

export interface CatchUpAction {
  domain: DomainKey;
  description: string;
  magnitude?: string; // "+$400/month", "+2 sessions/week"
  expected_probability_delta: number;
  feasibility: number; // 0..1 given user constraints/capacity
}

export interface CatchUpPlan {
  goal_id: string;
  status: CatchUpStatus;
  gap: {
    current_score: number;
    target_score: number;
    delta: number;
    months_behind?: number;
  };
  catch_up_actions: CatchUpAction[];
  minimum_required_change: string;
  recommended_plan: string;
  probability_after_catch_up: number;
  tradeoffs: Array<{ summary: string; gives_up: string; gains: string }>;
  risks: string[];
  explanation: XAIExplanation;
}

export interface AheadOption {
  kind:
    | 'preserve_and_reduce_risk'
    | 'accelerate'
    | 'invest_more'
    | 'diversify_into_new_domain'
    | 'add_protection'
    | 'reduce_intensity';
  domain: DomainKey;
  description: string;
  expected_probability_delta: number;
  fits_risk_tolerance: boolean;
}

export interface AheadOfPlanPlan {
  goal_id: string;
  status: CatchUpStatus; // 'ahead'
  cushion: {
    current_score: number;
    target_score: number;
    delta: number;
  };
  options: AheadOption[];
  recommended_default: AheadOption;
  explanation: XAIExplanation;
}

// ---------------------------------------------------------------------------
// Marginal impact ranking
// ---------------------------------------------------------------------------

export interface MarginalImpactRankItem {
  rank: number;
  decision: string; // human-readable
  decision_label_canonical: string;
  target_goal: string;
  target_goal_id?: string;
  marginal_impact: number; // [0,1] expected uplift in probability_after - probability_before
  time_horizon: TimeHorizon;
  confidence: number;
  domain: DomainKey;
  reason: string;
  tradeoffs: string[];
}

export interface MarginalImpactRanking {
  user_id: string;
  ranked: MarginalImpactRankItem[];
  computed_at: string;
  explanation: XAIExplanation;
}

// ---------------------------------------------------------------------------
// Variance factors (also stored as a table row)
// ---------------------------------------------------------------------------

export type VarianceFactorKind =
  | 'horizon_length'
  | 'support_count'
  | 'historical_accuracy'
  | 'recommendation_quality'
  | 'pathway_effectiveness'
  | 'constraint_severity'
  | 'risk_tolerance'
  | 'external_dependency'
  | 'structural_decision_pending'
  | 'data_sparsity';

export interface VarianceFactor {
  kind: VarianceFactorKind;
  label: string;
  effect: number; // -widens, +narrows
  confidence: number;
}
