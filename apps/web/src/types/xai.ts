/**
 * XAI + Trust Layer types — mirror migration 082.
 *
 * Every shape here is structured, deterministic, and free of LLM
 * paraphrasing. The five trust questions
 *
 *     Why?
 *     Why is that important?
 *     What evidence supports this?
 *     What assumptions are you making?
 *     What would change the recommendation?
 *
 * are each answered from one of these structures. An LLM may rephrase
 * the structured payload at the route handler, but the structure
 * itself is the source of truth.
 */

export type AuditTargetKind =
  | 'recommendation_output'
  | 'goal_decision_impact'
  | 'goal_probability_distribution'
  | 'catch_up_plan'
  | 'ahead_of_plan_plan'
  | 'marginal_impact_ranking';

export type EvidenceSourceKind =
  | 'central_ontology'
  | 'personal_history'
  | 'pathway_effectiveness'
  | 'recommendation_quality'
  | 'calibration_history'
  | 'goal_progress_snapshot'
  | 'goal_hierarchy_edge'
  | 'user_constraint'
  | 'user_capability'
  | 'user_motivation'
  | 'self_report'
  | 'assumption';

export type AssumptionSeverity = 'informational' | 'load_bearing' | 'critical';

export type CounterfactualOutcome =
  | 'no_change'
  | 'reranked'
  | 'flipped'
  | 'timeline_shifted'
  | 'confidence_changed';

export const TRUST_QUESTIONS = [
  'why',
  'why_important',
  'evidence',
  'assumptions',
  'counterfactuals',
] as const;
export type TrustQuestion = (typeof TRUST_QUESTIONS)[number];

// ---------------------------------------------------------------------------
// Why chain
// ---------------------------------------------------------------------------

export interface WhyChainNode {
  id: string;
  depth: number;
  claim: string;
  grounded_in?: {
    kind: EvidenceSourceKind;
    label: string;
    citation_reference?: string;
    source_id?: string;
  };
  confidence: number;
}

export interface WhyChainEdge {
  parent_node_id: string;
  child_node_id: string;
  /** Edge label: typically "because", "supported_by", "requires", "depends_on". */
  label: 'because' | 'supported_by' | 'requires' | 'depends_on' | 'in_context_of';
}

export interface WhyChain {
  target_kind: AuditTargetKind;
  target_id?: string;
  user_id: string;
  nodes: WhyChainNode[];
  edges: WhyChainEdge[];
  max_depth: number;
  computed_at: string;
}

// ---------------------------------------------------------------------------
// Evidence graph
// ---------------------------------------------------------------------------

export interface EvidenceNode {
  id: string;
  kind: EvidenceSourceKind;
  label: string;
  citation_reference?: string;
  source_id?: string;
  confidence: number;
  weight: number;
}

export interface EvidenceEdge {
  from_node_id: string;
  to_node_id: string;
  label: 'cites' | 'derived_from' | 'corroborates' | 'contradicts';
}

export interface EvidenceGraph {
  target_kind: AuditTargetKind;
  target_id?: string;
  user_id: string;
  nodes: EvidenceNode[];
  edges: EvidenceEdge[];
  computed_at: string;
}

// ---------------------------------------------------------------------------
// Counterfactuals
// ---------------------------------------------------------------------------

export interface Perturbation {
  input_field: string;
  from: unknown;
  to: unknown;
  magnitude: number; // signed ratio relative to `from`
}

export interface CounterfactualScenario {
  id: string;
  user_id: string;
  target_kind: AuditTargetKind;
  target_id?: string;
  scenario_label: string;
  perturbation: Perturbation;
  expected_outcome: CounterfactualOutcome;
  new_top_recommendation?: string;
  new_confidence?: number;
  delta_summary: string;
  sensitivity: number; // [0,1] — higher = the recommendation depends more on this input
  computed_at: string;
}

// ---------------------------------------------------------------------------
// Assumptions
// ---------------------------------------------------------------------------

export interface AssumptionItem {
  id?: string;
  text: string;
  severity: AssumptionSeverity;
  sensitivity: number;
  source_engine:
    | 'probability'
    | 'impact'
    | 'catch_up'
    | 'ahead'
    | 'ranker'
    | 'reasoning'
    | 'learning';
  source_field?: string;
  evidence_label?: string;
  acknowledged_by_user?: boolean;
}

// ---------------------------------------------------------------------------
// Audit trail
// ---------------------------------------------------------------------------

export interface AuditTrailEntry {
  id?: string;
  user_id: string;
  advisor_run_id?: string;
  target_kind: AuditTargetKind;
  target_id?: string;
  input_snapshot: Record<string, unknown>;
  engine_versions: Record<string, string>;
  intermediate: Record<string, unknown>;
  output_summary: Record<string, unknown>;
  computed_at: string;
  duration_ms?: number;
}
