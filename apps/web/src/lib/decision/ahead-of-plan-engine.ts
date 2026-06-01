/**
 * AheadOfPlanEngine
 *
 *   "Sometimes the best recommendation is: preserve the gain and
 *    reduce risk." — sprint spec.
 *
 * If the user is ahead of trajectory, surface a calibrated menu of
 * options. The recommended default depends on risk tolerance and
 * commitment capacity:
 *
 *   * Low risk tolerance       → preserve_and_reduce_risk
 *   * High risk tolerance + capacity → accelerate or invest_more
 *   * Health capacity low      → reduce_intensity (not push harder)
 *
 * The engine never blindly pushes more optimization.
 */

import { classifyStatus } from './catch-up-engine';
import type {
  AheadOfPlanPlan,
  AheadOption,
  DomainKey,
  XAIExplanation,
} from '@/types/decision-impact';

export interface AheadOfPlanInputs {
  goal_id: string;
  goal_concept?: string;
  current_score: number;
  target_score: number;
  /** Available monthly surplus, USD. */
  available_surplus_usd?: number;
  /** Per-week capacity hours. */
  commitment_hours_per_week?: number;
  /** 0..1. */
  health_recovery_capacity?: number;
  /** 0..1. */
  risk_tolerance?: number;
  domains: DomainKey[];
  hard_constraint_count?: number;
}

// ---------------------------------------------------------------------------
// Option catalog
// ---------------------------------------------------------------------------

const OPTION_CATALOG: Record<DomainKey, AheadOption[]> = {
  financial: [
    {
      kind: 'invest_more',
      domain: 'financial',
      description: 'Increase brokerage contribution by $300/month',
      expected_probability_delta: 0.05,
      fits_risk_tolerance: true,
    },
    {
      kind: 'accelerate',
      domain: 'financial',
      description: 'Accelerate home purchase by 6 months',
      expected_probability_delta: 0.07,
      fits_risk_tolerance: true,
    },
    {
      kind: 'preserve_and_reduce_risk',
      domain: 'financial',
      description: 'Move surplus to high-yield savings + I-bonds; lock the gain',
      expected_probability_delta: 0.02,
      fits_risk_tolerance: true,
    },
    {
      kind: 'diversify_into_new_domain',
      domain: 'financial',
      description: 'Open a taxable brokerage three-fund position',
      expected_probability_delta: 0.04,
      fits_risk_tolerance: true,
    },
  ],
  career: [
    {
      kind: 'accelerate',
      domain: 'career',
      description: 'Negotiate promotion this cycle',
      expected_probability_delta: 0.06,
      fits_risk_tolerance: true,
    },
    {
      kind: 'reduce_intensity',
      domain: 'career',
      description: 'Move to 4-day work week to bank recovery',
      expected_probability_delta: 0.0,
      fits_risk_tolerance: true,
    },
  ],
  education: [
    {
      kind: 'invest_more',
      domain: 'education',
      description: 'Start a stretch credential (PMP, CFA L1)',
      expected_probability_delta: 0.05,
      fits_risk_tolerance: true,
    },
  ],
  health: [
    {
      kind: 'reduce_intensity',
      domain: 'health',
      description: 'Shift to maintenance volume to preserve gains',
      expected_probability_delta: 0.02,
      fits_risk_tolerance: true,
    },
    {
      kind: 'invest_more',
      domain: 'health',
      description: 'Add VO2max focus block (8 weeks)',
      expected_probability_delta: 0.05,
      fits_risk_tolerance: true,
    },
  ],
  insurance: [
    {
      kind: 'add_protection',
      domain: 'insurance',
      description: 'Add 20-year term life @ 12x income',
      expected_probability_delta: 0.04,
      fits_risk_tolerance: true,
    },
    {
      kind: 'add_protection',
      domain: 'insurance',
      description: 'Add long-term disability rider',
      expected_probability_delta: 0.04,
      fits_risk_tolerance: true,
    },
  ],
  benefits: [
    {
      kind: 'invest_more',
      domain: 'benefits',
      description: 'Backdoor Roth conversion this year',
      expected_probability_delta: 0.05,
      fits_risk_tolerance: true,
    },
  ],
  estate: [
    {
      kind: 'add_protection',
      domain: 'estate',
      description: 'Add revocable living trust + healthcare directives',
      expected_probability_delta: 0.04,
      fits_risk_tolerance: true,
    },
  ],
  entrepreneurship: [
    {
      kind: 'accelerate',
      domain: 'entrepreneurship',
      description: 'Allocate surplus to runway for a side venture',
      expected_probability_delta: 0.06,
      fits_risk_tolerance: false,
    },
  ],
  family: [
    {
      kind: 'reduce_intensity',
      domain: 'family',
      description: 'Reallocate weekly hours to family / lifestyle',
      expected_probability_delta: 0.01,
      fits_risk_tolerance: true,
    },
  ],
};

