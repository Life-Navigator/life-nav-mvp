/**
 * @jest-environment node
 *
 * Tests for the calibration math — Brier score, calibration curve,
 * confidence calibration application.
 */

import { __test } from '../calibration-service';
import type { PredictionCalibration } from '@/types/decision-intelligence';

const {
  brierScore,
  computeCalibrationCurve,
  calibrateConfidence,
  buildCurveFromHistory,
  bucketLabel,
} = __test;

describe('brierScore', () => {
  test('perfect predictions → 0', () => {
    expect(
      brierScore([
        { predicted: 1, actual: 1 },
        { predicted: 0, actual: 0 },
        { predicted: 0.7, actual: 0.7 },
      ])
    ).toBeCloseTo(0);
  });

  test('always-50%-correct → 0.5', () => {
    const xs = [
      { predicted: 0.5, actual: 1 },
      { predicted: 0.5, actual: 0 },
    ];
    expect(brierScore(xs)).toBeCloseTo(0.25);
  });

  test('worst case: confident wrong → 1.0', () => {
    expect(
      brierScore([
        { predicted: 1, actual: 0 },
        { predicted: 0, actual: 1 },
      ])
    ).toBeCloseTo(1);
  });

  test('empty input → 0', () => {
    expect(brierScore([])).toBe(0);
  });
});

describe('computeCalibrationCurve', () => {
  test('10 perfectly-calibrated predictions across bins → ECE near 0', () => {
    const xs = [];
    for (let i = 0; i < 10; i += 1) {
      const p = (i + 0.5) / 10;
      xs.push({ predicted: p, actual: p }, { predicted: p, actual: p });
    }
    const c = computeCalibrationCurve(xs);
    expect(c.calibration_error).toBeLessThan(0.05);
    expect(c.confidence_accuracy_gap).toBeCloseTo(0);
    expect(c.n).toBe(20);
  });

  test('overconfident predictions → positive gap, positive ECE', () => {
    const xs = Array.from({ length: 20 }, () => ({ predicted: 0.9, actual: 0.4 }));
    const c = computeCalibrationCurve(xs);
    expect(c.confidence_accuracy_gap).toBeGreaterThan(0);
    expect(c.calibration_error).toBeGreaterThan(0.3);
  });

  test('underconfident predictions → negative gap', () => {
    const xs = Array.from({ length: 20 }, () => ({ predicted: 0.3, actual: 0.7 }));
    const c = computeCalibrationCurve(xs);
    expect(c.confidence_accuracy_gap).toBeLessThan(0);
  });

  test('bucket labels are stable: 0.0-0.1, 0.1-0.2, …', () => {
    expect(bucketLabel(0, 10)).toBe('0.0-0.1');
    expect(bucketLabel(9, 10)).toBe('0.9-1.0');
  });

  test('p=1.0 still lands in the last bin (not out of range)', () => {
    const c = computeCalibrationCurve([{ predicted: 1, actual: 1 }]);
    expect(c.bins[9].n).toBe(1);
  });
});

describe('calibrateConfidence', () => {
  test('without curve, returns input unchanged', () => {
    expect(calibrateConfidence(0.7, undefined)).toBeCloseTo(0.7);
    expect(
      calibrateConfidence(0.7, {
        brier_score: 0,
        calibration_error: 0,
        confidence_accuracy_gap: 0,
        bins: [],
        n: 0,
      })
    ).toBeCloseTo(0.7);
  });

  test('overconfident user → calibrated downwards via gap fallback', () => {
    // No bin has enough support → falls back to gap subtraction.
    const xs = Array.from({ length: 4 }, () => ({ predicted: 0.9, actual: 0.4 }));
    const c = computeCalibrationCurve(xs);
    const calibrated = calibrateConfidence(0.9, c, { min_support: 100 });
    expect(calibrated).toBeLessThan(0.9);
  });

  test('well-supported bin: uses bin mean_actual directly', () => {
    const xs = Array.from({ length: 20 }, () => ({ predicted: 0.85, actual: 0.6 }));
    const c = computeCalibrationCurve(xs);
    const calibrated = calibrateConfidence(0.85, c, { min_support: 5 });
    expect(calibrated).toBeCloseTo(0.6, 1);
  });

  test('output is clamped to [0,1]', () => {
    // Build a degenerate curve.
    const c = computeCalibrationCurve([{ predicted: 0.1, actual: 0.9 }]);
    expect(calibrateConfidence(0.1, c)).toBeGreaterThanOrEqual(0);
    expect(calibrateConfidence(0.1, c)).toBeLessThanOrEqual(1);
  });
});

describe('buildCurveFromHistory', () => {
  function h(predicted: number, actualCorrect: boolean, validated = true): PredictionCalibration {
    return {
      id: 'x',
      user_id: 'u',
      predicted_at: '',
      predicted_confidence: predicted,
      actual_correct: actualCorrect,
      bucket: '',
      metadata: {},
      created_at: '',
      updated_at: '',
      validated_at: validated ? new Date().toISOString() : null,
    };
  }

  test('unvalidated predictions are excluded', () => {
    const c = buildCurveFromHistory([h(0.9, true, false), h(0.9, false, false)]);
    expect(c.n).toBe(0);
  });

  test('validated predictions populate the curve', () => {
    const c = buildCurveFromHistory([h(0.9, true), h(0.9, false), h(0.5, true), h(0.5, false)]);
    expect(c.n).toBe(4);
    expect(c.brier_score).toBeGreaterThan(0);
  });
});
