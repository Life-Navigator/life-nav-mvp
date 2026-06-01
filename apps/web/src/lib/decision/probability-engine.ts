/**
 * ProbabilityEngine
 *
 * Builds a calibrated probability distribution over goal achievement
 * at a chosen time horizon. The distribution is the primary
 * decision-support surface: it carries quantiles (worst /
 * p10 / p25 / most_likely / p75 / p90 / best) plus an XAI envelope
 * (assumptions, variance_factors, what_would_change_estimate).
 *
 * IMPORTANT — uncertainty discipline:
 *
 *   * Quantiles are scenario-based estimates, not statistical
 *     confidence intervals. We use uncertainty language in the
 *     `assumptions` field on every output.
 *   * `confidence` is a meta-quantity on the *estimate*, distinct
 *     from `most_likely`. Low support or sparse history → low
 *     confidence even when `most_likely` looks high.
 *   * For long horizons we widen the distribution because future
 *     decisions still buffer the outcome.
 */

import { dampening, varianceWideningForHorizon } from './horizon-dampening';
import type {
  DomainKey,
  ProbabilityDistribution,
  TimeHorizon,
  VarianceFactor,
  XAIExplanation,
} from '@/types/decision-impact';

// ---------------------------------------------------------------------------
// Inputs — the strongest signals first
// ---------------------------------------------------------------------------

export interface ProbabilityEngineInputs {
  goal_id: string;
  goal_concept?: string; // 'Financial Independence', 'Home Ownership', ...
  /** Current `goal_progress_score` (0..1). 0 = no progress, 1 = achieved. */
  current_progress: number;
  /** Confidence reported on the current progress snapshot. */
  current_progress_confidence?: number;
  /** Number of supporting (required + supporting bucket) goals already cleared / partially cleared. */
  supporting_goals_count?: number;
  required_clear_fraction?: number;
  blocked_goals_count?: number;
  /** Historical mean outcome quality on this user's recommendation actions (0..1). */
  recommendation_quality_mean?: number;
  /** Historical mean prediction accuracy on this user (0..1). */
  historical_accuracy_mean?: number;
  /** Pathway effectiveness sample size + success_rate, if a matching row exists. */
  pathway_effectiveness?: {
    sample_size: number;
    success_rate?: number;
    completion_rate?: number;
    confidence?: number;
  };
  /** User-side context flags. */
  hard_constraint_count?: number;
  risk_tolerance_score?: number; // 0..1
  commitment_hours_per_week?: number;
  /** Domains the goal touches. Used for XAI `domains_affected`. */
  domains?: DomainKey[];
  /** A simulation summary, if hierarchy-aware evaluator has scored scenarios. */
  simulation_summary?: { evaluated_scenarios?: number; score?: number; note?: string };
  /** A calibrated_confidence carried from the AdvisorReasoningService, if any. */
  calibrated_confidence?: number;
  /** Optional pending decision for which we're projecting under-impact distribution. */
  pending_decision_label?: string;
  /** Related goal ids; included verbatim in the XAI block. */
  related_goal_ids?: string[];
}

// ---------------------------------------------------------------------------
// Pure entrypoint
// ---------------------------------------------------------------------------

export function computeProbabilityDistribution(
  inputs: ProbabilityEngineInputs,
  horizon: TimeHorizon
): ProbabilityDistribution {
  const p = clamp01(inputs.current_progress);

  // 1. Build the most-likely point.
  const supportSignal = supportContribution(inputs);
  const qualitySignal = qualityContribution(inputs);
  const pathwaySignal = pathwayContribution(inputs);
  const horizonGrowth = horizonGrowthFactor(horizon);

  const most_likely = clamp01(
    p + horizonGrowth * (0.2 * supportSignal + 0.2 * qualitySignal + 0.2 * pathwaySignal)
  );

  // 2. Variance: widening with horizon, narrowing with support + quality.
  const widen = varianceWideningForHorizon(horizon);
  const narrowing = narrowingFromInputs(inputs);
  const halfWidth = clamp(widen * (1 - narrowing), 0.05, 0.5);

  const worst_case = clamp01(most_likely - halfWidth);
  const best_case = clamp01(most_likely + halfWidth);
  // 80/50/20 quantiles via a smooth interpolation between the bounds.
  const p10 = clamp01(most_likely - 0.78 * halfWidth);
  const p25 = clamp01(most_likely - 0.45 * halfWidth);
  const p75 = clamp01(most_likely + 0.45 * halfWidth);
  const p90 = clamp01(most_likely + 0.78 * halfWidth);

  // 3. Meta-confidence on the estimate itself.
  const confidence = confidenceFromInputs(inputs);

  // 4. XAI envelope.
  const variance_factors = buildVarianceFactors(inputs, horizon);
  const assumptions = buildAssumptions(inputs, horizon);
  const evidence = buildEvidence(inputs);
  const what_would_change = buildWhatWouldChange(inputs);

  const explanation: XAIExplanation = {
    assumptions,
    variance_factors: variance_factors.map((v) => ({
      kind: v.kind,
      label: v.label,
      effect: v.effect,
      confidence: v.confidence,
    })),
    evidence,
    confidence,
    calibrated_confidence: inputs.calibrated_confidence,
    what_would_change_estimate: what_would_change,
    related_goals_affected: (inputs.related_goal_ids ?? []).map((id) => ({
      goal_id: id,
      effect: 0,
    })),
    domains_affected: inputs.domains ?? [],
  };

  return {
    goal_id: inputs.goal_id,
    time_horizon: horizon,
    worst_case,
    p10,
    p25,
    most_likely,
    p75,
    p90,
    best_case,
    confidence,
    explanation,
  };
}

