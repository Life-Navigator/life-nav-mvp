/**
 * CounterfactualEngine — DETERMINISTIC.
 *
 * Answers "What would change this recommendation?" by enumerating
 * targeted perturbations to the inputs and re-running the relevant
 * engine. Each result is ranked by sensitivity (= how much the output
 * changed per unit change in the input).
 *
 * The engine is pure-functional: same inputs → same counterfactuals,
 * same ordering, same sensitivity scores. No LLM. No random sampling.
 *
 * Currently supports four target kinds:
 *
 *   * goal_decision_impact          — perturb base_magnitude, peak_months,
 *                                      is_structural
 *   * goal_probability_distribution — perturb current_progress,
 *                                      supporting_goals_count,
 *                                      hard_constraint_count
 *   * recommendation_output         — perturb root-goal confidence,
 *                                      calibrated_confidence
 *   * catch_up_plan                 — perturb available_surplus,
 *                                      commitment_hours
 */

import { computeDecisionImpact, type DecisionImpactInputs } from './decision-impact-engine';
import { computeProbabilityDistribution, type ProbabilityEngineInputs } from './probability-engine';
import { computeCatchUpPlan, type CatchUpInputs } from './catch-up-engine';
import { TIME_HORIZONS_ORDER } from '@/types/decision-impact';
import type { CounterfactualOutcome, CounterfactualScenario } from '@/types/xai';

// ---------------------------------------------------------------------------
// Result shape (untyped id; persistence layer fills it in)
// ---------------------------------------------------------------------------

export type CounterfactualResult = Omit<CounterfactualScenario, 'id' | 'user_id' | 'computed_at'>;

// ---------------------------------------------------------------------------
// Decision-impact counterfactuals
// ---------------------------------------------------------------------------

export function counterfactualsForDecisionImpact(
  inputs: DecisionImpactInputs
): CounterfactualResult[] {
  const baseline = computeDecisionImpact(inputs);
  const baselineDelta =
    baseline.per_horizon.find((p) => p.time_horizon === '1_year')?.probability_delta ?? 0;

  const variants: Array<{
    label: string;
    mutate: () => DecisionImpactInputs;
    perturbation: CounterfactualResult['perturbation'];
  }> = [
    {
      label: 'base_magnitude halved',
      mutate: () => ({ ...inputs, base_magnitude: inputs.base_magnitude / 2 }),
      perturbation: {
        input_field: 'base_magnitude',
        from: inputs.base_magnitude,
        to: inputs.base_magnitude / 2,
        magnitude: -0.5,
      },
    },
    {
      label: 'base_magnitude doubled',
      mutate: () => ({ ...inputs, base_magnitude: Math.min(1, inputs.base_magnitude * 2) }),
      perturbation: {
        input_field: 'base_magnitude',
        from: inputs.base_magnitude,
        to: Math.min(1, inputs.base_magnitude * 2),
        magnitude: 1.0,
      },
    },
    {
      label: 'reclassified as structural',
      mutate: () => ({ ...inputs, is_structural: !inputs.is_structural }),
      perturbation: {
        input_field: 'is_structural',
        from: inputs.is_structural,
        to: !inputs.is_structural,
        magnitude: 1.0,
      },
    },
    {
      label: 'peak_months pulled forward to 3',
      mutate: () => ({ ...inputs, peak_months: 3 }),
      perturbation: {
        input_field: 'peak_months',
        from: inputs.peak_months ?? 12,
        to: 3,
        magnitude: (3 - (inputs.peak_months ?? 12)) / Math.max(1, inputs.peak_months ?? 12),
      },
    },
  ];

  return variants
    .map(({ label, mutate, perturbation }) => {
      const cf = computeDecisionImpact(mutate());
      const cfDelta =
        cf.per_horizon.find((p) => p.time_horizon === '1_year')?.probability_delta ?? 0;
      const flipSign =
        Math.sign(baselineDelta) !== 0 && Math.sign(cfDelta) !== Math.sign(baselineDelta);
      const absChange = Math.abs(cfDelta - baselineDelta);
      let outcome: CounterfactualOutcome = 'no_change';
      if (flipSign) outcome = 'flipped';
      else if (absChange > 0.05) outcome = 'reranked';
      else if (absChange > 0.005) outcome = 'confidence_changed';

      return {
        target_kind: 'goal_decision_impact' as const,
        target_id: undefined,
        scenario_label: label,
        perturbation,
        expected_outcome: outcome,
        new_top_recommendation: undefined,
        new_confidence: cf.explanation.confidence,
        delta_summary: `1-year probability_delta: ${(baselineDelta * 100).toFixed(1)}% → ${(cfDelta * 100).toFixed(1)}% (Δ ${((cfDelta - baselineDelta) * 100).toFixed(1)}pp)`,
        sensitivity: clamp01(absChange / Math.max(0.01, Math.abs(perturbation.magnitude))),
      };
    })
    .sort((a, b) => b.sensitivity - a.sensitivity);
}

// ---------------------------------------------------------------------------
// Probability-distribution counterfactuals
// ---------------------------------------------------------------------------

