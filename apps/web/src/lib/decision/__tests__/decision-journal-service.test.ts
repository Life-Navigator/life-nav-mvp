/**
 * @jest-environment node
 *
 * Pure-logic tests for the decision-journal helpers. The Supabase I/O
 * is exercised at integration time; here we exhaustively test the
 * delta + accuracy + verdict computation since those numbers feed
 * downstream learning signals.
 */

import { __test } from '../decision-journal-service';

const { computeOutcomeDeltas, verdictFromAccuracy } = __test;

describe('computeOutcomeDeltas', () => {
  test('null expected → null delta / null accuracy', () => {
    expect(computeOutcomeDeltas(null, 100)).toEqual({
      delta_value: null,
      delta_pct: null,
      accuracy_score: null,
    });
  });
  test('exact match → 1.0 accuracy', () => {
    const r = computeOutcomeDeltas(1000, 1000);
    expect(r.delta_value).toBe(0);
    expect(r.delta_pct).toBe(0);
    expect(r.accuracy_score).toBeCloseTo(1.0);
  });
  test('50% miss → 0.5 accuracy', () => {
    const r = computeOutcomeDeltas(1000, 1500);
    expect(r.delta_pct).toBeCloseTo(0.5);
    expect(r.accuracy_score).toBeCloseTo(0.5);
  });
  test('100% miss → 0 accuracy (clamped)', () => {
    const r = computeOutcomeDeltas(1000, 0);
    expect(r.delta_pct).toBe(-1);
    expect(r.accuracy_score).toBe(0);
  });
  test('200% miss still clamps to 0 accuracy', () => {
    const r = computeOutcomeDeltas(1000, 3000);
    expect(r.delta_pct).toBe(2);
    expect(r.accuracy_score).toBe(0);
  });
  test('expected zero uses unit denominator to avoid div-by-zero', () => {
    const r = computeOutcomeDeltas(0, 50);
    expect(r.delta_value).toBe(50);
    expect(r.delta_pct).toBe(50); // denom max(1, |0|) = 1
    expect(r.accuracy_score).toBe(0);
  });
});

describe('verdictFromAccuracy', () => {
  test.each([
    [null, 'no_signal_yet'],
    [-0.5, 'much_worse_than_expected'],
    [-0.2, 'worse_than_expected'],
    [-0.05, 'as_expected'],
    [0, 'as_expected'],
    [0.05, 'as_expected'],
    [0.2, 'better_than_expected'],
    [0.5, 'much_better_than_expected'],
  ] as const)('delta_pct=%s → %s', (delta, want) => {
    expect(verdictFromAccuracy(delta)).toBe(want);
  });
});
