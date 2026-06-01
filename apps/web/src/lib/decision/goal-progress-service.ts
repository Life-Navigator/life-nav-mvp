/**
 * GoalProgressService
 *
 *   Goal → Decision → Outcome → Goal Progress
 *
 * Pure scoring (`scoreGoalProgress`) is unit-tested with fixture data.
 * Persistence helpers (`recordSnapshot`, `recordEvent`, `rollUpScore`,
 * `recordPrediction`, `validatePrediction`) are thin Supabase wrappers.
 *
 * The score is `[0,1]`: 0 = no progress, 1 = goal achieved. The delta
 * is `[-1, +1]`. Confidence is `[0,1]`.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import type { DecisionJournal, DecisionOutcome } from '@/types/decision-journal';
import type { PathwayNode } from '@/types/goal-hierarchy';
import type {
  GoalProgressComputation,
  GoalProgressEvent,
  GoalProgressPrediction,
  GoalProgressScore,
  GoalProgressSnapshot,
  ProgressEventType,
  ProgressPeriod,
} from '@/types/decision-intelligence';

// ---------------------------------------------------------------------------
// Pure scoring
// ---------------------------------------------------------------------------

export interface ScoreInputs {
  /** Most recent snapshot's score; 0 if no prior snapshot. */
  previous_score: number;
  /** Decisions made for or against the goal in the scoring window. */
  decisions: Array<Pick<DecisionJournal, 'id' | 'system_confidence_at_decision' | 'status'>>;
  /** Outcomes observed in the scoring window — each carries delta_pct + accuracy. */
  outcomes: Array<Pick<DecisionOutcome, 'id' | 'delta_pct' | 'accuracy_score'>>;
  /** Supporting goals (each with cumulative_strength). Each completed
   *  supporting goal contributes a strength-weighted bump. */
  supporting_goals?: PathwayNode[];
  /** Average cumulative_strength of *required* prereqs the user has
   *  already cleared (fraction in [0,1]). */
  required_clear_fraction?: number;
}

/**
 * Compute current goal progress score + delta + confidence.
 *
 * Update rule:
 *   contribution_outcomes = mean(accuracy_score) × sign(delta_pct)
 *                              over outcomes with delta_pct != null
 *   contribution_supports = sum(cumulative_strength) / count   (capped at 0.4)
 *   contribution_required = required_clear_fraction × 0.3
 *
 *   new_score = clamp01( previous_score
 *                        + 0.4 × contribution_outcomes
 *                        + contribution_supports
 *                        + contribution_required )
 */
export function scoreGoalProgress(inputs: ScoreInputs): GoalProgressComputation {
  const reasoning: string[] = [];
  const prev = clamp01(inputs.previous_score);

  // (a) Outcome contribution — directional, weighted by accuracy.
  let cOutcomes = 0;
  let usedOutcomes = 0;
  for (const o of inputs.outcomes) {
    if (o.delta_pct == null || o.accuracy_score == null) continue;
    cOutcomes += Math.sign(o.delta_pct) * Number(o.accuracy_score);
    usedOutcomes += 1;
  }
  if (usedOutcomes > 0) cOutcomes /= usedOutcomes;
  if (usedOutcomes > 0) {
    reasoning.push(
      `Observed ${usedOutcomes} outcome(s); directional contribution ${cOutcomes.toFixed(3)}.`
    );
  }

  // (b) Supporting-goal contribution — capped to avoid double-counting.
  let cSupports = 0;
  if (inputs.supporting_goals && inputs.supporting_goals.length > 0) {
    const sum = inputs.supporting_goals.reduce((a, n) => a + clamp01(n.cumulative_strength), 0);
    cSupports = Math.min(0.4, sum / inputs.supporting_goals.length);
    reasoning.push(
      `${inputs.supporting_goals.length} supporting goal(s); contribution ${cSupports.toFixed(3)}.`
    );
  }

  // (c) Required-prereq clearance contribution.
  const cRequired = 0.3 * clamp01(inputs.required_clear_fraction ?? 0);
  if (cRequired > 0) {
    reasoning.push(
      `${((inputs.required_clear_fraction ?? 0) * 100).toFixed(0)}% of required prereqs cleared; contribution ${cRequired.toFixed(3)}.`
    );
  }

  const new_score = clamp01(prev + 0.4 * cOutcomes + cSupports + cRequired);
  const delta = new_score - prev;

  // Confidence: weighted by how many independent signals contributed.
  const signals =
    (usedOutcomes > 0 ? 1 : 0) +
    ((inputs.supporting_goals?.length ?? 0) > 0 ? 1 : 0) +
    ((inputs.required_clear_fraction ?? 0) > 0 ? 1 : 0);
  // Average decision confidence (across made decisions) as a prior.
  const avgDec = mean(
    inputs.decisions
      .filter((d) => d.status === 'made')
      .map((d) => d.system_confidence_at_decision ?? null)
  );
  const baseConf = avgDec ?? 0.5;
  const confidence = clamp01(0.4 * baseConf + 0.2 * signals);

  reasoning.push(
    `Score ${prev.toFixed(3)} → ${new_score.toFixed(3)} (Δ ${delta.toFixed(3)}), confidence ${confidence.toFixed(3)}.`
  );

  return {
    goal_progress_delta: delta,
    goal_progress_score: new_score,
    confidence,
    reasoning,
  };
}