export function counterfactualsForProbability(
  inputs: ProbabilityEngineInputs,
  horizon: import('@/types/decision-impact').TimeHorizon
): CounterfactualResult[] {
  const baseline = computeProbabilityDistribution(inputs, horizon);

  const variants: Array<{
    label: string;
    mutate: () => ProbabilityEngineInputs;
    perturbation: CounterfactualResult['perturbation'];
  }> = [
    {
      label: 'current_progress +10pp',
      mutate: () => ({ ...inputs, current_progress: clamp01(inputs.current_progress + 0.1) }),
      perturbation: {
        input_field: 'current_progress',
        from: inputs.current_progress,
        to: clamp01(inputs.current_progress + 0.1),
        magnitude: 0.1 / Math.max(0.01, inputs.current_progress),
      },
    },
    {
      label: 'current_progress -10pp',
      mutate: () => ({ ...inputs, current_progress: clamp01(inputs.current_progress - 0.1) }),
      perturbation: {
        input_field: 'current_progress',
        from: inputs.current_progress,
        to: clamp01(inputs.current_progress - 0.1),
        magnitude: -0.1 / Math.max(0.01, inputs.current_progress),
      },
    },
    {
      label: 'supporting_goals_count +3',
      mutate: () => ({
        ...inputs,
        supporting_goals_count: (inputs.supporting_goals_count ?? 0) + 3,
      }),
      perturbation: {
        input_field: 'supporting_goals_count',
        from: inputs.supporting_goals_count ?? 0,
        to: (inputs.supporting_goals_count ?? 0) + 3,
        magnitude: 3,
      },
    },
    {
      label: 'hard_constraint_count cleared',
      mutate: () => ({ ...inputs, hard_constraint_count: 0 }),
      perturbation: {
        input_field: 'hard_constraint_count',
        from: inputs.hard_constraint_count ?? 0,
        to: 0,
        magnitude: -(inputs.hard_constraint_count ?? 0),
      },
    },
  ];

  return variants
    .map(({ label, mutate, perturbation }) => {
      const cf = computeProbabilityDistribution(mutate(), horizon);
      const baselineML = baseline.most_likely;
      const cfML = cf.most_likely;
      const absChange = Math.abs(cfML - baselineML);
      let outcome: CounterfactualOutcome = 'no_change';
      if (absChange > 0.1) outcome = 'flipped';
      else if (absChange > 0.03) outcome = 'reranked';
      else if (absChange > 0.005) outcome = 'confidence_changed';

      return {
        target_kind: 'goal_probability_distribution' as const,
        target_id: undefined,
        scenario_label: label,
        perturbation,
        expected_outcome: outcome,
        new_top_recommendation: undefined,
        new_confidence: cf.confidence,
        delta_summary: `most_likely: ${(baselineML * 100).toFixed(0)}% → ${(cfML * 100).toFixed(0)}% (Δ ${((cfML - baselineML) * 100).toFixed(1)}pp); range ${((cf.best_case - cf.worst_case) * 100).toFixed(0)}%`,
        sensitivity: clamp01(absChange / Math.max(0.01, Math.abs(perturbation.magnitude))),
      };
    })
    .sort((a, b) => b.sensitivity - a.sensitivity);
}

// ---------------------------------------------------------------------------
// Catch-up counterfactuals
// ---------------------------------------------------------------------------

export function counterfactualsForCatchUp(inputs: CatchUpInputs): CounterfactualResult[] {
  const baseline = computeCatchUpPlan(inputs);

  const variants: Array<{
    label: string;
    mutate: () => CatchUpInputs;
    perturbation: CounterfactualResult['perturbation'];
  }> = [
    {
      label: 'available_surplus_usd doubled',
      mutate: () => ({ ...inputs, available_surplus_usd: (inputs.available_surplus_usd ?? 0) * 2 }),
      perturbation: {
        input_field: 'available_surplus_usd',
        from: inputs.available_surplus_usd ?? 0,
        to: (inputs.available_surplus_usd ?? 0) * 2,
        magnitude: 1.0,
      },
    },
    {
      label: 'commitment_hours_per_week +5',
      mutate: () => ({
        ...inputs,
        commitment_hours_per_week: (inputs.commitment_hours_per_week ?? 0) + 5,
      }),
      perturbation: {
        input_field: 'commitment_hours_per_week',
        from: inputs.commitment_hours_per_week ?? 0,
        to: (inputs.commitment_hours_per_week ?? 0) + 5,
        magnitude: 5,
      },
    },
    {
      label: 'risk_tolerance raised to 0.9',
      mutate: () => ({ ...inputs, risk_tolerance: 0.9 }),
      perturbation: {
        input_field: 'risk_tolerance',
        from: inputs.risk_tolerance ?? 0.5,
        to: 0.9,
        magnitude: 0.9 - (inputs.risk_tolerance ?? 0.5),
      },
    },
  ];

  return variants
    .map(({ label, mutate, perturbation }) => {
      const cf = computeCatchUpPlan(mutate());
      const baselineP = baseline.probability_after_catch_up;
      const cfP = cf.probability_after_catch_up;
      const absChange = Math.abs(cfP - baselineP);
      let outcome: CounterfactualOutcome = 'no_change';
      if (cf.status !== baseline.status) outcome = 'flipped';
      else if (absChange > 0.05) outcome = 'reranked';
      else if (absChange > 0.005) outcome = 'confidence_changed';

      return {
        target_kind: 'catch_up_plan' as const,
        target_id: undefined,
        scenario_label: label,
        perturbation,
        expected_outcome: outcome,
        new_top_recommendation: cf.catch_up_actions[0]?.description,
        new_confidence: cf.explanation.confidence,
        delta_summary: `status: ${baseline.status} → ${cf.status}; probability_after: ${(baselineP * 100).toFixed(0)}% → ${(cfP * 100).toFixed(0)}%; ${cf.catch_up_actions.length} action(s) in new plan`,
        sensitivity: clamp01(absChange / Math.max(0.01, Math.abs(perturbation.magnitude))),
      };
    })
    .sort((a, b) => b.sensitivity - a.sensitivity);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

export const __test = {
  counterfactualsForDecisionImpact,
  counterfactualsForProbability,
  counterfactualsForCatchUp,
  TIME_HORIZONS_ORDER,
};
