/**
 * DecisionImpactEngine
 *
 * Quantifies how a *single* candidate decision shifts the probability
 * of a goal across the full horizon set
 * (immediate / 3mo / 1yr / 3yr / 5yr / 10yr / 20yr).
 *
 * Core principle (sprint spec):
 *
 *   * Short horizon  → high sensitivity to single decisions.
 *   * Long horizon   → DAMPENED unless the decision is STRUCTURAL.
 *
 * Structural decisions are those that change income_trajectory,
 * education_credential, health_trajectory, debt_structure,
 * family_obligations, business_ownership, career_path, or
 * legal_estate_structure.
 *
 * The engine is pure (no I/O). Persistence is handled by separate
 * `recordDecisionImpact()` helpers.
 */

import { dampening } from './horizon-dampening';
import { TIME_HORIZONS_ORDER } from '@/types/decision-impact';
import type {
  DecisionImpact,
  DomainKey,
  HorizonImpact,
  StructuralVariable,
  TimeHorizon,
  VarianceFactor,
  XAIExplanation,
} from '@/types/decision-impact';

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

export interface DecisionImpactInputs {
  goal_id: string;
  goal_concept?: string;
  decision_label: string;
  /** Magnitude in [0,1] — how strong a fully-on-target version of this
   *  decision would be at its natural decision horizon. */
  base_magnitude: number;
  /** When the decision's effect *peaks* (months) for non-structural decisions.
   *  Defaults to 12 (typical "tactical" decisions register fully within a year). */
  peak_months?: number;
  /** Exponential decay constant past peak (months). Default 24. */
  decay_tau_months?: number;
  /** Whether this decision is structural (per spec's 8-variable list). */
  is_structural: boolean;
  /** If structural, which variable. Used for XAI explanation + table row. */
  structural_variable?: StructuralVariable;
  /** Optional related-goal effects: relative effects per related goal id. */
  related_goal_effects?: Array<{ goal_id: string; effect_ratio: number }>;
  /** Optional blocked-goal effects: relative effects per blocked goal id. */
  blocked_goal_effects?: Array<{ goal_id: string; effect_ratio: number }>;
  /** Confidence in the magnitude calibration. */
  base_confidence?: number;
  /** Domains touched. */
  domains?: DomainKey[];
  /** Whether the goal is itself short-term (≤ 12 months target) — used for
   *  sanity-checking that the curve makes sense vs the goal's own horizon. */
  goal_target_months?: number;
  /** Timeline shift in months that fully-executing this decision delivers,
   *  at its natural peak. Negative = accelerates; positive = delays. */
  timeline_shift_months_at_peak?: number;
  /** Risk-delta at peak, [-1,1]. Negative = reduces risk. */
  risk_delta_at_peak?: number;
  /** Extra reason text (will be incorporated into the impact reason). */
  reason_addendum?: string;
}

// ---------------------------------------------------------------------------
// Pure entrypoint
// ---------------------------------------------------------------------------