// ---------------------------------------------------------------------------
// Contributions (pure helpers — each [0,1])
// ---------------------------------------------------------------------------

function supportContribution(i: ProbabilityEngineInputs): number {
  const supporting = clamp01((i.supporting_goals_count ?? 0) / 6);
  const required = clamp01(i.required_clear_fraction ?? 0);
  const blocked = clamp01((i.blocked_goals_count ?? 0) / 4);
  return clamp01(0.5 * supporting + 0.4 * required - 0.3 * blocked);
}

function qualityContribution(i: ProbabilityEngineInputs): number {
  // High historical recommendation quality + accuracy → likely to keep moving.
  const rec = i.recommendation_quality_mean ?? 0.4;
  const acc = i.historical_accuracy_mean ?? 0.4;
  return clamp01(0.5 * rec + 0.5 * acc);
}

function pathwayContribution(i: ProbabilityEngineInputs): number {
  if (!i.pathway_effectiveness) return 0.3; // neutral when unknown
  const s = i.pathway_effectiveness.success_rate ?? 0.3;
  // Discount by sample size: < 5 samples → halve.
  return i.pathway_effectiveness.sample_size < 5 ? s * 0.5 : s;
}

function horizonGrowthFactor(h: TimeHorizon): number {
  // How much room "future progress" has to add to most_likely beyond
  // the current snapshot. Caps at 1.0 for 5+ years.
  return dampening(h, /* structural */ true, {});
}

function narrowingFromInputs(i: ProbabilityEngineInputs): number {
  // Narrowing is bounded so we cannot collapse to a single point.
  const support = clamp01((i.supporting_goals_count ?? 0) / 8);
  const quality = i.recommendation_quality_mean ?? 0.3;
  const accuracy = i.historical_accuracy_mean ?? 0.3;
  const pathwayN = i.pathway_effectiveness?.sample_size ?? 0;
  const pathway = clamp01(pathwayN / 30);
  return clamp(0.2 * support + 0.2 * quality + 0.2 * accuracy + 0.2 * pathway, 0, 0.8);
}

function confidenceFromInputs(i: ProbabilityEngineInputs): number {
  let c = 0.3;
  if (i.current_progress_confidence != null) c += 0.15 * clamp01(i.current_progress_confidence);
  if (i.historical_accuracy_mean != null) c += 0.15 * clamp01(i.historical_accuracy_mean);
  if (i.pathway_effectiveness && i.pathway_effectiveness.sample_size >= 5) c += 0.15;
  if ((i.supporting_goals_count ?? 0) >= 3) c += 0.1;
  return clamp01(c);
}

// ---------------------------------------------------------------------------
// XAI builders
// ---------------------------------------------------------------------------

