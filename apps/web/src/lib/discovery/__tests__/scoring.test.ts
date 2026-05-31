/**
 * @jest-environment node
 *
 * Unit tests for the deterministic driver scorer. These lock in the
 * keyword + strong-signal heuristics so a regression is caught at PR
 * time, not in production.
 */

import { scoreAnswer, accumulateScores, dominantDrivers, driverConfidence } from '../scoring';

describe('scoreAnswer', () => {
  it('returns all-zero scores for empty input', () => {
    expect(scoreAnswer('')).toEqual({ financial_security: 0, image: 0, performance: 0 });
  });

  it('maps "provide for my kids" to financial_security as dominant', () => {
    const s = scoreAnswer('I want to provide for my kids and protect my family.');
    expect(s.financial_security).toBeGreaterThan(s.image);
    expect(s.financial_security).toBeGreaterThan(s.performance);
  });

  it('maps "look better in the mirror" to image as dominant', () => {
    const s = scoreAnswer(
      'I want to look better in the mirror and be more confident at the beach.'
    );
    expect(s.image).toBeGreaterThan(s.financial_security);
    expect(s.image).toBeGreaterThan(s.performance);
  });

  it('maps "promotion to staff engineer" to performance as dominant', () => {
    const s = scoreAnswer('I want a promotion to staff engineer and want to launch a startup.');
    expect(s.performance).toBeGreaterThan(s.financial_security);
    expect(s.performance).toBeGreaterThan(s.image);
  });

  it('normalizes the top score to 1', () => {
    const s = scoreAnswer('financial independence and retire early');
    const max = Math.max(s.financial_security, s.image, s.performance);
    expect(max).toBeCloseTo(1, 5);
  });
});

describe('accumulateScores', () => {
  it('weights later answers more heavily', () => {
    // First answer is performance-coded, second is financial-security-coded.
    // With recency weighting, financial_security should win even though they
    // both have the same per-answer score.
    const answers = [
      { text: 'win the competition and beat my PR', index: 0 },
      { text: 'protect my family financially', index: 1 },
    ];
    const s = accumulateScores(answers);
    expect(s.financial_security).toBeGreaterThan(s.performance);
  });

  it('handles empty input', () => {
    expect(accumulateScores([])).toEqual({
      financial_security: 0,
      image: 0,
      performance: 0,
    });
  });
});

describe('dominantDrivers', () => {
  it('returns null when no signals present', () => {
    expect(dominantDrivers({ financial_security: 0, image: 0, performance: 0 })).toEqual({
      dominant: null,
      secondary: null,
    });
  });

  it('picks the highest score as dominant', () => {
    const { dominant } = dominantDrivers({
      financial_security: 0.9,
      image: 0.4,
      performance: 0.2,
    });
    expect(dominant).toBe('financial_security');
  });

  it('reports a non-trivial secondary', () => {
    const { secondary } = dominantDrivers({
      financial_security: 0.9,
      image: 0.5,
      performance: 0.1,
    });
    expect(secondary).toBe('image');
  });

  it('drops a trivial secondary', () => {
    const { secondary } = dominantDrivers({
      financial_security: 0.9,
      image: 0.05,
      performance: 0.05,
    });
    expect(secondary).toBeNull();
  });
});

describe('driverConfidence', () => {
  it('is zero when no signals', () => {
    expect(driverConfidence({ financial_security: 0, image: 0, performance: 0 }, 1)).toBe(0);
  });

  it('rises with a clear winner', () => {
    const tight = driverConfidence({ financial_security: 0.5, image: 0.5, performance: 0.5 }, 1);
    const clear = driverConfidence({ financial_security: 1, image: 0.2, performance: 0.1 }, 1);
    expect(clear).toBeGreaterThan(tight);
  });

  it('rises with more collected turns', () => {
    const few = driverConfidence({ financial_security: 0.6, image: 0.4, performance: 0.2 }, 1);
    const many = driverConfidence({ financial_security: 0.6, image: 0.4, performance: 0.2 }, 5);
    expect(many).toBeGreaterThan(few);
  });

  it('is capped at 1', () => {
    const v = driverConfidence({ financial_security: 1, image: 0, performance: 0 }, 100);
    expect(v).toBeLessThanOrEqual(1);
  });
});
