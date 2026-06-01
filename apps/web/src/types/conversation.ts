/**
 * AdvisorConversationAgent — shared types.
 *
 * The agent emits a `ConversationTurn`. Every turn carries an optional
 * `recommendation` field whose value is the **deterministic** output of
 * `AdvisorReasoningService.reason()`. The LLM-explanation layer never
 * mutates it; an explicit guard rejects any attempt by the LLM to
 * change action ids, sequence ordering, confidence_score, or root_goal.
 */

import type { RecommendationOutput } from '@/types/advisor';

export type TurnKind =
  | 'ask' // a follow-up question for the user
  | 'explain' // natural-language explanation of an existing rec
  | 'propose' // surfaces the latest deterministic recommendation
  | 'acknowledge'; // short receipt of user input

export type TurnIntent =
  | 'discover_root_goal'
  | 'gather_missing_info'
  | 'resolve_contradiction'
  | 'challenge_assumption'
  | 'explain_recommendation'
  | 'explain_tradeoff'
  | 'clarify'
  | 'small_talk';

export interface ConversationMessage {
  role: 'user' | 'agent';
  content: string;
  intent?: TurnIntent;
  at?: string;
}

export interface AskBlock {
  question: string;
  why: string;
  options?: string[]; // optional multiple-choice prompts
  expected_kind: 'free_text' | 'choice' | 'number' | 'boolean' | 'goal_id';
  binds_to?: string; // which user-graph field the answer fills (e.g., 'user_constraints.dimension=time')
}

export interface ExplainBlock {
  text: string;
  citations: Array<{
    central_entity_id?: string;
    canonical_name?: string;
    source_type?: string;
    source_name?: string;
    citation_reference?: string;
  }>;
  /** Confidence in the *explanation* itself (LLM phrasing quality
   *  heuristic); separate from the deterministic recommendation's
   *  confidence_score. */
  explanation_confidence: number;
}

export interface ProposeBlock {
  /**
   * The recommendation produced by AdvisorReasoningService. This is
   * the deterministic core — the agent MUST surface it unchanged.
   */
  recommendation: RecommendationOutput;
  /** Optional one-line summary phrased by the LLM. */
  summary?: string;
}

export interface ContradictionFlag {
  field: string; // e.g., "user_constraints.credit_utilization"
  observed: string;
  conflicts_with: string; // e.g., "root_goal: Home Ownership"
  severity: 'soft' | 'hard';
}

export interface MissingInfoFlag {
  field: string; // 'user_capabilities' | 'user_constraints' | ...
  why_it_matters: string;
}

export interface ConversationTurn {
  kind: TurnKind;
  intent: TurnIntent;
  ask?: AskBlock;
  explain?: ExplainBlock;
  propose?: ProposeBlock;
  acknowledge?: { text: string };
  contradictions: ContradictionFlag[];
  missing_info: MissingInfoFlag[];
  /** The deterministic recommendation, surfaced on every turn that has
   *  one available. NEVER overwritten by the LLM. */
  deterministic_recommendation?: RecommendationOutput;
  trace: {
    classified_intent: TurnIntent;
    used_llm: boolean;
    llm_calls: number;
    llm_rejected_mutations: string[]; // names of fields the LLM tried to change and was blocked from
  };
}

export interface AdvisorConversationInputs {
  user_id: string;
  message: string;
  history?: ConversationMessage[];
  pending_recommendation?: RecommendationOutput;
  root_goal_id_override?: string;
}
