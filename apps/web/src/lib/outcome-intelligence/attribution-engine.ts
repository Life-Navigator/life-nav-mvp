/**
 * Outcome Attribution Engine — Sprint O.
 *
 * Links each measurable goal-progress change to the recommendation
 * that most plausibly produced it.
 *
 * Heuristic — fully deterministic, no LLM:
 *
 *   For each (rec, goal_progress_snapshot) pair:
 *
 *     1. The goal_id must match (or the snapshot's recommendation_id
 *        explicitly points to this rec).
 *     2. The snapshot must have been recorded AFTER the rec was
 *        accepted/completed AND within MAX_LAG_DAYS.
 *     3. The delta is `snapshot.progress_pct - baseline.progress_pct`,
 *        where baseline is the most-recent prior snapshot for the same
 *        goal.
 *     4. The attribution_confidence decays linearly with lag.
 *
 * Multiple recs can share attribution on the same snapshot — the
 * engine outputs one link per (rec, snapshot) pair when the rules
 * fire.
 */

import type {
  AttributionLink,
  FlourishingAxis,
  GoalProgressSnapshot,
  RecommendationContext,
  OutcomeLifecycleState,
} from './types';
import { checkSafety } from './safety-gate';

/** Max lag in days from rec completion to attributable snapshot. */
export const MAX_LAG_DAYS = 90;

export interface AttributionInputs {
  recommendations: Array<{
    context: RecommendationContext;
    lifecycle: OutcomeLifecycleState;
  }>;
  /** All goal-progress snapshots for the user, ordered chronologically. */
  snapshots: GoalProgressSnapshot[];
  /**
   * Optional mapping from goal_id → flourishing_axis so links carry
   * the axis. Built from the user's goal metadata.
   */
  goal_axis?: Map<string, FlourishingAxis>;
}

export function computeAttribution(inputs: AttributionInputs): AttributionLink[] {
  const out: AttributionLink[] = [];

  // Index snapshots by goal_id.
  const by_goal: Map<string, GoalProgressSnapshot[]> = new Map();
  for (const s of inputs.snapshots) {
    if (!by_goal.has(s.goal_id)) by_goal.set(s.goal_id, []);
    by_goal.get(s.goal_id)!.push(s);
  }
  // Ensure each goal's snapshots are time-ordered.
  for (const list of by_goal.values()) {
    list.sort((a, b) => Date.parse(a.recorded_at) - Date.parse(b.recorded_at));
  }

  for (const r of inputs.recommendations) {
    // Safety contract — only safety-compliant recs can produce links.
    if (!checkSafety(r.context).is_safety_compliant) continue;
    const goal_id =
      r.context.goal_id ??
      // Or pull from the snapshot's explicit pointer.
      pickGoalId(inputs.snapshots, r.context.recommendation_id);
    if (!goal_id) continue;

    const decision_time =
      r.lifecycle.completed_at ?? r.lifecycle.accepted_at ?? r.lifecycle.viewed_at;
    if (!decision_time) continue;
    const decided = Date.parse(decision_time);

    const series = by_goal.get(goal_id);
    if (!series || series.length === 0) continue;

    // Baseline = most recent snapshot strictly BEFORE the decision.
    let baseline: GoalProgressSnapshot | null = null;
    for (const s of series) {
      const t = Date.parse(s.recorded_at);
      if (t < decided) baseline = s;
      else break;
    }
    if (!baseline) {
      // No baseline → use a 0-progress synthetic baseline so first-time
      // achievements still count.
      baseline = {
        goal_id,
        progress_pct: 0,
        progress_kind: 'baseline',
        recorded_at: new Date(decided).toISOString(),
      };
    }

    // Each post-decision snapshot within MAX_LAG_DAYS produces a link.
    for (const s of series) {
      const t = Date.parse(s.recorded_at);
      const lag_ms = t - decided;
      if (lag_ms <= 0) continue;
      const lag_days = lag_ms / (24 * 60 * 60 * 1000);
      if (lag_days > MAX_LAG_DAYS) break;
      // If the snapshot explicitly points at a different rec, skip.
      if (s.recommendation_id && s.recommendation_id !== r.context.recommendation_id) continue;

      const delta = clamp(-1, 1, s.progress_pct - baseline.progress_pct);
      // Confidence decays linearly with lag and weights up if the
      // snapshot explicitly points at this rec.
      const explicit = s.recommendation_id === r.context.recommendation_id;
      const lag_factor = 1 - lag_days / MAX_LAG_DAYS;
      const confidence = clamp(0, 1, (explicit ? 0.7 : 0.45) * lag_factor + (explicit ? 0.2 : 0));

      out.push({
        recommendation_id: r.context.recommendation_id,
        user_id: r.context.user_id,
        goal_id,
        delta: round3(delta),
        attribution_confidence: round3(confidence),
        flourishing_axis: inputs.goal_axis?.get(goal_id),
        lag_days: round2(lag_days),
      });
      // Roll the baseline forward to the snapshot we just attributed.
      baseline = s;
    }
  }

  return out;
}

function pickGoalId(snaps: GoalProgressSnapshot[], rec_id: string): string | null {
  for (const s of snaps) {
    if (s.recommendation_id === rec_id) return s.goal_id;
  }
  return null;
}

function clamp(lo: number, hi: number, x: number): number {
  return Math.max(lo, Math.min(hi, x));
}
function round3(x: number): number {
  return Math.round(x * 1000) / 1000;
}
function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

export const __test = { pickGoalId };
