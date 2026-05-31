/**
 * AdvisorReasoningService — shared types.
 *
 * Cross-domain recommendation produced by joining the user's personal
 * graph (goals, constraints, capabilities) with the central ontology
 * (Credential → CareerRole → Income → FinancialGoal, etc.).
 */

import type { GoalPathway, PathwayNode } from '@/types/goal-hierarchy';

export interface AdvisorInputs {
  user_id: string;
  /** What the user said they want — drives root-goal discovery if no
   *  stored interpretation exists. */
  stated_goal_claim?: string;
  /** Optional override — skip discovery and use this goal id as root. */
  root_goal_id_override?: string;
  /** If set, prefer this many top supporting/blocking entities per
   *  domain. Default 5. */
  domain_topk?: number;
}

export interface DiscoveredRootGoal {
  goal_id?: string;
  stated_goal?: string;
  inferred_true_goal: string;
  confidence: number;
  source: 'override' | 'goal_interpretation' | 'goals_table' | 'fallback_from_claim';
}

export interface PersonalContext {
  constraints: Array<{ id: string; label: string; severity?: string; domain?: string }>;
  capabilities: Array<{ id: string; label: string; level?: string; domain?: string }>;
  motivations: Array<{ id: string; label: string; weight?: number }>;
  decision_preferences: Array<{ id: string; pattern: string; strength?: number }>;
  domain_risk_tolerance: Array<{ id: string; domain: string; tolerance: number }>;
  commitment_levels: Array<{ id: string; area: string; level: number }>;
}

export interface CentralLink {
  entity_id: string;
  canonical_name: string;
  entity_type: string;
  domain: string;
  label: string; // ontology relationship label
  direction: 'supports' | 'blocks' | 'requires' | 'related';
  strength: number;
  confidence: number;
  provenance_summary?: string;
}

export interface DomainImpact {
  domain: string;
  supporting: CentralLink[];
  blocking: CentralLink[];
  required: CentralLink[];
}

export interface RecommendedAction {
  id: string;
  title: string;
  domain: string;
  rationale: string;
  expected_strength: number; // 0..1 — projected impact on root goal
  related_central_entity_ids: string[];
  related_personal_goal_ids: string[];
}

export interface RecommendationOutput {
  root_goal: DiscoveredRootGoal;
  supporting_goals: PathwayNode[];
  blocked_goals: PathwayNode[];
  required_actions: RecommendedAction[];
  recommended_sequence: string[]; // action ids
  confidence_score: number; // 0..1
  tradeoffs: Array<{ summary: string; gives_up: string; gains: string }>;
  timeline: Array<{
    horizon: 'now' | 'this_quarter' | 'this_year' | 'long_term';
    action_ids: string[];
  }>;
  risks: string[];
  assumptions: string[];
  cross_domain_impacts: DomainImpact[];
  pathway?: GoalPathway; // raw output from GoalPathService if computed
  simulation_summary?: {
    evaluated_scenarios?: number;
    best_scenario_id?: string;
    score?: number;
    note?: string;
  };
}