function clamp01(n: number | null | undefined): number {
  if (n == null || Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}
function mean(arr: Array<number | null | undefined>): number | null {
  const f = arr.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (f.length === 0) return null;
  return f.reduce((a, b) => a + b, 0) / f.length;
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

export interface RecordSnapshotInput {
  user_id: string;
  goal_id: string;
  score: number;
  confidence?: number;
  source?: 'engine' | 'self_report' | 'computed' | 'admin';
  inputs?: Record<string, unknown>;
}

export async function recordSnapshot(
  supabase: SupabaseClient,
  input: RecordSnapshotInput
): Promise<GoalProgressSnapshot> {
  const row = {
    user_id: input.user_id,
    goal_id: input.goal_id,
    score: clamp01(input.score),
    confidence: input.confidence ?? null,
    source: input.source ?? 'engine',
    inputs: input.inputs ?? {},
  };
  const { data, error } = await supabase
    .from('goal_progress_snapshots')
    .insert(row)
    .select('*')
    .single();
  if (error) throw error;
  return data as GoalProgressSnapshot;
}

export interface RecordEventInput {
  user_id: string;
  goal_id: string;
  event_type: ProgressEventType;
  delta: number;
  decision_id?: string;
  outcome_id?: string;
  snapshot_id?: string;
  reason?: string;
  confidence?: number;
  occurred_at?: string;
}

export async function recordEvent(
  supabase: SupabaseClient,
  input: RecordEventInput
): Promise<GoalProgressEvent> {
  const row = {
    user_id: input.user_id,
    goal_id: input.goal_id,
    event_type: input.event_type,
    delta: Math.max(-1, Math.min(1, input.delta)),
    decision_id: input.decision_id ?? null,
    outcome_id: input.outcome_id ?? null,
    snapshot_id: input.snapshot_id ?? null,
    reason: input.reason ?? null,
    confidence: input.confidence ?? null,
    occurred_at: input.occurred_at ?? new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from('goal_progress_events')
    .insert(row)
    .select('*')
    .single();
  if (error) throw error;
  return data as GoalProgressEvent;
}

export interface RollUpScoreInput {
  user_id: string;
  goal_id: string;
  period: ProgressPeriod;
  period_start: string;
  period_end?: string;
  score: number;
  delta: number;
  confidence?: number;
  events_count: number;
}

export async function rollUpScore(
  supabase: SupabaseClient,
  input: RollUpScoreInput
): Promise<GoalProgressScore> {
  const row = {
    user_id: input.user_id,
    goal_id: input.goal_id,
    period: input.period,
    period_start: input.period_start,
    period_end: input.period_end ?? null,
    score: clamp01(input.score),
    delta: Math.max(-1, Math.min(1, input.delta)),
    confidence: input.confidence ?? null,
    events_count: input.events_count,
  };
  const { data, error } = await supabase
    .from('goal_progress_scores')
    .upsert(row, { onConflict: 'user_id,goal_id,period,period_start' })
    .select('*')
    .single();
  if (error) throw error;
  return data as GoalProgressScore;
}

export interface RecordPredictionInput {
  user_id: string;
  goal_id: string;
  target_date: string;
  predicted_score: number;
  confidence: number;
  model_version?: string;
  inputs?: Record<string, unknown>;
}

export async function recordPrediction(
  supabase: SupabaseClient,
  input: RecordPredictionInput
): Promise<GoalProgressPrediction> {
  const row = {
    user_id: input.user_id,
    goal_id: input.goal_id,
    target_date: input.target_date,
    predicted_score: clamp01(input.predicted_score),
    confidence: clamp01(input.confidence),
    model_version: input.model_version ?? 'progress_v1',
    inputs: input.inputs ?? {},
  };
  const { data, error } = await supabase
    .from('goal_progress_predictions')
    .insert(row)
    .select('*')
    .single();
  if (error) throw error;
  return data as GoalProgressPrediction;
}

/**
 * Close out a prediction after `target_date` has passed. Sets
 * `validated_at`, `validation_score`, `validation_error =
 * |actual - predicted|`.
 */
export async function validatePrediction(
  supabase: SupabaseClient,
  predictionId: string,
  actualScore: number
): Promise<GoalProgressPrediction> {
  const { data: existing, error: e1 } = await supabase
    .from('goal_progress_predictions')
    .select('predicted_score')
    .eq('id', predictionId)
    .single();
  if (e1) throw e1;
  const predicted = clamp01(Number(existing.predicted_score));
  const actual = clamp01(actualScore);
  const error = Math.abs(actual - predicted);
  const { data, error: e2 } = await supabase
    .from('goal_progress_predictions')
    .update({
      validated_at: new Date().toISOString(),
      validation_score: actual,
      validation_error: error,
    })
    .eq('id', predictionId)
    .select('*')
    .single();
  if (e2) throw e2;
  return data as GoalProgressPrediction;
}

// ---------------------------------------------------------------------------
// Re-exports for tests
// ---------------------------------------------------------------------------
export const __test = { scoreGoalProgress, clamp01, mean };
