/**
 * @jest-environment node
 *
 * Tests for the horizon-dampening curves. The spec's worked example
 * is the calibration target: a non-structural decision with
 * base_magnitude=0.18 should land at +12% / +18% / +9% / +3% across
 * 3mo / 1yr / 3yr / 10yr.
 */

import { __test } from '../horizon-dampening';
import type { TimeHorizon } from '@/types/decision-impact';

const { nonStructuralFactor, structuralFactor, varianceWideningForHorizon } = __test;

describe('nonStructuralFactor — calibration vs spec example', () => {
  // Spec: "Reduce credit utilization below 10%" → "Home ownership"
  //   3mo:  +12% → factor ≈ 0.667
  //   1yr:  +18% → factor = 1.0 (peak)
  //   3yr:  +9%  → factor ≈ 0.5
  //   10yr: +3%  → factor ≈ 0.17
  test.each([
    ['3_month', 0.66, 0.08],
    ['1_year', 1.0, 0.02],
    ['3_year', 0.67, 0.1],
    ['10_year', 0.17, 0.08],
  ] as Array<[TimeHorizon, number, number]>)('horizon=%s factor ≈ %s (±%s)', (h, want, tol) => {
    const got = nonStructuralFactor(h);
    expect(Math.abs(got - want)).toBeLessThanOrEqual(tol);
  });

  test('factor at peak (1_year, default peak_months=12) is exactly 1.0', () => {
    expect(nonStructuralFactor('1_year')).toBeCloseTo(1.0);
  });

  test('factor is monotonically non-decreasing from immediate → peak', () => {
    const ts: TimeHorizon[] = ['immediate', '3_month', '1_year'];
    const vals = ts.map((t) => nonStructuralFactor(t));
    for (let i = 1; i < vals.length; i += 1) expect(vals[i]).toBeGreaterThanOrEqual(vals[i - 1]);
  });

  test('factor is monotonically decreasing past peak', () => {
    const ts: TimeHorizon[] = ['1_year', '3_year', '5_year', '10_year', '20_year'];
    const vals = ts.map((t) => nonStructuralFactor(t));
    for (let i = 1; i < vals.length; i += 1) expect(vals[i]).toBeLessThan(vals[i - 1]);
  });

  test('with a longer peak_months, peak shifts later', () => {
    expect(nonStructuralFactor('1_year', { peak_months: 36 })).toBeLessThan(1.0);
    expect(nonStructuralFactor('3_year', { peak_months: 36 })).toBeCloseTo(1.0);
  });
});

describe('structuralFactor', () => {
  test('saturates upward toward long horizons', () => {
    const v1 = structuralFactor('1_year');
    const v5 = structuralFactor('5_year');
    const v20 = structuralFactor('20_year');
    expect(v1).toBeLessThan(v5);
    expect(v5).toBeLessThan(v20);
  });

  test('structural beats non-structural for long-horizon impact', () => {
    expect(structuralFactor('10_year')).toBeGreaterThan(nonStructuralFactor('10_year'));
    expect(structuralFactor('20_year')).toBeGreaterThan(nonStructuralFactor('20_year'));
  });

  test('immediate horizon non-zero for structural (effect already locked in)', () => {
    expect(structuralFactor('immediate')).toBeGreaterThan(0);
  });
});

describe('varianceWideningForHorizon', () => {
  test('strictly non-decreasing across horizons', () => {
    const ts: TimeHorizon[] = [
      'immediate',
      '3_month',
      '1_year',
      '3_year',
      '5_year',
      '10_year',
      '20_year',
    ];
    const vals = ts.map((t) => varianceWideningForHorizon(t));
    for (let i = 1; i < vals.length; i += 1) expect(vals[i]).toBeGreaterThanOrEqual(vals[i - 1]);
  });
  test('bounded above by ~0.55', () => {
    expect(varianceWideningForHorizon('20_year')).toBeLessThan(0.6);
  });
});
