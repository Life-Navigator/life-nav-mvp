/**
 * @jest-environment node
 *
 * Pure-logic tests for GoalProgressService.scoreGoalProgress.
 */

import { __test } from '../goal-progress-service';

const { scoreGoalProgress, clamp01 } = __test;

const D = (status: 'made' | 'pending' = 'made', conf = 0.7) => ({
  id: 'd' + Math.random(),
  status,
  system_confidence_at_decision: conf,
});

const O = (delta_pct: number | null, accuracy_score: number | null) => ({
  id: 'o' + Math.random(),
  delta_pct,
  accuracy_score,
});

describe('clamp01', () => {
  test.each([
    [null, 0],
    [undefined, 0],
    [NaN, 0],
    [-0.3, 0],
    [0, 0],
    [0.5, 0.5],
    [1, 1],
    [1.7, 1],
  ] as const)('clamp01(%s) = %s', (input, want) => {
    expect(clamp01(input as number | null | undefined)).toBe(want);
  });
});

describe('scoreGoalProgress', () => {
  test('no inputs → returns previous_score unchanged with low confidence', () => {
    const r = scoreGoalProgress({
      previous_score: 0.3,
      decisions: [],
      outcomes: [],
    });
    expect(r.goal_progress_score).toBeCloseTo(0.3);
    expect(r.goal_progress_delta).toBeCloseTo(0);
    expect(r.confidence).toBeLessThan(0.6); // no signals
  });

  test('positive outcomes increase the score', () => {
    const r = scoreGoalProgress({
      previous_score: 0.3,
      decisions: [D('made', 0.8)],
      outcomes: [O(0.4, 0.9), O(0.2, 0.8)],
    });
    expect(r.goal_progress_delta).toBeGreaterThan(0);
  });

  test('negative outcomes decrease the score (but cannot go below 0)', () => {
    const r = scoreGoalProgress({
      previous_score: 0.1,
      decisions: [D()],
      outcomes: [O(-0.5, 0.9), O(-0.3, 0.8)],
    });
    expect(r.goal_progress_delta).toBeLessThan(0);
    expect(r.goal_progress_score).toBeGreaterThanOrEqual(0);
  });

  test('supporting goals contribute (capped at 0.4)', () => {
    const r = scoreGoalProgress({
      previous_score: 0,
      decisions: [],
      outcomes: [],
      supporting_goals: [
        {
          goal_id: 's1',
          classification: 'supporting',
          depth: 1,
          via_edges: [],
          cumulative_strength: 0.9,
        },
        {
          goal_id: 's2',
          classification: 'supporting',
          depth: 1,
          via_edges: [],
          cumulative_strength: 0.9,
        },
        {
          goal_id: 's3',
          classification: 'supporting',
          depth: 1,
          via_edges: [],
          cumulative_strength: 0.9,
        },
      ],
    });
    // Mean 0.9 capped at 0.4 contribution.
    expect(r.goal_progress_score).toBeCloseTo(0.4);
  });

  test('required clearance adds up to 0.3 contribution', () => {
    const r = scoreGoalProgress({
      previous_score: 0,
      decisions: [],
      outcomes: [],
      required_clear_fraction: 1,
    });
    expect(r.goal_progress_score).toBeCloseTo(0.3);
  });

  test('outputs are clamped to [0,1]', () => {
    const r = scoreGoalProgress({
      previous_score: 0.9,
      decisions: [D('made', 1)],
      outcomes: [O(1, 1), O(1, 1)],
      supporting_goals: [
        {
          goal_id: 's',
          classification: 'supporting',
          depth: 1,
          via_edges: [],
          cumulative_strength: 1,
        },
      ],
      required_clear_fraction: 1,
    });
    expect(r.goal_progress_score).toBeLessThanOrEqual(1);
    expect(r.goal_progress_score).toBeGreaterThanOrEqual(0);
  });

  test('reasoning array is populated with one line per signal that fired', () => {
    const r = scoreGoalProgress({
      previous_score: 0.2,
      decisions: [D()],
      outcomes: [O(0.3, 0.8)],
      supporting_goals: [
        {
          goal_id: 's',
          classification: 'supporting',
          depth: 1,
          via_edges: [],
          cumulative_strength: 0.5,
        },
      ],
      required_clear_fraction: 0.5,
    });
    expect(r.reasoning.length).toBeGreaterThanOrEqual(3);
  });

  test('confidence is bounded [0,1] and grows with more signals', () => {
    const oneSignal = scoreGoalProgress({
      previous_score: 0,
      decisions: [D()],
      outcomes: [O(0.2, 0.9)],
    });
    const threeSignals = scoreGoalProgress({
      previous_score: 0,
      decisions: [D()],
      outcomes: [O(0.2, 0.9)],
      supporting_goals: [
        {
          goal_id: 's',
          classification: 'supporting',
          depth: 1,
          via_edges: [],
          cumulative_strength: 0.8,
        },
      ],
      required_clear_fraction: 0.5,
    });
    expect(threeSignals.confidence).toBeGreaterThan(oneSignal.confidence);
    expect(threeSignals.confidence).toBeLessThanOrEqual(1);
  });
});
