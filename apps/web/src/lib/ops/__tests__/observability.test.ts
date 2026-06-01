/**
 * @jest-environment node
 *
 * Observability + cost meter — pure helpers.
 */

import {
  estimateGeminiCostMicros,
  tagCrisisDetection,
  tagGovernanceIntervention,
} from '../observability';

describe('estimateGeminiCostMicros', () => {
  test('flash is cheaper than pro for the same usage', () => {
    const flash = estimateGeminiCostMicros('gemini-2.5-flash', 1000, 1000);
    const pro = estimateGeminiCostMicros('gemini-2.5-pro', 1000, 1000);
    expect(flash).toBeLessThan(pro);
  });
  test('zero tokens → zero cost', () => {
    expect(estimateGeminiCostMicros('gemini-2.5-flash', 0, 0)).toBe(0);
  });
  test('linear in token counts', () => {
    const a = estimateGeminiCostMicros('gemini-2.5-flash', 1000, 1000);
    const b = estimateGeminiCostMicros('gemini-2.5-flash', 2000, 2000);
    expect(b).toBeCloseTo(a * 2);
  });
});

describe('tagging helpers', () => {
  test('preserves prior metadata', () => {
    const m = tagGovernanceIntervention({ a: 1 }, 'blocked');
    expect(m).toEqual({ a: 1, governance_intervention_kind: 'blocked' });
  });
  test('crisis level appended', () => {
    const m = tagCrisisDetection({}, 'CRITICAL');
    expect(m).toEqual({ crisis_level: 'CRITICAL' });
  });
});
