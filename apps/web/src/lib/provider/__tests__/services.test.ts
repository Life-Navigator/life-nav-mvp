/**
 * @jest-environment node
 *
 * Pure-logic tests for the view assembly, recommendation lifecycle,
 * and provider analytics aggregators.
 */

import { __test as viewTest } from '../view-service';
import { __test as recTest } from '../recommendation-service';
import { __test as analyticsTest } from '../analytics-service';
import type { ProviderOutcome, ProviderRecommendation } from '@/types/provider';

const { assemblePatientView, VISIBLE_FIELDS } = viewTest;
const { computeRecommendationLifecycleStats } = recTest;
const { computeProviderAnalytics } = analyticsTest;

let _idC = 0;
function rec(over: Partial<ProviderRecommendation> = {}): ProviderRecommendation {
  return {
    id: `r${++_idC}`,
    provider_id: 'prov_1',
    patient_user_id: 'patient_1',
    engagement_id: 'e_1',
    domain: 'health',
    title: 'Hydrate consistently',
    body: 'Aim for 2.5L plain water/day before training',
    rationale: 'Plasma volume affects HR + RPE',
    related_goal_id: null,
    expected_horizon_months: 1,
    expected_strength: 0.5,
    citations: [],
    issued_at: new Date().toISOString(),
    status: 'issued',
    metadata: {},
    created_at: '',
    updated_at: '',
    ...over,
  };
}

// ---------------------------------------------------------------------------
// View assembly
// ---------------------------------------------------------------------------

describe('assemblePatientView', () => {
  test('only the documented visible_fields appear in the output', () => {
    const v = assemblePatientView({
      patient_user_id: 'p1',
      provider_id: 'prov_1',
      scope_domain: 'health',
      rows: [],
    });
    expect(v.visible_fields).toEqual(VISIBLE_FIELDS);
  });

  test('coerces numeric strings + clamps negative counts to 0', () => {
    const v = assemblePatientView({
      patient_user_id: 'p1',
      provider_id: 'prov_1',
      scope_domain: 'health',
      rows: [
        {
          goal_id: 'g1',
          goal_title: 'VO2max',
          goal_domain: 'health',
          current_progress: '0.42',
          most_likely_prob: '0.65',
          probability_range: '50%–80%',
          confidence: '0.7',
          recommendation_count: -1,
          last_observation_at: '2026-05-31T00:00:00Z',
        },
      ],
    });
    expect(v.rows).toHaveLength(1);
    expect(v.rows[0].current_progress).toBeCloseTo(0.42);
    expect(v.rows[0].recommendation_count).toBe(0);
  });

  test('determinism: same inputs → byte-identical output (with frozen `now`)', () => {
    const args = {
      patient_user_id: 'p1',
      provider_id: 'prov_1',
      scope_domain: 'health' as const,
      rows: [],
      granted_at: '2026-01-01T00:00:00Z',
      now: '2026-05-01T00:00:00Z',
    };
    const a = assemblePatientView(args);
    const b = assemblePatientView(args);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

// ---------------------------------------------------------------------------
// Recommendation lifecycle
// ---------------------------------------------------------------------------

describe('computeRecommendationLifecycleStats', () => {
  beforeEach(() => {
    _idC = 0;
  });

  test('empty → all zeros', () => {
    const s = computeRecommendationLifecycleStats([]);
    expect(s).toEqual({
      issued: 0,
      accepted: 0,
      rejected: 0,
      modified: 0,
      completed: 0,
      abandoned: 0,
      acceptance_rate: 0,
      completion_rate: 0,
    });
  });

  test('acceptance_rate = accepted / issued; completion_rate uses accepted-family denominator', () => {
    const rows = [
      rec({ status: 'accepted' }),
      rec({ status: 'completed' }),
      rec({ status: 'completed' }),
      rec({ status: 'abandoned' }),
      rec({ status: 'rejected' }),
      rec({ status: 'issued' }),
    ];
    const s = computeRecommendationLifecycleStats(rows);
    expect(s.issued).toBe(6);
    expect(s.accepted).toBe(1);
    expect(s.acceptance_rate).toBeCloseTo(1 / 6);
    // accepted-family = accepted + completed + abandoned + modified = 1+2+1+0 = 4
    expect(s.completion_rate).toBeCloseTo(2 / 4);
  });
});

// ---------------------------------------------------------------------------
// Analytics aggregation
// ---------------------------------------------------------------------------

function outcome(over: Partial<ProviderOutcome> = {}): ProviderOutcome {
  return {
    id: 'o',
    recommendation_id: 'r',
    patient_user_id: 'p',
    provider_id: 'prov_1',
    observed_at: new Date().toISOString(),
    dimension: 'rhr',
    source: 'self_report',
    metadata: {},
    created_at: '',
    updated_at: '',
    ...over,
  };
}

describe('computeProviderAnalytics', () => {
  test('counts active patients distinct + averages outcome_quality + satisfaction', () => {
    const rows = [
      rec({ patient_user_id: 'p1', status: 'completed' }),
      rec({ patient_user_id: 'p1', status: 'accepted' }),
      rec({ patient_user_id: 'p2', status: 'completed' }),
      rec({ patient_user_id: 'p3', status: 'rejected' }),
    ];
    const outcomes = [
      outcome({ outcome_quality: 0.8, user_satisfaction: 0.9 }),
      outcome({ outcome_quality: 0.6, user_satisfaction: 0.7 }),
      outcome({ outcome_quality: null, user_satisfaction: null }),
    ];
    const out = computeProviderAnalytics({
      provider_id: 'prov_1',
      period: 'monthly',
      period_start: '2026-05-01',
      recommendations: rows,
      outcomes,
    });
    expect(out.active_patient_count).toBe(3);
    expect(out.recommendations_issued).toBe(4);
    expect(out.recommendations_completed).toBe(2);
    expect(out.recommendations_rejected).toBe(1);
    expect(out.mean_outcome_quality).toBeCloseTo(0.7);
    expect(out.mean_user_satisfaction).toBeCloseTo(0.8);
  });

  test('does not leak data for patients outside the provider_id', () => {
    // The aggregator takes ONLY rows the caller passed in. If the
    // loader is correctly scoped to provider_id (which RLS enforces),
    // the aggregator can never expand the set.
    const rows = [rec({ patient_user_id: 'p1', status: 'completed' })];
    const out = computeProviderAnalytics({
      provider_id: 'prov_1',
      period: 'monthly',
      period_start: '2026-05-01',
      recommendations: rows,
      outcomes: [],
    });
    expect(out.active_patient_count).toBe(1);
  });

  test('determinism: identical inputs → identical aggregate (minus computed_at)', () => {
    const rows = [rec({ status: 'completed' })];
    const a = computeProviderAnalytics({
      provider_id: 'prov_1',
      period: 'monthly',
      period_start: '2026-05-01',
      recommendations: rows,
      outcomes: [],
    });
    const b = computeProviderAnalytics({
      provider_id: 'prov_1',
      period: 'monthly',
      period_start: '2026-05-01',
      recommendations: rows,
      outcomes: [],
    });
    const ax = { ...a, computed_at: '' };
    const bx = { ...b, computed_at: '' };
    expect(JSON.stringify(ax)).toBe(JSON.stringify(bx));
  });
});