// ---------------------------------------------------------------------------
// Compute
// ---------------------------------------------------------------------------

export function computeAheadOfPlanPlan(inputs: AheadOfPlanInputs): AheadOfPlanPlan {
  const status = classifyStatus(inputs);
  const cushion = {
    current_score: inputs.current_score,
    target_score: inputs.target_score,
    delta: inputs.target_score - inputs.current_score,
  };

  const risk = inputs.risk_tolerance ?? 0.5;
  const health = inputs.health_recovery_capacity ?? 0.7;

  const options: AheadOption[] = [];
  for (const d of inputs.domains) {
    const candidates = OPTION_CATALOG[d] ?? [];
    for (const c of candidates) {
      // Annotate `fits_risk_tolerance` based on current user risk + the
      // option's nature.
      const fits = (() => {
        if (
          c.kind === 'preserve_and_reduce_risk' ||
          c.kind === 'add_protection' ||
          c.kind === 'reduce_intensity'
        )
          return true;
        if (c.kind === 'accelerate' || c.kind === 'invest_more') return risk >= 0.45;
        if (c.kind === 'diversify_into_new_domain') return risk >= 0.4;
        return c.fits_risk_tolerance;
      })();
      options.push({ ...c, fits_risk_tolerance: fits });
    }
  }

  // Recommend the default — the spec's emphasis is that "more
  // optimization" is NOT always the right call. Defaults:
  //
  //   * Low risk tolerance OR low health capacity → preserve / reduce intensity
  //   * Hard constraints present → preserve / reduce intensity
  //   * Otherwise → highest fits_risk_tolerance option by expected delta
  let recommended_default: AheadOption;
  const conservative = risk < 0.4 || health < 0.4 || (inputs.hard_constraint_count ?? 0) > 0;
  if (conservative) {
    recommended_default =
      options
        .filter(
          (o) =>
            o.kind === 'preserve_and_reduce_risk' ||
            o.kind === 'reduce_intensity' ||
            o.kind === 'add_protection'
        )
        .sort((a, b) => b.expected_probability_delta - a.expected_probability_delta)[0] ??
      options[0];
  } else {
    recommended_default =
      options
        .filter((o) => o.fits_risk_tolerance)
        .sort((a, b) => b.expected_probability_delta - a.expected_probability_delta)[0] ??
      options[0];
  }

  const explanation: XAIExplanation = {
    assumptions: [
      'Cushion is the current excess of trajectory score over target.',
      'Default leans conservative when risk tolerance is low or health capacity is low.',
      'The system does not blindly push for "more optimization" — preservation is a first-class option.',
    ],
    variance_factors: [],
    evidence: [],
    confidence: 0.6,
    what_would_change_estimate: [
      'A higher risk tolerance would unlock the accelerate / invest_more set.',
      'More commitment hours would expand the career and education options.',
      'Lower health recovery would push the default further toward reduce_intensity.',
    ],
    related_goals_affected: [],
    domains_affected: inputs.domains,
  };

  return {
    goal_id: inputs.goal_id,
    status,
    cushion,
    options,
    recommended_default,
    explanation,
  };
}

export const __test = { computeAheadOfPlanPlan };
