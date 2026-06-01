/**
 * @jest-environment node
 *
 * DriverInferenceEngine tests — same text → same scores, every run.
 */

import { __test } from '../driver-inference-engine';
import type { DriverScores } from '@/types/conversation-intel';

const {
  scoreTurn,
  combineDriverScores,
  pickDominantSecondary,
  confidenceFromObservations,
  inferDrivers,
} = __test;

describe('scoreTurn — driver matrix', () => {
  test.each([
    ['I want to feel safe and protected for my family', 'financial_security'],
    ['I worry about running out of money in retirement', 'financial_security'],
    ['I just want to sleep at night knowing the kids are taken care of', 'financial_security'],
    ['I want to be respected and have a real legacy', 'image'],
    ['I want people to see what I built', 'image'],
    ['I want to push myself to the next level', 'performance'],
    ['I want to maximize my potential and beat my own personal best', 'performance'],
    ['I want to optimize and master this domain', 'performance'],
  ] as const)('"%s" → dominant=%s', (text, want) => {
    const { scores } = scoreTurn(text);
    const max = (Object.entries(scores) as Array<[keyof DriverScores, number]>).sort(
      (a, b) => b[1] - a[1]
    )[0][0];
    expect(max).toBe(want);
  });

  test('empty string → zeros + no signals', () => {
    const r = scoreTurn('');
    expect(r.scores).toEqual({ financial_security: 0, image: 0, performance: 0 });
    expect(r.signals).toHaveLength(0);
  });

  test('determinism: same input → same output', () => {
    const a = scoreTurn('I want financial security for my family');
    const b = scoreTurn('I want financial security for my family');
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  test('signals[] reports the actual matching substrings', () => {
    const { signals } = scoreTurn('I want safety and security and peace of mind');
    expect(signals.length).toBeGreaterThanOrEqual(3);
    for (const s of signals) expect(typeof s.pattern).toBe('string');
  });
});

describe('combineDriverScores', () => {
  test('empty history → zeros', () => {
    expect(combineDriverScores([])).toEqual({ financial_security: 0, image: 0, performance: 0 });
  });

  test('averages across history', () => {
    const out = combineDriverScores([
      { financial_security: 0.8, image: 0.1, performance: 0.1 },
      { financial_security: 0.2, image: 0.7, performance: 0.1 },
    ]);
    expect(out.financial_security).toBeCloseTo(0.5);
    expect(out.image).toBeCloseTo(0.4);
    expect(out.performance).toBeCloseTo(0.1);
  });
});

describe('pickDominantSecondary', () => {
  test('clear winner + runner-up', () => {
    expect(
      pickDominantSecondary({ financial_security: 0.6, image: 0.3, performance: 0.1 })
    ).toEqual({ dominant: 'financial_security', secondary: 'image' });
  });

  test('all zeros → empty', () => {
    expect(pickDominantSecondary({ financial_security: 0, image: 0, performance: 0 })).toEqual({});
  });

  test('top two within 0.05 → no dominant', () => {
    const r = pickDominantSecondary({ financial_security: 0.4, image: 0.42, performance: 0.1 });
    expect(r.dominant).toBeUndefined();
    expect(r.secondary).toBe('financial_security');
  });
});

describe('confidenceFromObservations', () => {
  test.each([
    [0, 0],
    [1, 0.3],
    [3, 0.6],
    [5, 0.8],
    [10, 0.85],
  ] as const)('history of %d turns → confidence %s', (n, want) => {
    const history = Array.from({ length: n }, () => ({
      financial_security: 0.5,
      image: 0.3,
      performance: 0.2,
    }));
    expect(confidenceFromObservations(history)).toBeCloseTo(want);
  });
});

describe('inferDrivers — top-level entrypoint', () => {
  test('grows confidence as the conversation progresses', () => {
    let history: DriverScores[] = [];
    const r1 = inferDrivers({ current_text: 'I want safety', prior_per_turn_scores: history });
    history = [r1.per_turn];
    const r2 = inferDrivers({
      current_text: 'protection for my family',
      prior_per_turn_scores: history,
    });
    history = [r1.per_turn, r2.per_turn];
    const r3 = inferDrivers({
      current_text: 'I cannot afford to run out',
      prior_per_turn_scores: history,
    });
    expect(r3.confidence).toBeGreaterThan(r1.confidence);
    expect(r3.dominant).toBe('financial_security');
  });

  test('mixed-driver session surfaces a tied secondary', () => {
    const history: DriverScores[] = [
      { financial_security: 0.6, image: 0.0, performance: 0.4 },
      { financial_security: 0.55, image: 0.1, performance: 0.35 },
    ];
    const r = inferDrivers({
      current_text: 'I want to grow my net worth and push myself',
      prior_per_turn_scores: history,
    });
    expect(r.dominant ?? r.secondary).toBeDefined();
  });
});
