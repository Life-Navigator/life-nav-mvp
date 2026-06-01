/**
 * @jest-environment node
 *
 * FeatureFlagService pure-logic tests.
 */

import { __test as flagsTest } from '../feature-flags';

const { evaluateFlag, djb2Pct, userBucket } = flagsTest;

function f(slug: string, over: Partial<Parameters<typeof evaluateFlag>[0]['flag']> = {}) {
  return {
    slug,
    enabled: true,
    flag_kind: 'boolean' as const,
    rollout_pct: null,
    cohort_slug: null,
    allowed_user_ids: [],
    ...over,
  };
}

describe('evaluateFlag', () => {
  test('default: enabled=true → enabled', () => {
    expect(evaluateFlag({ flag: f('x') }).enabled).toBe(true);
  });
  test('default: enabled=false → disabled', () => {
    expect(evaluateFlag({ flag: f('x', { enabled: false }) }).enabled).toBe(false);
  });

  test('per-user override beats everything', () => {
    expect(
      evaluateFlag({
        flag: f('x', { enabled: true }),
        user_id: 'u1',
        user_override: { flag_slug: 'x', enabled: false },
        now: '2026-06-01T00:00:00Z',
      }).enabled
    ).toBe(false);
  });

  test('expired override falls through to default', () => {
    expect(
      evaluateFlag({
        flag: f('x', { enabled: true }),
        user_id: 'u1',
        user_override: { flag_slug: 'x', enabled: false, expires_at: '2025-01-01T00:00:00Z' },
        now: '2026-06-01T00:00:00Z',
      }).enabled
    ).toBe(true);
  });

  test('allow_list match → enabled regardless of cohort/rollout', () => {
    expect(
      evaluateFlag({
        flag: f('x', { enabled: false, allowed_user_ids: ['u1'] }),
        user_id: 'u1',
      }).enabled
    ).toBe(true);
  });

  test('cohort match honors flag.enabled', () => {
    expect(
      evaluateFlag({
        flag: f('x', { enabled: true, cohort_slug: 'veterans' }),
        user_id: 'u1',
        user_cohorts: ['veterans'],
      }).enabled
    ).toBe(true);
    expect(
      evaluateFlag({
        flag: f('x', { enabled: false, cohort_slug: 'veterans' }),
        user_id: 'u1',
        user_cohorts: ['veterans'],
      }).enabled
    ).toBe(false);
  });

  test('percentage rollout is stable per user+flag', () => {
    const ev = (uid: string) =>
      evaluateFlag({
        flag: f('rollout.x', { enabled: true, rollout_pct: 50 }),
        user_id: uid,
      });
    const a1 = ev('u1');
    const a2 = ev('u1');
    expect(a1.enabled).toBe(a2.enabled);
    expect(a1.reason).toBe(a2.reason);
  });

  test('djb2Pct deterministic', () => {
    expect(djb2Pct('alpha')).toBe(djb2Pct('alpha'));
    expect(djb2Pct('alpha')).not.toBe(djb2Pct('beta'));
  });

  test('userBucket flag-scoped — same user different flags can fall on different sides of the same %', () => {
    const u = 'u-test';
    const buckets = new Set<number>();
    for (const slug of ['a', 'b', 'c', 'd', 'e', 'f']) buckets.add(userBucket(u, slug));
    expect(buckets.size).toBeGreaterThan(1);
  });
});
