/**
 * Shared types for the User Graph onboarding capture.
 *
 * These mirror the columns in migration 060_user_graph_foundation.sql and the
 * payload shapes accepted by the /api/onboarding/{life-vision,constraints,
 * decision-preferences,commitment-levels,motivations,domain-risk} routes.
 */

export type LifeVisionHorizon =
  | '1_year'
  | '3_year'
  | '5_year'
  | '10_year'
  | 'definition_of_success'
  | 'fears_to_avoid';

export interface LifeVisionEntry {
  horizon: LifeVisionHorizon;
  vision_text: string;
  domains?: string[];
}

export type ConstraintDimension = 'time' | 'money' | 'health' | 'family' | 'geography' | 'other';

export interface UserConstraintInput {
  dimension: ConstraintDimension;
  severity: 'hard' | 'soft';
  description: string;
  value_numeric?: number | null;
  value_unit?: string | null;
}

export type DecisionAxis = 'speed' | 'certainty' | 'flexibility' | 'upside';

export interface DecisionPreferenceInput {
  axis: DecisionAxis;
  weight: number; // 0..1
}

export type CommitmentDomain =
  | 'financial'
  | 'career'
  | 'education'
  | 'health'
  | 'family'
  | 'wellness'
  | 'lifestyle'
  | 'overall';

export interface CommitmentLevelInput {
  domain: CommitmentDomain;
  hours_per_week?: number | null;
  energy_level?: 'low' | 'medium' | 'high' | null;
  duration_weeks?: number | null;
}

export type MotivationType = 'intrinsic' | 'extrinsic' | 'values_based' | 'identity' | 'fear_based';

export interface MotivationInput {
  motivation_text: string;
  motivation_type?: MotivationType | null;
  intensity?: number | null; // 1..10
  goal_id?: string | null;
}

export type RiskDomain = 'financial' | 'career' | 'education' | 'health' | 'entrepreneurship';

export interface DomainRiskInput {
  domain: RiskDomain;
  tolerance_score: number; // 0..1
}

export interface UserGraphPayload {
  life_vision: LifeVisionEntry[];
  constraints: UserConstraintInput[];
  decision_preferences: DecisionPreferenceInput[];
  commitment_levels: CommitmentLevelInput[];
  domain_risk_tolerance: DomainRiskInput[];
  motivations: MotivationInput[];
}

export const EMPTY_USER_GRAPH_PAYLOAD: UserGraphPayload = {
  life_vision: [],
  constraints: [],
  decision_preferences: [],
  commitment_levels: [],
  domain_risk_tolerance: [],
  motivations: [],
};