export function computeDecisionImpact(inputs: DecisionImpactInputs): DecisionImpact {
  const m = clamp01(inputs.base_magnitude);
  const bc = clamp01(inputs.base_confidence ?? 0.6);

  const per_horizon: HorizonImpact[] = TIME_HORIZONS_ORDER.map((h) => {
    const f = dampening(h, inputs.is_structural, {
      peak_months: inputs.peak_months,
      decay_tau_months: inputs.decay_tau_months,
    });
    const probability_delta = clamp(m * f, -1, 1);
    const timeline_delta_months =
      inputs.timeline_shift_months_at_peak == null
        ? undefined
        : inputs.timeline_shift_months_at_peak * f;
    const risk_delta =
      inputs.risk_delta_at_peak == null ? undefined : clamp(inputs.risk_delta_at_peak * f, -1, 1);
    // Confidence dampens slightly at distant horizons.
    const horizonConfidencePenalty = inputs.is_structural ? 0 : 0.08 * Math.max(0, indexOf(h) - 2);
    const confidence = clamp(bc - horizonConfidencePenalty, 0, 1);
    return { time_horizon: h, probability_delta, timeline_delta_months, risk_delta, confidence };
  });

  const related_goal_effects = (inputs.related_goal_effects ?? []).map((r) => ({
    goal_id: r.goal_id,
    delta: clamp(m * r.effect_ratio, -1, 1),
  }));
  const blocked_goal_effects = (inputs.blocked_goal_effects ?? []).map((r) => ({
    goal_id: r.goal_id,
    delta: clamp(m * r.effect_ratio, -1, 1),
  }));

  // ---- XAI ----
  const variance_factors: VarianceFactor[] = [];
  if (inputs.is_structural) {
    variance_factors.push({
      kind: 'structural_decision_pending',
      label: `Structural variable: ${inputs.structural_variable ?? 'unspecified'}`,
      effect: 0.15,
      confidence: 0.8,
    });
  }
  variance_factors.push({
    kind: 'horizon_length',
    label: 'Decision peak / decay model',
    effect: -0.05,
    confidence: 0.7,
  });

  const peakHorizon = inputs.is_structural
    ? '5_year'
    : nearestHorizonForMonths(inputs.peak_months ?? 12);
  const peakRow = per_horizon.find((p) => p.time_horizon === peakHorizon)!;

  const assumptions: string[] = [
    `Base magnitude (${m.toFixed(2)}) is the *peak* effect at the decision's natural horizon.`,
    inputs.is_structural
      ? 'This decision is treated as structural — its effect saturates rather than decays.'
      : 'This decision is treated as non-structural — effect rises to a peak then decays.',
    'Per-horizon deltas are estimates, not guarantees.',
  ];
  if (inputs.goal_target_months != null) {
    assumptions.push(
      `Goal target is approximately ${inputs.goal_target_months} months; impact is largest near that horizon.`
    );
  }

  const explanation: XAIExplanation = {
    assumptions,
    variance_factors: variance_factors.map((v) => ({
      kind: v.kind,
      label: v.label,
      effect: v.effect,
      confidence: v.confidence,
    })),
    evidence: [],
    confidence: bc,
    what_would_change_estimate: buildWhatWouldChange(inputs),
    related_goals_affected: related_goal_effects.map((r) => ({
      goal_id: r.goal_id,
      effect: r.delta,
    })),
    domains_affected: inputs.domains ?? [],
  };

  const reason = [
    `${inputs.decision_label}: peaks at ~${peakHorizon} with ${peakRow.probability_delta >= 0 ? '+' : ''}${(peakRow.probability_delta * 100).toFixed(0)}% on goal.`,
    inputs.is_structural
      ? `Structural (${inputs.structural_variable ?? 'unspecified'}) — long-horizon impact compounds.`
      : `Non-structural — effect dampens past peak.`,
    inputs.reason_addendum,
  ]
    .filter(Boolean)
    .join(' ');

  return {
    goal_id: inputs.goal_id,
    decision_label: inputs.decision_label,
    is_structural: inputs.is_structural,
    structural_variable: inputs.structural_variable,
    per_horizon,
    related_goal_effects,
    blocked_goal_effects,
    reason,
    explanation,
  };
}

function buildWhatWouldChange(inputs: DecisionImpactInputs): string[] {
  const out: string[] = [];
  if (!inputs.is_structural && (inputs.peak_months ?? 12) > 6) {
    out.push('If executed faster than the natural peak, short-horizon impact would be larger.');
  }
  if (inputs.is_structural) {
    out.push(
      'A change to the underlying structural variable midway would shift the long-horizon curve.'
    );
  }
  out.push(
    'Updating base_magnitude with realized outcome quality (post-completion) would calibrate future estimates.'
  );
  return out;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}
function clamp01(n: number | null | undefined): number {
  if (n == null || !Number.isFinite(n)) return 0;
  return clamp(n, 0, 1);
}
function indexOf(h: TimeHorizon): number {
  return TIME_HORIZONS_ORDER.indexOf(h);
}
function nearestHorizonForMonths(months: number): TimeHorizon {
  const buckets: Array<[number, TimeHorizon]> = [
    [0, 'immediate'],
    [3, '3_month'],
    [12, '1_year'],
    [36, '3_year'],
    [60, '5_year'],
    [120, '10_year'],
    [240, '20_year'],
  ];
  let best = buckets[0];
  let bestDist = Infinity;
  for (const b of buckets) {
    const d = Math.abs(b[0] - months);
    if (d < bestDist) {
      bestDist = d;
      best = b;
    }
  }
  return best[1];
}

export const __test = { computeDecisionImpact, nearestHorizonForMonths };
