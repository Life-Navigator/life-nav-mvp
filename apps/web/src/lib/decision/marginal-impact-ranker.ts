/**
 * MarginalImpactRanker
 *
 * Answers: "What is the highest-impact next decision for me, right now?"
 *
 * Pure cross-domain ranker. Inputs are decision candidates (each with
 * a base magnitude, peak months, structural flag) + the user's goal
 * context. Output is a sorted top-K list calibrated by accessibility
 * (surplus, hours, risk tolerance).
 *
 * The ranker does NOT mutate the catalog — adding new candidates is a
 * caller responsibility. It only ranks what it is given. This keeps
 * the engine deterministic + auditable.
 */

import { computeDecisionImpact } from './decision-impact-engine';
import type {
  DomainKey,
  MarginalImpactRankItem,
  MarginalImpactRanking,
  TimeHorizon,
  XAIExplanation,
} from '@/types/decision-impact';

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

export interface DecisionCandidate {
  decision_label_canonical: string;
  decision_label_user_friendly: string;
  target_goal_concept: string;
  target_goal_id?: string;
  domain: DomainKey;
  base_magnitude: number;
  peak_months?: number;
  decay_tau_months?: number;
  is_structural: boolean;
  structural_variable?: import('@/types/decision-impact').StructuralVariable;
  /** Cost / hours / risk-add — same shape as the catch-up catalog so we can
   *  re-use the same accessibility logic. */
  cost_usd?: number;
  hours_per_week?: number;
  risk_required?: number; // [0,1] — minimum risk tolerance to consider
  /** Optional reason string baked into the rank output. */
  reason?: string;
  tradeoffs?: string[];
}

export interface RankerInputs {
  user_id: string;
  candidates: DecisionCandidate[];
  available_surplus_usd?: number;
  commitment_hours_per_week?: number;
  risk_tolerance?: number;
  health_recovery_capacity?: number;
  hard_constraint_count?: number;
  top_k?: number;
  /** Horizon at which we score the marginal impact (default 1_year). */
  scoring_horizon?: TimeHorizon;
}

// ---------------------------------------------------------------------------
// Pure entrypoint
// ---------------------------------------------------------------------------

export function rankMarginalImpact(inputs: RankerInputs): MarginalImpactRanking {
  const horizon = inputs.scoring_horizon ?? '1_year';
  const topk = inputs.top_k ?? 10;

  const items: MarginalImpactRankItem[] = inputs.candidates.map((c) => {
    const impact = computeDecisionImpact({
      goal_id: c.target_goal_id ?? '',
      goal_concept: c.target_goal_concept,
      decision_label: c.decision_label_user_friendly,
      base_magnitude: c.base_magnitude,
      peak_months: c.peak_months,
      decay_tau_months: c.decay_tau_months,
      is_structural: c.is_structural,
      structural_variable: c.structural_variable,
      base_confidence: 0.6,
      domains: [c.domain],
    });
    const rowAtHorizon =
      impact.per_horizon.find((p) => p.time_horizon === horizon) ?? impact.per_horizon[2]; // fallback to 1_year-ish
    const accessibility = computeAccessibility(c, inputs);
    const adjusted = rowAtHorizon.probability_delta * accessibility;
    return {
      rank: 0, // filled in below
      decision: c.decision_label_user_friendly,
      decision_label_canonical: c.decision_label_canonical,
      target_goal: c.target_goal_concept,
      target_goal_id: c.target_goal_id,
      marginal_impact: clamp(adjusted, -1, 1),
      time_horizon: horizon,
      confidence: rowAtHorizon.confidence * accessibility,
      domain: c.domain,
      reason: c.reason ?? impact.reason,
      tradeoffs: c.tradeoffs ?? [],
    };
  });

  // Sort by absolute marginal impact desc — surface the biggest movers.
  items.sort((a, b) => Math.abs(b.marginal_impact) - Math.abs(a.marginal_impact));
  const top = items.slice(0, topk).map((it, i) => ({ ...it, rank: i + 1 }));

  const explanation: XAIExplanation = {
    assumptions: [
      `Marginal impact is computed at the ${horizon} horizon.`,
      'Accessibility multiplier discounts impact when the user lacks surplus, hours, or risk tolerance.',
      'Items are sorted by absolute impact magnitude — a strongly *risk-reducing* decision can outrank a small *probability-raising* one.',
    ],
    variance_factors: [],
    evidence: [],
    confidence: top.length > 0 ? mean(top.map((t) => t.confidence)) : 0,
    what_would_change_estimate: [
      'A different scoring_horizon would re-rank — try `5_year` for structural decisions.',
      'Increasing declared surplus / hours / risk tolerance would unlock accessibility-discounted candidates.',
    ],
    related_goals_affected: [],
    domains_affected: Array.from(new Set(top.map((t) => t.domain))),
  };

  return {
    user_id: inputs.user_id,
    ranked: top,
    computed_at: new Date().toISOString(),
    explanation,
  };
}

// ---------------------------------------------------------------------------
// Accessibility scoring — mirrors CatchUpEngine's feasibility helper.
// ---------------------------------------------------------------------------

function computeAccessibility(c: DecisionCandidate, inputs: RankerInputs): number {
  let f = 1.0;
  if (c.cost_usd != null && inputs.available_surplus_usd != null) {
    if (inputs.available_surplus_usd < c.cost_usd) {
      f *= clamp(inputs.available_surplus_usd / c.cost_usd, 0.1, 1);
    }
  }
  if (
    c.hours_per_week != null &&
    c.hours_per_week > 0 &&
    inputs.commitment_hours_per_week != null
  ) {
    if (inputs.commitment_hours_per_week < c.hours_per_week) {
      f *= clamp(inputs.commitment_hours_per_week / c.hours_per_week, 0.1, 1);
    }
  }
  if (c.risk_required != null && c.risk_required > 0 && inputs.risk_tolerance != null) {
    if (inputs.risk_tolerance < c.risk_required) {
      f *= clamp(inputs.risk_tolerance / c.risk_required, 0.2, 1);
    }
  }
  if ((inputs.hard_constraint_count ?? 0) > 0) f *= 0.85;
  if (inputs.health_recovery_capacity != null && (c.hours_per_week ?? 0) > 4) {
    f *= clamp01(inputs.health_recovery_capacity);
  }
  return clamp01(f);
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
function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

export const __test = { rankMarginalImpact, computeAccessibility };
