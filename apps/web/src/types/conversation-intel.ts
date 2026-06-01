/**
 * Conversation Intelligence types — mirror migration 084.
 *
 * The Achieve Global "Need Behind Need" methodology is a recursive
 * three-step drill-down:
 *
 *   Level 0: stated_goal             ("I want to pay off debt.")
 *   Level 1: What would that mean    ("I want to feel safe.")
 *   Level 2: What would THAT mean    ("I want to provide for my family.")
 *   Level 3: Why does that matter    ("Because I never had stability growing up.")
 *
 * Driver scoring uses the Achieve Global framework:
 *
 *   * Financial Security  — certainty, predictability, protection
 *   * Image               — recognition, status, legacy, validation
 *   * Performance         — progress, optimization, achievement, mastery
 *
 * Every score is in [0,1]. Per-turn driver scores aggregate into the
 * session-level dominant + secondary driver by majority + recency.
 */

export type DiscoveryDomain =
  | 'financial'
  | 'career'
  | 'health'
  | 'education'
  | 'estate'
  | 'general';

export type DiscoveryStatus = 'active' | 'paused' | 'completed' | 'abandoned';

export type DominantDriver = 'financial_security' | 'image' | 'performance';

export type ChallengeKind =
  | 'what_if'
  | 'why_assume'
  | 'counter_evidence'
  | 'time_pressure'
  | 'recency_bias';

export type ChallengeResponseState =
  | 'pending'
  | 'acknowledged'
  | 'pushed_back'
  | 'changed_mind'
  | 'ignored';

export type ExplainerKind =
  | 'tradeoff'
  | 'simulation'
  | 'probability'
  | 'assumption_challenge'
  | 'followup'
  | 'recommendation';

/** What the drill-down should ask next. Mirrors goal_discovery_turns.prompt_kind. */
export type PromptKind =
  | 'what_accomplish' // L0: what do you want?
  | 'what_unlock' // L1: what does that get you?
  | 'why_important' // L2/L3: why does that matter?
  | 'success_definition' // closing: how will you know you've won?
  | 'consequence_of_inaction' // closing: what happens if you don't?
  | 'urgency' // closing: when does this need to be true?
  | 'confirmation' // sealing the loop
  | 'free_text' // unstructured continuation
  | 'agent_summary';

// ---------------------------------------------------------------------------
// Driver scores
// ---------------------------------------------------------------------------

export interface DriverScores {
  financial_security: number;
  image: number;
  performance: number;
}

export interface DriverInferenceResult {
  per_turn: DriverScores; // scores derived from this single turn's text
  cumulative: DriverScores; // running average across the session
  dominant?: DominantDriver;
  secondary?: DominantDriver;
  confidence: number; // [0,1] — grows with consistent observations
  /** Human-readable signals that fired. */
  signals: Array<{ pattern: string; driver: DominantDriver; weight: number }>;
}

// ---------------------------------------------------------------------------
// Need-Behind-Need
// ---------------------------------------------------------------------------

export interface NeedBehindNeedNode {
  depth: number;
  prompt_kind: PromptKind;
  claim: string;
  drivers_at_node: DriverScores;
  /** When false, the drill-down should stop (consequence or values reached). */
  should_continue: boolean;
  reason_to_stop?: 'max_depth' | 'values_reached' | 'consequence_reached' | 'low_signal';
}

export interface NeedBehindNeedDrillDown {
  domain: DiscoveryDomain;
  /** Ordered tree from L0 (stated_goal) to whatever depth was reached. */
  nodes: NeedBehindNeedNode[];
  /** Next prompt the agent should issue. Null when the drill-down has terminated. */
  next_prompt?: {
    prompt_kind: PromptKind;
    text: string;
    /** Why this prompt was chosen — for the XAI trail. */
    rationale: string;
  };
  inferred_root_goal?: string;
  inferred_root_confidence?: number;
}

