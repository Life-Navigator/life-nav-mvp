/**
 * @jest-environment node
 *
 * Pure-logic tests for AcceptanceMetrics computation.
 */

import { __test } from '../recommendation-acceptance-service';
import type { RecommendationAcceptance, AcceptanceStatus } from '@/types/decision-journal';

const { computeMetrics } = __test;

let _id = 0;
function row(
  status: AcceptanceStatus,
  over: Partial<RecommendationAcceptance> = {}
): RecommendationAcceptance {
  return {
    id: `r${++_id}`,
    user_id: 'u',
    action_id: `act_${_id}`,
    recommendation_summary: 'rec',
    expected_strength: 0.7,
    domain: 'finance',
    status,
    metadata: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...over,
  };
}

describe('computeMetrics', () => {
  beforeEach(() => {
    _id = 0;
  });

  test('empty input → zeros, no per-domain entries', () => {
    const m = computeMetrics([]);
    expect(m.total).toBe(0);
    expect(m.accept_rate).toBe(0);
    expect(m.completion_rate).toBe(0);
    expect(Object.keys(m.by_domain)).toHaveLength(0);
    expect(m.mean_adherence).toBeUndefined();
  });

  test('all-accepted row set → accept_rate=1, completion_rate=0 (no completes yet)', () => {
    const m = computeMetrics([row('accepted'), row('accepted'), row('accepted')]);
    expect(m.accept_rate).toBe(1);
    expect(m.completion_rate).toBe(0);
  });

  test('mixed: 2 accept, 1 reject, 1 modify, 1 defer → rates sum approx', () => {
    const m = computeMetrics([
      row('accepted'),
      row('accepted'),
      row('rejected'),
      row('modified'),
      row('deferred'),
    ]);
    expect(m.accept_rate).toBeCloseTo(0.4);
    expect(m.reject_rate).toBeCloseTo(0.2);
    expect(m.modify_rate).toBeCloseTo(0.2);
    expect(m.defer_rate).toBeCloseTo(0.2);
  });

  test('completion_rate uses ACCEPTED_FAMILY denominator (excludes rejected/deferred)', () => {
    // 4 in accepted-family: 2 completed + 1 abandoned + 1 accepted. completion = 2/4 = 0.5
    const m = computeMetrics([
      row('completed'),
      row('completed'),
      row('abandoned'),
      row('accepted'),
      row('rejected'),
      row('deferred'), // NOT in denominator
    ]);
    expect(m.completion_rate).toBeCloseTo(0.5);
    expect(m.abandonment_rate).toBeCloseTo(0.25);
  });

  test('means computed only over completed rows', () => {
    const m = computeMetrics([
      row('completed', { adherence_score: 0.8, user_satisfaction: 0.9, outcome_quality: 0.7 }),
      row('completed', { adherence_score: 0.6, user_satisfaction: 0.7, outcome_quality: 0.9 }),
      row('rejected', { adherence_score: 0.0, user_satisfaction: 0.0, outcome_quality: 0.0 }), // ignored
    ]);
    expect(m.mean_adherence).toBeCloseTo(0.7);
    expect(m.mean_user_satisfaction).toBeCloseTo(0.8);
    expect(m.mean_outcome_quality).toBeCloseTo(0.8);
  });

  test('per-domain breakdown sums to total', () => {
    const m = computeMetrics([
      row('accepted', { domain: 'finance' }),
      row('completed', { domain: 'finance' }),
      row('rejected', { domain: 'career' }),
      row('completed', { domain: 'career' }),
    ]);
    const sum = Object.values(m.by_domain).reduce((a, d) => a + d.total, 0);
    expect(sum).toBe(4);
    expect(m.by_domain.finance.total).toBe(2);
    expect(m.by_domain.career.total).toBe(2);
  });

  test('row with no domain falls into the "unknown" bucket', () => {
    const m = computeMetrics([row('accepted', { domain: null })]);
    expect(m.by_domain.unknown.total).toBe(1);
  });
});
