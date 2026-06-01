/**
 * @jest-environment node
 *
 * DecisionImpactEngine tests — including the spec's worked example for
 * "Reduce credit utilization → Home ownership" and the structural-vs-
 * non-structural sensitivity contrast.
 */

import { __test } from '../decision-impact-engine';
import type { DecisionImpactInputs } from '../decision-impact-engine';
import type { TimeHorizon } from '@/types/decision-impact';

const { computeDecisionImpact } = __test;

function base(over: Partial<DecisionImpactInputs> = {}): DecisionImpactInputs {
  return {
    goal_id: 'g1',
    decision_label: 'Reduce credit utilization below 10%',
    base_magnitude: 0.18,
    is_structural: false,
    domains: ['financial'],
    ...over,
  };
}

function getAt(impact: ReturnType<typeof computeDecisionImpact>, h: TimeHorizon) {
  return impact.per_horizon.find((p) => p.time_horizon === h)!;
}

describe('Spec worked example: credit utilization → home ownership', () => {
  test('non-structural decision peaks at 1_year and dampens past', () => {
    const impact = computeDecisionImpact(base());
    const at3mo = getAt(impact, '3_month').probability_delta;
    const at1y = getAt(impact, '1_year').probability_delta;
    const at3y = getAt(impact, '3_year').probability_delta;
    const at10y = getAt(impact, '10_year').probability_delta;
    // 1yr is the peak; 3mo and 3yr are below it; 10yr is barely positive.
    expect(at1y).toBeGreaterThan(at3mo);
    expect(at1y).toBeGreaterThan(at3y);
    expect(at3y).toBeGreaterThan(at10y);
    expect(at10y).toBeLessThan(0.05);
  });

  test('matches spec numbers within tolerance: 3mo ~+12%, 1yr ~+18%, 3yr ~+9%, 10yr ~+3%', () => {
    const impact = computeDecisionImpact(base());
    expect(getAt(impact, '3_month').probability_delta).toBeCloseTo(0.12, 1);
    expect(getAt(impact, '1_year').probability_delta).toBeCloseTo(0.18, 2);
    expect(getAt(impact, '3_year').probability_delta).toBeCloseTo(0.09, 1);
    expect(getAt(impact, '10_year').probability_delta).toBeCloseTo(0.03, 1);
  });
});

describe('Structural vs non-structural', () => {
  test('structural decision keeps long-horizon impact while non-structural decays', () => {
    const nonStruct = computeDecisionImpact(base({ base_magnitude: 0.3 }));
    const struct = computeDecisionImpact(
      base({
        base_magnitude: 0.3,
        is_structural: true,
        structural_variable: 'education_credential',
        decision_label: 'Finish law school',
      })
    );
    // 20-year impact: structural >> non-structural.
    const nsAt20 = getAt(nonStruct, '20_year').probability_delta;
    const sAt20 = getAt(struct, '20_year').probability_delta;
    expect(sAt20).toBeGreaterThan(nsAt20 * 5);
  });

  test('structural is_structural flag flows through to output', () => {
    const out = computeDecisionImpact(
      base({ is_structural: true, structural_variable: 'income_trajectory' })
    );
    expect(out.is_structural).toBe(true);
    expect(out.structural_variable).toBe('income_trajectory');
  });

  test('non-structural goal: paying off credit card has dampened long-horizon impact on 20-year FI', () => {
    // Spec example: non-structural decision on a long-horizon goal.
    const impact = computeDecisionImpact(
      base({
        decision_label: 'Pay off one credit card',
        base_magnitude: 0.25,
        goal_target_months: 240, // 20-year FI
      })
    );
    expect(getAt(impact, '20_year').probability_delta).toBeLessThan(0.05);
  });

  test('structural goal: finishing law school has strong long-horizon income impact', () => {
    const impact = computeDecisionImpact({
      goal_id: 'g_income',
      decision_label: 'Finish law school',
      base_magnitude: 0.55,
      is_structural: true,
      structural_variable: 'education_credential',
      domains: ['career', 'education'],
    });
    const at1y = getAt(impact, '1_year').probability_delta;
    const at10y = getAt(impact, '10_year').probability_delta;
    expect(at10y).toBeGreaterThan(at1y);
    expect(at10y).toBeGreaterThan(0.3);
  });
});

describe('Related + blocked goal effects', () => {
  test('per-related-goal effects are scaled by base_magnitude', () => {
    const impact = computeDecisionImpact(
      base({
        related_goal_effects: [{ goal_id: 'g2', effect_ratio: 0.5 }],
        blocked_goal_effects: [{ goal_id: 'g3', effect_ratio: -0.4 }],
      })
    );
    const g2 = impact.related_goal_effects.find((e) => e.goal_id === 'g2');
    const g3 = impact.blocked_goal_effects.find((e) => e.goal_id === 'g3');
    expect(g2?.delta).toBeCloseTo(0.18 * 0.5);
    expect(g3?.delta).toBeCloseTo(0.18 * -0.4);
  });
});

describe('XAI envelope', () => {
  test('every output carries assumptions + reason + explanation.confidence', () => {
    const impact = computeDecisionImpact(base());
    expect(impact.explanation.assumptions.length).toBeGreaterThan(0);
    expect(impact.reason).toMatch(/peak/i);
    expect(impact.explanation.confidence).toBeGreaterThan(0);
    expect(impact.explanation.confidence).toBeLessThanOrEqual(1);
  });

  test('structural decisions surface a structural variance factor', () => {
    const impact = computeDecisionImpact(
      base({ is_structural: true, structural_variable: 'income_trajectory' })
    );
    const f = impact.explanation.variance_factors.find(
      (v) => v.kind === 'structural_decision_pending'
    );
    expect(f).toBeDefined();
  });
});