function buildVarianceFactors(i: ProbabilityEngineInputs, h: TimeHorizon): VarianceFactor[] {
  const out: VarianceFactor[] = [];
  out.push({
    kind: 'horizon_length',
    label: `Horizon: ${h}`,
    effect: -varianceWideningForHorizon(h),
    confidence: 0.9,
  });
  if (i.supporting_goals_count && i.supporting_goals_count >= 3) {
    out.push({
      kind: 'support_count',
      label: `Supporting goals: ${i.supporting_goals_count}`,
      effect: 0.15,
      confidence: 0.8,
    });
  }
  if (i.historical_accuracy_mean != null) {
    out.push({
      kind: 'historical_accuracy',
      label: `Historical accuracy ${(i.historical_accuracy_mean * 100).toFixed(0)}%`,
      effect: i.historical_accuracy_mean > 0.6 ? 0.1 : -0.1,
      confidence: 0.7,
    });
  }
  if (i.recommendation_quality_mean != null) {
    out.push({
      kind: 'recommendation_quality',
      label: `Recommendation quality ${(i.recommendation_quality_mean * 100).toFixed(0)}%`,
      effect: i.recommendation_quality_mean > 0.6 ? 0.08 : -0.05,
      confidence: 0.7,
    });
  }
  if (i.pathway_effectiveness?.sample_size) {
    out.push({
      kind: 'pathway_effectiveness',
      label: `Pathway sample n=${i.pathway_effectiveness.sample_size}`,
      effect: i.pathway_effectiveness.sample_size >= 15 ? 0.15 : 0.05,
      confidence: 0.7,
    });
  }
  if (i.hard_constraint_count && i.hard_constraint_count > 0) {
    out.push({
      kind: 'constraint_severity',
      label: `${i.hard_constraint_count} hard constraint(s)`,
      effect: -0.1,
      confidence: 0.7,
    });
  }
  if (i.risk_tolerance_score != null) {
    out.push({
      kind: 'risk_tolerance',
      label: `Risk tolerance ${(i.risk_tolerance_score * 100).toFixed(0)}%`,
      effect: i.risk_tolerance_score > 0.7 ? 0.05 : -0.05,
      confidence: 0.6,
    });
  }
  if (i.pathway_effectiveness == null) {
    out.push({
      kind: 'data_sparsity',
      label: 'No matching pathway history',
      effect: -0.15,
      confidence: 0.6,
    });
  }
  return out;
}

function buildAssumptions(i: ProbabilityEngineInputs, h: TimeHorizon): string[] {
  const out: string[] = [
    `Quantiles are scenario-based estimates, not statistical confidence intervals.`,
    `Range widens at longer horizons because future decisions remain unmade.`,
  ];
  if (h === '20_year' || h === '10_year') {
    out.push(
      'Estimate assumes no structural life event (career change, major health, family change) outside currently logged decisions.'
    );
  }
  if (i.pathway_effectiveness == null) {
    out.push('No historical pathway data for similar goals; estimate uses a neutral prior.');
  }
  if ((i.supporting_goals_count ?? 0) === 0) {
    out.push('No supporting goals declared; estimate may improve as more sub-goals are linked.');
  }
  if (i.hard_constraint_count && i.hard_constraint_count > 0) {
    out.push(`${i.hard_constraint_count} hard constraint(s) currently bound the action space.`);
  }
  return out;
}

function buildEvidence(i: ProbabilityEngineInputs): XAIExplanation['evidence'] {
  const e: XAIExplanation['evidence'] = [];
  if (i.pathway_effectiveness) {
    e.push({
      label: `Pathway success_rate=${(i.pathway_effectiveness.success_rate ?? 0).toFixed(2)} on n=${i.pathway_effectiveness.sample_size}`,
      source: 'pathway_effectiveness',
      confidence: i.pathway_effectiveness.confidence ?? 0.6,
    });
  }
  if (i.recommendation_quality_mean != null) {
    e.push({
      label: `Recommendation quality mean=${i.recommendation_quality_mean.toFixed(2)}`,
      source: 'recommendation_quality',
      confidence: 0.6,
    });
  }
  if (i.historical_accuracy_mean != null) {
    e.push({
      label: `Personal history mean accuracy=${i.historical_accuracy_mean.toFixed(2)}`,
      source: 'personal_history',
      confidence: 0.6,
    });
  }
  return e;
}

function buildWhatWouldChange(i: ProbabilityEngineInputs): string[] {
  const out: string[] = [];
  if ((i.supporting_goals_count ?? 0) < 3) {
    out.push('Declaring more sub-goals (supporting / prerequisite) would narrow the range.');
  }
  if (i.recommendation_quality_mean == null || i.recommendation_quality_mean < 0.5) {
    out.push('More completed accepted recommendations would raise the most-likely point.');
  }
  if (i.pathway_effectiveness == null) {
    out.push(
      'A pathway-effectiveness row matching the resolved pathway signature would replace the neutral prior.'
    );
  }
  if (i.hard_constraint_count && i.hard_constraint_count > 0) {
    out.push(
      'Relaxing or removing a hard constraint would expand the action space and shift the curve up.'
    );
  }
  if (i.calibrated_confidence == null) {
    out.push(
      'Once enough validated predictions exist, calibrated_confidence will tighten the estimate.'
    );
  }
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

export const __test = {
  computeProbabilityDistribution,
  supportContribution,
  qualityContribution,
  pathwayContribution,
  varianceWideningForHorizon,
};
