/**
 * Goal Achievement Engine — Sprint O.
 *
 * Pure-function utilities for per-goal progress tracking.
 *
 *   * `appendSnapshot` — produces a new snapshot row from a current
 *     progress percentage + the prior series. Detects milestones and
 *     reversals automatically.
 *   * `summarizeGoal` — computes a per-goal achievement summary
 *     (current progress, peak, days_active, last_milestone_at).
 *   * `goalAchievementRate` — fraction of completed goals in the
 *     window (used by enterprise reporting).
 */

import type { GoalProgressSnapshot } from './types';

export interface AppendSnapshotInputs {
  goal_id: string;
  current_pct: number;
  series: GoalProgressSnapshot[];
  recommendation_id?: string;
  /** Optional milestone label (eg "Hit savings target"). */
  milestone?: string;
}

export interface AppendedSnapshot {
  snapshot: GoalProgressSnapshot;
  is_new_milestone: boolean;
  is_reversal: boolean;
}

/**
 * Determine the right `progress_kind` and detect milestones.
 */
export function appendSnapshot(inputs: AppendSnapshotInputs): AppendedSnapshot {
  const prior = inputs.series.length === 0 ? null : inputs.series[inputs.series.length - 1];
  const pct = clamp01(inputs.current_pct);

  let kind: GoalProgressSnapshot['progress_kind'] = 'periodic';
  let is_new_milestone = false;
  let is_reversal = false;

  if (!prior) {
    kind = 'baseline';
  } else if (pct >= 1.0 && prior.progress_pct < 1.0) {
    kind = 'completion';
  } else if (pct >= prior.progress_pct + 0.1) {
    kind = 'milestone';
    is_new_milestone = true;
  } else if (pct + 0.05 < prior.progress_pct) {
    kind = 'reversal';
    is_reversal = true;
  }

  return {
    snapshot: {
      goal_id: inputs.goal_id,
      progress_pct: round3(pct),
      progress_kind: kind,
      milestone: inputs.milestone,
      recorded_at: new Date().toISOString(),
      recommendation_id: inputs.recommendation_id,
    },
    is_new_milestone,
    is_reversal,
  };
}

export interface GoalAchievementSummary {
  goal_id: string;
  current_pct: number;
  peak_pct: number;
  days_active: number;
  snapshot_count: number;
  milestones: number;
  reversals: number;
  is_completed: boolean;
  last_milestone_at?: string;
  last_recorded_at?: string;
}

export function summarizeGoal(
  goal_id: string,
  series: GoalProgressSnapshot[]
): GoalAchievementSummary {
  if (series.length === 0) {
    return {
      goal_id,
      current_pct: 0,
      peak_pct: 0,
      days_active: 0,
      snapshot_count: 0,
      milestones: 0,
      reversals: 0,
      is_completed: false,
    };
  }
  const sorted = series
    .slice()
    .sort((a, b) => Date.parse(a.recorded_at) - Date.parse(b.recorded_at));
  let peak = 0;
  let milestones = 0;
  let reversals = 0;
  let last_milestone_at: string | undefined;
  for (const s of sorted) {
    if (s.progress_pct > peak) peak = s.progress_pct;
    if (s.progress_kind === 'milestone' || s.progress_kind === 'completion') {
      milestones += 1;
      last_milestone_at = s.recorded_at;
    }
    if (s.progress_kind === 'reversal') reversals += 1;
  }
  const first = Date.parse(sorted[0].recorded_at);
  const last = Date.parse(sorted[sorted.length - 1].recorded_at);
  const days_active = Math.max(0, (last - first) / (24 * 60 * 60 * 1000));
  return {
    goal_id,
    current_pct: round3(sorted[sorted.length - 1].progress_pct),
    peak_pct: round3(peak),
    days_active: round2(days_active),
    snapshot_count: sorted.length,
    milestones,
    reversals,
    is_completed: sorted[sorted.length - 1].progress_pct >= 1.0,
    last_milestone_at,
    last_recorded_at: sorted[sorted.length - 1].recorded_at,
  };
}

export function goalAchievementRate(summaries: GoalAchievementSummary[]): number {
  if (summaries.length === 0) return 0;
  const completed = summaries.filter((s) => s.is_completed).length;
  return round3(completed / summaries.length);
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}
function round3(x: number): number {
  return Math.round(x * 1000) / 1000;
}
function round2(x: number): number {
  return Math.round(x * 100) / 100;
}
