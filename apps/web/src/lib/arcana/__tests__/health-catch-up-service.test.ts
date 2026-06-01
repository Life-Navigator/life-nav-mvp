/**
 * @jest-environment node
 *
 * Arcana Health Catch-Up Service tests.
 *
 * Contract:
 *   - classifyHealthStatus thresholds: ahead < -0.05, on_track ≤ 0.05,
 *     slightly ≤ 0.15, meaningfully ≤ 0.30, critical > 0.30.
 *   - Hard constraints filter the candidate set.
 *   - We never produce a "start over" suggestion (the notes never use
 *     that phrasing).
 *   - Determinism on identical inputs.
 */

import { __test } from '../health-catch-up-service';
import type { ArcanaConstraint } from '@/types/arcana';

const { classifyHealthStatus, computeHealthCatchUpPlan } = __test;

function hardConstraint(over: Partial<ArcanaConstraint>): ArcanaConstraint {
  return {
    id: 'c',
    user_id: 'u',
    profile_id: 'p',
    constraint_kind: 'time',
    description: 'test',
    severity: 'hard',
    is_active: true,
    metadata: {},
    created_at: '',
    updated_at: '',
    ...over,
  };
}

describe('classifyHealthStatus', () => {
  test.each([
    [0.1, 0.05, 'ahead_of_plan'],
    [0.5, 0.52, 'on_track'],
    [0.4, 0.55, 'slightly_behind'],
    [0.35, 0.55, 'meaningfully_behind'],
    [0.2, 0.55, 'critically_behind'],
    [0.1, 0.65, 'critically_behind'],
  ])('gap %f→%f classifies as %s', (current, target, expected) => {
    expect(classifyHealthStatus({ current_score: current, target_score: target })).toBe(expected);
  });

  test('NaN inputs → unknown', () => {
    expect(classifyHealthStatus({ current_score: NaN, target_score: 0.5 })).toBe('unknown');
  });
});

describe('computeHealthCatchUpPlan', () => {
  test('on_track gives a sustainer, not an "x more sessions" pile', () => {
    const r = computeHealthCatchUpPlan({
      goal_kind: 'cardiovascular_health',
      domains_touched: ['health', 'longevity'],
      current_score: 0.55,
      target_score: 0.55,
      target_at_months: 12,
    });
    expect(r.status).toBe('on_track');
    expect(r.smallest_realistic_recovery.length).toBeLessThanOrEqual(1);
    expect(r.notes.join(' ')).not.toMatch(/start over/i);
  });

  test('critically behind never returns 0 actions; notes warn but do not say start-over', () => {
    const r = computeHealthCatchUpPlan({
      goal_kind: 'fat_loss',
      domains_touched: ['body_composition', 'health'],
      current_score: 0.15,
      target_score: 0.6,
      target_at_months: 12,
    });
    expect(r.status).toBe('critically_behind');
    expect(r.smallest_realistic_recovery.length).toBeGreaterThan(0);
    const allNotes = r.notes.join(' ').toLowerCase();
    expect(allNotes).toContain('not asking you to start over');
    expect(allNotes).not.toContain('restart');
  });

  test('hard time-constraint of <2 hrs/week filters medium/large actions', () => {
    const r = computeHealthCatchUpPlan({
      goal_kind: 'cardiovascular_health',
      domains_touched: ['health', 'performance'],
      current_score: 0.3,
      target_score: 0.6,
      target_at_months: 6,
      constraints: [
        hardConstraint({
          constraint_kind: 'time',
          value_numeric: 1,
          value_unit: 'hours_per_week',
        }),
      ],
    });
    // Filtered actions can only be 'small'.
    expect(r.smallest_realistic_recovery.every((a) => a.effort === 'small')).toBe(true);
  });

  test('medical_restriction hard constraint suppresses provider-clearance-needing actions', () => {
    const r = computeHealthCatchUpPlan({
      goal_kind: 'cardiovascular_health',
      domains_touched: ['health'],
      current_score: 0.25,
      target_score: 0.65,
      target_at_months: 6,
      constraints: [
        hardConstraint({
          constraint_kind: 'medical_restriction',
          description: 'unmanaged hypertension',
        }),
      ],
    });
    expect(r.smallest_realistic_recovery.every((a) => !a.needs_provider_clearance)).toBe(true);
  });

  test('always carries the not-diagnosis disclaimer', () => {
    const r = computeHealthCatchUpPlan({
      goal_kind: 'lab_optimization',
      domains_touched: ['health', 'longevity'],
      current_score: 0.4,
      target_score: 0.7,
      target_at_months: 6,
    });
    expect(r.notes.some((n) => /not.*diagnosis.*prescription/i.test(n))).toBe(true);
  });

  test('determinism: identical inputs → identical output', () => {
    const args = {
      goal_kind: 'muscle_gain' as const,
      domains_touched: ['performance' as const, 'body_composition' as const],
      current_score: 0.35,
      target_score: 0.65,
      target_at_months: 6,
      has_provider_clearance: true,
    };
    const a = computeHealthCatchUpPlan(args);
    const b = computeHealthCatchUpPlan(args);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
