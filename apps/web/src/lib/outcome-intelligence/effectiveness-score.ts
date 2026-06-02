/**
 * Effectiveness Score — Sprint O.
 *
 * Composite per-recommendation score in [0, 1]. Combines:
 *
 *   * acceptance_score        — did the user accept it?
 *   * speed_score             — how fast did they decide?
 *   * outcome_score           — operator/user-assigned outcome score
 *   * reversal_penalty        — did the user later regret it?
 *   * attribution_score       — did the goal/axis actually move?
 *   * character_score         — Sprint N.3 character score on the rec
 *
 * Hard safety contract: a non-compliant recommendation gets a score
 * of 0 with `is_safety_compliant: false`. Optimizers consuming this
 * MUST consult the flag.
 */

import type {
  EffectivenessScore,
  RecommendationContext,
  OutcomeLifecycleState,
  FeedbackPayload,
  AttributionLink,
} from './types';
import { checkSafety } from './safety-gate';

export interface ComputeEffectivenessInputs {
  context: RecommendationContext;
  lifecycle: OutcomeLifecycleState;
  feedback?: FeedbackPayload;
  attribution_links?: AttributionLink[];
}

/**
 * Tuning weights — used by tests + the architecture doc.
 */
export const EFFECTIVENESS_WEIGHTS = Object.freeze({
  acceptance: 0.25,
  speed: 0.1,
  outcome: 0.2,
  attribution: 0.25,
  character: 0.2,
  // reversal_penalty is subtracted (not weighted-in) below.
});

export function computeEffectiveness(inputs: ComputeEffectivenessInputs): EffectivenessScore {
  const safety = checkSafety(inputs.context);
  if (!safety.is_safety_compliant) {
    return {
      effectiveness_score: 0,
      acceptance_score: 0,
      speed_score: 0,
      outcome_score: 0,
      reversal_penalty: 1,
      attribution_score: 0,
      character_score: clamp01(inputs.context.character_score_overall ?? 0),
      is_safety_compliant: false,
      attribution_links_count: 0,
      computed_at: new Date().toISOString(),
    };
  }

  const acceptance_score = computeAcceptanceScore(inputs.lifecycle, inputs.feedback);
  const speed_score = computeSpeedScore(inputs.lifecycle);
  const outcome_score = computeOutcomeScore(inputs.lifecycle, inputs.feedback);
  const reversal_penalty = computeReversalPenalty(inputs.lifecycle, inputs.feedback);
  const attribution_score = computeAttributionScore(inputs.attribution_links ?? []);
  const character_score = clamp01(inputs.context.character_score_overall ?? 0.7);

  const weighted =
    EFFECTIVENESS_WEIGHTS.acceptance * acceptance_score +
    EFFECTIVENESS_WEIGHTS.speed * speed_score +
    EFFECTIVENESS_WEIGHTS.outcome * outcome_score +
    EFFECTIVENESS_WEIGHTS.attribution * attribution_score +
    EFFECTIVENESS_WEIGHTS.character * character_score;
  const effectiveness_score = clamp01(weighted - reversal_penalty);

  return {
    effectiveness_score: round3(effectiveness_score),
    acceptance_score: round3(acceptance_score),
    speed_score: round3(speed_score),
    outcome_score: round3(outcome_score),
    reversal_penalty: round3(reversal_penalty),
    attribution_score: round3(attribution_score),
    character_score: round3(character_score),
    is_safety_compliant: true,
    attribution_links_count: inputs.attribution_links?.length ?? 0,
    computed_at: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Sub-scores
// ---------------------------------------------------------------------------

function computeAcceptanceScore(
  lifecycle: OutcomeLifecycleState,
  feedback?: FeedbackPayload
): number {
  switch (lifecycle.state) {
    case 'completed':
      return 1.0;
    case 'accepted':
      return 0.85;
    case 'viewed':
      return feedback?.helpfulness === 'helpful' ? 0.6 : 0.35;
    case 'ignored':
      return 0.0;
    case 'dismissed':
      return 0.0;
    case 'generated':
    default:
      return 0.0;
  }
}

function computeSpeedScore(lifecycle: OutcomeLifecycleState): number {
  // Faster acceptance signals clarity. Faster dismissal also gives
  // us a clean negative signal — but we don't reward it.
  const generated = Date.parse(lifecycle.generated_at);
  const decided = lifecycle.accepted_at
    ? Date.parse(lifecycle.accepted_at)
    : lifecycle.completed_at
      ? Date.parse(lifecycle.completed_at)
      : null;
  if (!decided || Number.isNaN(generated)) return 0.5;

  const days = (decided - generated) / (24 * 60 * 60 * 1000);
  if (days < 0) return 0.5;
  if (days < 1) return 1.0;
  if (days < 7) return 0.85;
  if (days < 30) return 0.6;
  return 0.3;
}

function computeOutcomeScore(lifecycle: OutcomeLifecycleState, feedback?: FeedbackPayload): number {
  // Operator-assigned score wins if present.
  if (typeof lifecycle.outcome_score === 'number') {
    return clamp01(lifecycle.outcome_score);
  }
  // Otherwise infer from feedback outcome.
  if (feedback?.outcome === 'improved') return 1.0;
  if (feedback?.outcome === 'no_change') return 0.4;
  if (feedback?.outcome === 'worse') return 0.0;
  // No signal yet.
  return lifecycle.state === 'completed' ? 0.6 : 0.4;
}

function computeReversalPenalty(
  lifecycle: OutcomeLifecycleState,
  feedback?: FeedbackPayload
): number {
  // The user reversed: dismissed after accepting OR feedback says worse.
  if (lifecycle.state === 'dismissed' && (lifecycle.accepted_at || lifecycle.completed_at)) {
    return 0.5;
  }
  if (feedback?.outcome === 'worse') return 0.4;
  if (feedback?.helpfulness === 'not_helpful' && lifecycle.state === 'completed') return 0.2;
  return 0;
}

function computeAttributionScore(links: AttributionLink[]): number {
  if (links.length === 0) return 0.4;
  // Weighted by attribution_confidence; positive deltas dominate.
  let weighted_positive = 0;
  let weighted_negative = 0;
  let weight = 0;
  for (const l of links) {
    const w = clamp01(l.attribution_confidence ?? 0.5);
    weight += w;
    if (l.delta > 0) weighted_positive += w * l.delta;
    if (l.delta < 0) weighted_negative += w * Math.abs(l.delta);
  }
  if (weight === 0) return 0.4;
  const net = (weighted_positive - weighted_negative) / weight;
  // Map [-1, 1] → [0, 1].
  return clamp01((net + 1) / 2);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}
function round3(x: number): number {
  return Math.round(x * 1000) / 1000;
}

export const __test = {
  computeAcceptanceScore,
  computeSpeedScore,
  computeOutcomeScore,
  computeReversalPenalty,
  computeAttributionScore,
};
