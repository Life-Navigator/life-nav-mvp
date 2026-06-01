/**
 * @jest-environment node
 *
 * ProbabilityEngine tests — distribution invariants + XAI completeness.
 */

import { __test } from '../probability-engine';
import type { ProbabilityEngineInputs } from '../probability-engine';
import type { TimeHorizon } from '@/types/decision-impact';

const { computeProbabilityDistribution } = __test;

function I(over: Partial<ProbabilityEngineInputs> = {}): ProbabilityEngineInputs {
  return {
    goal_id: 'g1',
    current_progress: 0.4,
    domains: ['financial'],
    ...over,
  };
}

describe('computeProbabilityDistribution', () => {
  test('quantiles are monotonic worst → p10 → p25 → most_likely → p75 → p90 → best', () => {
    const d = computeProbabilityDistribution(I(), '1_year');
    expect(d.worst_case).toBeLessThanOrEqual(d.p10);
    expect(d.p10).toBeLessThanOrEqual(d.p25);
    expect(d.p25).toBeLessThanOrEqual(d.most_likely);
    expect(d.most_likely).toBeLessThanOrEqual(d.p75);
    expect(d.p75).toBeLessThanOrEqual(d.p90);
    expect(d.p90).toBeLessThanOrEqual(d.best_case);
  });

  test('all quantiles bounded in [0,1]', () => {
    const d = computeProbabilityDistribution(I({ current_progress: 0.9 }), '20_year');
    for (const v of [d.worst_case, d.p10, d.p25, d.most_likely, d.p75, d.p90, d.best_case]) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  test('range widens with horizon length', () => {
    const short = computeProbabilityDistribution(I(), '3_month');
    const long = computeProbabilityDistribution(I(), '20_year');
    const shortRange = short.best_case - short.worst_case;
    const longRange = long.best_case - long.worst_case;
    expect(longRange).toBeGreaterThan(shortRange);
  });

  test('range narrows with more supporting goals + better history', () => {
    const sparse = computeProbabilityDistribution(I(), '5_year');
    const rich = computeProbabilityDistribution(
      I({
        supporting_goals_count: 6,
        required_clear_fraction: 0.7,
        recommendation_quality_mean: 0.75,
        historical_accuracy_mean: 0.7,
        pathway_effectiveness: { sample_size: 30, success_rate: 0.7 },
      }),
      '5_year'
    );
    const sparseRange = sparse.best_case - sparse.worst_case;
    const richRange = rich.best_case - rich.worst_case;
    expect(richRange).toBeLessThan(sparseRange);
  });

  test('confidence grows with stronger signal inputs', () => {
    const sparse = computeProbabilityDistribution(I(), '1_year');
    const rich = computeProbabilityDistribution(
      I({
        current_progress_confidence: 0.8,
        historical_accuracy_mean: 0.7,
        pathway_effectiveness: { sample_size: 20, success_rate: 0.7 },
        supporting_goals_count: 4,
      }),
      '1_year'
    );
    expect(rich.confidence).toBeGreaterThan(sparse.confidence);
  });

  test('XAI envelope is fully populated', () => {
    const d = computeProbabilityDistribution(
      I({
        supporting_goals_count: 3,
        historical_accuracy_mean: 0.7,
        recommendation_quality_mean: 0.7,
        pathway_effectiveness: { sample_size: 12, success_rate: 0.65 },
        hard_constraint_count: 1,
        risk_tolerance_score: 0.6,
      }),
      '3_year'
    );
    expect(d.explanation.assumptions.length).toBeGreaterThan(0);
    expect(d.explanation.variance_factors.length).toBeGreaterThan(0);
    expect(d.explanation.evidence.length).toBeGreaterThan(0);
    expect(d.explanation.what_would_change_estimate.length).toBeGreaterThan(0);
    expect(d.explanation.domains_affected).toContain('financial');
  });

  test('domains_affected mirrors inputs.domains', () => {
    const d = computeProbabilityDistribution(
      I({ domains: ['financial', 'career', 'health'] }),
      '1_year'
    );
    expect(d.explanation.domains_affected).toEqual(['financial', 'career', 'health']);
  });

  test.each([
    'immediate',
    '3_month',
    '1_year',
    '3_year',
    '5_year',
    '10_year',
    '20_year',
  ] as TimeHorizon[])('horizon=%s round-trips through the output', (h) => {
    const d = computeProbabilityDistribution(I(), h);
    expect(d.time_horizon).toBe(h);
  });

  test('long-horizon assumption text mentions structural caveat', () => {
    const d = computeProbabilityDistribution(I(), '20_year');
    expect(d.explanation.assumptions.some((a) => /structural/.test(a))).toBe(true);
  });

  test('calibrated_confidence flows through to explanation', () => {
    const d = computeProbabilityDistribution(I({ calibrated_confidence: 0.42 }), '1_year');
    expect(d.explanation.calibrated_confidence).toBe(0.42);
  });
});
