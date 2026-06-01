/**
 * @jest-environment node
 *
 * Pure-logic tests for RecommendationQualityService aggregation +
 * PathwayEffectivenessService signature/label/pick helpers.
 */

import { __test } from '../recommendation-quality-service';
import type { GoalPathway, PathwayEdge } from '@/types/goal-hierarchy';
import type { AcceptanceStatus, RecommendationAcceptance } from '@/types/decision-journal';
import type { PathwayEffectiveness } from '@/types/decision-intelligence';

const { aggregateRecommendationQuality, pathwaySignature, pathwayLabelFor, pickBestEffectiveness } =
  __test;

let _id = 0;
function row(
  status: AcceptanceStatus,
  over: Partial<RecommendationAcceptance> = {}
): RecommendationAcceptance {
  return {
    id: `r${++_id}`,
    user_id: 'u',
    action_id: `a${_id}`,
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

describe('aggregateRecommendationQuality', () => {
  beforeEach(() => {
    _id = 0;
  });

  test('empty rows → zero totals', () => {
    const a = aggregateRecommendationQuality([], {
      period: 'monthly',
      period_window_start: '2026-01-01',
      recommendation_type: 'all',
      domain: 'all',
    });
    expect(a.total).toBe(0);
    expect(a.success_rate).toBe(0);
  });

  test('success_rate is over accepted-family (accepted+completed+abandoned+modified)', () => {
    const a = aggregateRecommendationQuality(
      [
        row('accepted'),
        row('completed'),
        row('completed'),
        row('abandoned'),
        row('rejected'), // not in denominator
        row('deferred'), // not in denominator
      ],
      {
        period: 'monthly',
        period_window_start: '2026-01-01',
        recommendation_type: 'all',
        domain: 'all',
      }
    );
    // Denominator = 4 (accepted-family), numerator = 2 completed.
    expect(a.success_rate).toBeCloseTo(0.5);
    expect(a.completion_rate).toBeCloseTo(2 / 6);
  });

  test('completion_rate uses total denominator', () => {
    const a = aggregateRecommendationQuality(
      [row('completed'), row('rejected'), row('rejected'), row('rejected')],
      {
        period: 'monthly',
        period_window_start: '2026-01-01',
        recommendation_type: 'all',
        domain: 'all',
      }
    );
    expect(a.completion_rate).toBeCloseTo(0.25);
  });

  test('means only over completed rows', () => {
    const a = aggregateRecommendationQuality(
      [
        row('completed', { outcome_quality: 0.8, user_satisfaction: 0.9 }),
        row('completed', { outcome_quality: 0.6, user_satisfaction: 0.7 }),
        row('rejected', { outcome_quality: 0.0, user_satisfaction: 0.0 }),
      ],
      {
        period: 'monthly',
        period_window_start: '2026-01-01',
        recommendation_type: 'all',
        domain: 'all',
      }
    );
    expect(a.mean_outcome_quality).toBeCloseTo(0.7);
    expect(a.mean_user_satisfaction).toBeCloseTo(0.8);
  });
});

// ---------------------------------------------------------------------------
// Pathway helpers
// ---------------------------------------------------------------------------

function edge(
  label: string,
  target: string,
  source = 's',
  strength = 1,
  confidence = 0.8
): PathwayEdge {
  return {
    source,
    target,
    label: label as PathwayEdge['label'],
    strength,
    confidence,
    source_table: 'goal_relationships',
  };
}

function pathway(edges: PathwayEdge[]): GoalPathway {
  return {
    root_goal_id: 'r',
    user_id: 'u',
    required: [],
    supporting: [],
    optional: [],
    blocked: [],
    edges,
    topological_order: [],
    cycles: [],
    computed_at: new Date().toISOString(),
  };
}

describe('pathwaySignature', () => {
  test('same edges → same signature', () => {
    const a = pathway([edge('SUPPORTS', 'fi'), edge('PREREQUISITE_FOR', 'home')]);
    const b = pathway([edge('SUPPORTS', 'fi'), edge('PREREQUISITE_FOR', 'home')]);
    expect(pathwaySignature(a)).toBe(pathwaySignature(b));
  });

  test('order matters', () => {
    const a = pathway([edge('SUPPORTS', 'fi'), edge('PREREQUISITE_FOR', 'home')]);
    const b = pathway([edge('PREREQUISITE_FOR', 'home'), edge('SUPPORTS', 'fi')]);
    expect(pathwaySignature(a)).not.toBe(pathwaySignature(b));
  });

  test('empty pathway has a deterministic signature', () => {
    expect(pathwaySignature(pathway([]))).toBe(pathwaySignature(pathway([])));
  });
});

describe('pathwayLabelFor', () => {
  test('single-label pathway gets a clean label', () => {
    const p = pathway([edge('SUPPORTS', 'a'), edge('SUPPORTS', 'b')]);
    expect(pathwayLabelFor(p)).toMatch(/Supports/i);
  });

  test('multi-label pathway lists top two labels', () => {
    const p = pathway([
      edge('SUPPORTS', 'a'),
      edge('SUPPORTS', 'b'),
      edge('PREREQUISITE_FOR', 'c'),
    ]);
    const label = pathwayLabelFor(p);
    expect(label.toLowerCase()).toContain('supports');
    expect(label.toLowerCase()).toContain('prerequisite for');
  });
});

describe('pickBestEffectiveness', () => {
  function row(over: Partial<PathwayEffectiveness>): PathwayEffectiveness {
    return {
      id: '1',
      root_goal_concept: 'FI',
      pathway_signature: 'sig',
      pathway_label: 'L',
      pathway_edges: [],
      sample_size: 10,
      success_count: 5,
      success_rate: 0.5,
      completion_rate: 0.4,
      mean_duration_months: 12,
      confidence: 0.7,
      computed_at: '',
      metadata: {},
      created_at: '',
      updated_at: '',
      user_id: null,
      ...over,
    };
  }

  test('empty → undefined', () => {
    expect(pickBestEffectiveness([])).toBeUndefined();
  });

  test('personal preferred over global cohort', () => {
    const r = pickBestEffectiveness([
      row({ user_id: null, success_rate: 0.9 }), // global, high
      row({ user_id: 'u', success_rate: 0.4 }), // personal, lower — still wins
    ]);
    expect(r?.user_id).toBe('u');
  });

  test('within personal, picks highest success_rate', () => {
    const r = pickBestEffectiveness([
      row({ user_id: 'u', success_rate: 0.3 }),
      row({ user_id: 'u', success_rate: 0.7 }),
    ]);
    expect(r?.success_rate).toBe(0.7);
  });
});