// ---------------------------------------------------------------------------
// Discovery session
// ---------------------------------------------------------------------------

export interface DiscoverySession {
  id: string;
  user_id: string;
  goal_id?: string | null;
  domain: DiscoveryDomain;
  status: DiscoveryStatus;
  current_depth: number;
  max_depth: number;
  driver_scores?: DriverScores;
  dominant_driver?: DominantDriver | null;
  secondary_driver?: DominantDriver | null;
  driver_confidence?: number;
  inferred_root_goal?: string | null;
  inferred_root_goal_confidence?: number | null;
  primary_session_token?: string | null;
  started_at: string;
  completed_at?: string | null;
  metadata: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Explainer outputs
// ---------------------------------------------------------------------------

export interface ExplainerOutput<Body> {
  kind: ExplainerKind;
  headline: string;
  body: Body;
  uncertainty_language: string[]; // hedge phrases to surface to the user
  follow_ups: Array<{ question: string; prompt_kind: PromptKind }>;
  /** Driver-tuned phrasing hints for the optional LLM phrasing layer. */
  phrasing_hint?: 'financial_security' | 'image' | 'performance';
  /** Citations from central ontology / personal history / pathway effectiveness. */
  citations: Array<{
    label: string;
    source:
      | 'central_ontology'
      | 'personal_history'
      | 'pathway_effectiveness'
      | 'recommendation_quality'
      | 'calibration_history'
      | 'self_report'
      | 'assumption';
    citation_reference?: string;
    confidence: number;
  }>;
}

// ---------------------------------------------------------------------------
// Concrete explainer body shapes
// ---------------------------------------------------------------------------

export interface TradeoffExplanationBody {
  framings: Array<{
    summary: string;
    gives_up: string;
    gains: string;
    net_assessment: string;
  }>;
  hard_constraint_warnings: string[];
}

export interface SimulationExplanationBody {
  evaluated_scenarios: number;
  best_scenario_id?: string;
  best_scenario_summary?: string;
  best_scenario_score?: number;
  ranked_summary: Array<{ scenario_id: string; rank: number; score: number; note?: string }>;
  cycles_warning?: string;
}

export interface ProbabilityExplanationBody {
  time_horizon: import('@/types/decision-impact').TimeHorizon;
  most_likely_text: string;
  range_text: string;
  confidence_text: string;
  variance_summary: string;
  what_would_change: string[];
}

export interface AssumptionChallengeExplanationBody {
  assumption_text: string;
  challenge_kind: ChallengeKind;
  prompt: string;
  what_changes_if_flipped: string;
  evidence_against: string[];
}

export interface FollowupExplanationBody {
  question: string;
  prompt_kind: PromptKind;
  why: string;
  binds_to?: string; // which user-graph field the answer fills
  options?: string[];
}

// ---------------------------------------------------------------------------
// Assumption challenge persistence
// ---------------------------------------------------------------------------

export interface AssumptionChallengeRow {
  id?: string;
  user_id: string;
  session_id?: string;
  audit_id?: string;
  assumption_id?: string;
  assumption_text: string;
  challenge_prompt: string;
  challenge_kind: ChallengeKind;
  user_response?: string;
  response_state: ChallengeResponseState;
  changed_outcome: boolean;
  issued_at: string;
  responded_at?: string;
}

// ---------------------------------------------------------------------------
// Conversation trace
// ---------------------------------------------------------------------------

export interface ConversationTrace {
  id?: string;
  user_id: string;
  session_id?: string;
  audit_id?: string;
  turn_index: number;
  user_message?: string;
  classified_intent: string;
  turn_kind: string;
  explainer_kind?: ExplainerKind;
  used_llm: boolean;
  llm_calls: number;
  llm_rejected_mutations: string[];
  detected_drivers: DriverScores;
  missing_info_count: number;
  contradiction_count: number;
  agent_payload: Record<string, unknown>;
  occurred_at: string;
}
