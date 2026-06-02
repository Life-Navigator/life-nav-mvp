/**
 * Life Progress Engine — Sprint O.
 *
 * Aggregates per-user flourishing-axis trajectory from:
 *
 *   * AttributionLink deltas (per-axis movement attributed to a rec)
 *   * Sprint N.3 character flourishing harming_axes (negative signal)
 *   * Goal-progress summaries (positive signal on the goal's axis)
 *
 * Output: a LifeProgressSnapshot per (user, window). Trend is
 * computed against the prior snapshot.
 */

import type {
  AttributionLink,
  FlourishingAxis,
  GoalProgressSnapshot,
  LifeProgressSnapshot,
  RecommendationContext,
} from './types';
import { checkSafety } from './safety-gate';

const ALL_AXES: FlourishingAxis[] = [
  'health',
  'safety',
  'relationships',
  'education',
  'career',
  'financial',
  'resilience',
  'responsibility',
  'future_opportunity',
];

export interface LifeProgressInputs {
  user_id: string;
  tenant_id?: string | null;
  window_days: number;
  attribution_links: AttributionLink[];
  /** Sprint N.3 contexts in this window (for the harming_axes signal). */
  recommendations: RecommendationContext[];
  /**
   * Optional pairing of goal_id → axis so positive goal progress can
   * lift the corresponding axis even without an attribution link.
   */
  goal_axis?: Map<string, FlourishingAxis>;
  goal_snapshots?: GoalProgressSnapshot[];
  /** Prior snapshot for trend computation. */
  prior?: LifeProgressSnapshot | null;
}

export function computeLifeProgress(inputs: LifeProgressInputs): LifeProgressSnapshot {
  const axis_sum: Record<FlourishingAxis, number> = {
    health: 0,
    safety: 0,
    relationships: 0,
    education: 0,
    career: 0,
    financial: 0,
    resilience: 0,
    responsibility: 0,
    future_opportunity: 0,
  };
  const axis_count: Record<FlourishingAxis, number> = {
    health: 0,
    safety: 0,
    relationships: 0,
    education: 0,
    career: 0,
    financial: 0,
    resilience: 0,
    responsibility: 0,
    future_opportunity: 0,
  };

  // Attribution links — positive deltas lift the axis; negative deltas drag.
  for (const l of inputs.attribution_links) {
    if (!l.flourishing_axis) continue;
    const w = clamp01(l.attribution_confidence ?? 0.5);
    axis_sum[l.flourishing_axis] += w * l.delta;
    axis_count[l.flourishing_axis] += w;
  }

  // Sprint N.3 harming axes — only safety-compliant recs contribute
  // even on the harming side, because non-compliant recs shouldn't
  // have shipped at all.
  for (const r of inputs.recommendations) {
    if (!checkSafety(r).is_safety_compliant) continue;
    for (const a of r.character_flourishing_harming_axes ?? []) {
      axis_sum[a] += -0.2;
      axis_count[a] += 1;
    }
  }

  // Goal-progress positive signal — completed/milestone snapshots
  // give a small lift to the goal's axis.
  if (inputs.goal_axis && inputs.goal_snapshots) {
    for (const s of inputs.goal_snapshots) {
      const a = inputs.goal_axis.get(s.goal_id);
      if (!a) continue;
      if (s.progress_kind === 'completion') {
        axis_sum[a] += 0.4;
        axis_count[a] += 1;
      } else if (s.progress_kind === 'milestone') {
        axis_sum[a] += 0.2;
        axis_count[a] += 1;
      } else if (s.progress_kind === 'reversal') {
        axis_sum[a] += -0.3;
        axis_count[a] += 1;
      }
    }
  }

  const axes: Record<FlourishingAxis, number> = ALL_AXES.reduce(
    (acc, a) => {
      acc[a] = axis_count[a] === 0 ? 0 : clamp(-1, 1, axis_sum[a] / Math.max(1, axis_count[a]));
      return acc;
    },
    {} as Record<FlourishingAxis, number>
  );

  const overall = round3(ALL_AXES.reduce((s, a) => s + axes[a], 0) / ALL_AXES.length);

  let trend: 'up' | 'flat' | 'down' = 'flat';
  if (inputs.prior) {
    const delta = overall - inputs.prior.overall;
    trend = delta > 0.02 ? 'up' : delta < -0.02 ? 'down' : 'flat';
  }

  return {
    user_id: inputs.user_id,
    window_days: inputs.window_days,
    health: round3(axes.health),
    safety: round3(axes.safety),
    relationships: round3(axes.relationships),
    education: round3(axes.education),
    career: round3(axes.career),
    financial: round3(axes.financial),
    resilience: round3(axes.resilience),
    responsibility: round3(axes.responsibility),
    future_opportunity: round3(axes.future_opportunity),
    overall,
    trend,
    computed_at: new Date().toISOString(),
  };
}

function clamp(lo: number, hi: number, x: number): number {
  return Math.max(lo, Math.min(hi, x));
}
function clamp01(x: number): number {
  return clamp(0, 1, x);
}
function round3(x: number): number {
  return Math.round(x * 1000) / 1000;
}
