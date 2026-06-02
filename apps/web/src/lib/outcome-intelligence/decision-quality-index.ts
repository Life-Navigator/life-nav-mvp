/**
 * Decision Quality Index — Sprint O.
 *
 * Composite per-user score over a window. Compositionally:
 *
 *   DQI = w1·acceptance_rate
 *       + w2·completion_rate
 *       - w3·reversal_rate
 *       + w4·avg_effectiveness
 *       + w5·avg_character_score
 *       + w6·future_preservation_score
 *
 * All weights are tunable; default weights are documented in the
 * accompanying `DECISION_QUALITY_INDEX.md`.
 *
 * Safety contract: only safety-compliant recommendations contribute
 * to ANY sub-rate. Non-compliant recs are excluded by the input
 * shape (callers pre-filter via `filterSafe`).
 */

import type {
  DecisionQualityIndex,
  EffectivenessScore,
  RecommendationContext,
  OutcomeLifecycleState,
  FeedbackPayload,
} from './types';
import { computeEffectiveness } from './effectiveness-score';

export const DQI_WEIGHTS = Object.freeze({
  acceptance: 0.2,
  completion: 0.2,
  reversal: 0.15, // negative-weighted (subtracted)
  effectiveness: 0.2,
  character: 0.15,
  future_preservation: 0.1,
});

export interface DqiInputRow {
  context: RecommendationContext;
  lifecycle: OutcomeLifecycleState;
  feedback?: FeedbackPayload;
}

export interface DqiInputs {
  user_id: string;
  window_days: number;
  /** Pre-filtered safety-compliant rows. */
  rows: DqiInputRow[];
}

export function computeDqi(inputs: DqiInputs): DecisionQualityIndex {
  const n = inputs.rows.length;
  if (n === 0) {
    return {
      user_id: inputs.user_id,
      window_days: inputs.window_days,
      dqi_overall: 0,
      acceptance_rate: 0,
      completion_rate: 0,
      reversal_rate: 0,
      avg_effectiveness: 0,
      avg_character_score: 0,
      future_preservation_score: 1, // no rec means nothing was harmed
      recommendations_evaluated: 0,
      computed_at: new Date().toISOString(),
    };
  }

  let accepted = 0;
  let completed = 0;
  let reversed = 0;
  let effectiveness_sum = 0;
  let character_sum = 0;
  let future_pres_sum = 0;

  for (const row of inputs.rows) {
    if (row.lifecycle.state === 'accepted' || row.lifecycle.state === 'completed') accepted += 1;
    if (row.lifecycle.state === 'completed') completed += 1;
    if (
      row.lifecycle.state === 'dismissed' &&
      (row.lifecycle.accepted_at || row.lifecycle.completed_at)
    )
      reversed += 1;
    if (row.feedback?.outcome === 'worse') reversed += 1;

    const eff = computeEffectiveness({
      context: row.context,
      lifecycle: row.lifecycle,
      feedback: row.feedback,
    });
    effectiveness_sum += eff.effectiveness_score;
    character_sum += row.context.character_score_overall ?? 0.7;

    // Future preservation = 1 minus penalty per harming axis touched.
    const harming = row.context.character_flourishing_harming_axes ?? [];
    future_pres_sum += Math.max(0, 1 - 0.25 * harming.length);
  }

  const acceptance_rate = accepted / n;
  const completion_rate = completed / n;
  const reversal_rate = reversed / n;
  const avg_effectiveness = effectiveness_sum / n;
  const avg_character_score = character_sum / n;
  const future_preservation_score = future_pres_sum / n;

  const dqi_overall = clamp01(
    DQI_WEIGHTS.acceptance * acceptance_rate +
      DQI_WEIGHTS.completion * completion_rate -
      DQI_WEIGHTS.reversal * reversal_rate +
      DQI_WEIGHTS.effectiveness * avg_effectiveness +
      DQI_WEIGHTS.character * avg_character_score +
      DQI_WEIGHTS.future_preservation * future_preservation_score
  );

  return {
    user_id: inputs.user_id,
    window_days: inputs.window_days,
    dqi_overall: round3(dqi_overall),
    acceptance_rate: round3(acceptance_rate),
    completion_rate: round3(completion_rate),
    reversal_rate: round3(reversal_rate),
    avg_effectiveness: round3(avg_effectiveness),
    avg_character_score: round3(avg_character_score),
    future_preservation_score: round3(future_preservation_score),
    recommendations_evaluated: n,
    computed_at: new Date().toISOString(),
  };
}

/**
 * Convenience: take a (potentially unfiltered) row set, filter for
 * safety, then compute the DQI. The filtering step is exposed so the
 * caller can audit it.
 */
export function computeDqiSafe(inputs: {
  user_id: string;
  window_days: number;
  rows: DqiInputRow[];
}): { dqi: DecisionQualityIndex; included: number; excluded_unsafe: number } {
  const { checkSafety } = require('./safety-gate') as typeof import('./safety-gate');
  const safe: DqiInputRow[] = [];
  let excluded = 0;
  for (const r of inputs.rows) {
    if (checkSafety(r.context).is_safety_compliant) safe.push(r);
    else excluded += 1;
  }
  return {
    dqi: computeDqi({ user_id: inputs.user_id, window_days: inputs.window_days, rows: safe }),
    included: safe.length,
    excluded_unsafe: excluded,
  };
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}
function round3(x: number): number {
  return Math.round(x * 1000) / 1000;
}

export const __test = { computeDqi };

// Re-export effectiveness helper signature
export type { EffectivenessScore };
