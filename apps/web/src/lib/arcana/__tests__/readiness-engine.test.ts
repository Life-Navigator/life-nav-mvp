/**
 * @jest-environment node
 *
 * Arcana Readiness Engine tests.
 */

import { __test } from '../readiness-engine';
import type {
  ArcanaCapability,
  ArcanaConstraint,
  ArcanaMotivation,
  ArcanaProfile,
} from '@/types/arcana';

const { computeReadiness, recommendTier } = __test;

const baseProfile: ArcanaProfile = {
  id: 'p',
  user_id: 'u',
  intake_source: 'arcana',
  readiness_factors: [],
  provider_lead_consent_given: false,
  metadata: {},
  created_at: '',
  updated_at: '',
};

describe('computeReadiness', () => {
  test('all-zero signals produce a low but non-zero overall score with defaults', () => {
    const r = computeReadiness({ profile: baseProfile, now: '1970-01-01T00:00:00.000Z' });
    expect(r.overall_score).toBeGreaterThan(0);
    expect(r.overall_score).toBeLessThan(0.6);
    expect(r.drivers.length).toBeGreaterThan(0);
  });

  test('high dominant driver + intensity → motivation_score >= 0.7', () => {
    const profile = {
      ...baseProfile,
      performance_score: 0.9,
      dominant_driver: 'performance' as const,
    };
    const motivations: ArcanaMotivation[] = [
      {
        id: 'm',
        user_id: 'u',
        profile_id: 'p',
        motivation_text: 'I want to lift heavier',
        driver: 'performance',
        intensity: 9,
        surfaced_at_depth: 3,
        metadata: {},
        created_at: '',
        updated_at: '',
      },
    ];
    const r = computeReadiness({ profile, motivations, now: '1970-01-01T00:00:00.000Z' });
    expect(r.motivation_score!).toBeGreaterThanOrEqual(0.7);
  });

  test('hard constraints subtract from capacity', () => {
    const cons: ArcanaConstraint[] = Array.from({ length: 3 }).map((_, i) => ({
      id: `c${i}`,
      user_id: 'u',
      profile_id: 'p',
      constraint_kind: 'time',
      description: 'x',
      severity: 'hard',
      is_active: true,
      metadata: {},
      created_at: '',
      updated_at: '',
    }));
    const a = computeReadiness({
      profile: baseProfile,
      free_weekly_hours: 12,
      now: '1970-01-01T00:00:00.000Z',
    });
    const b = computeReadiness({
      profile: baseProfile,
      free_weekly_hours: 12,
      constraints: cons,
      now: '1970-01-01T00:00:00.000Z',
    });
    expect(b.capacity_score!).toBeLessThan(a.capacity_score!);
  });

  test('high score + image driver → concierge tier', () => {
    const profile = {
      ...baseProfile,
      image_score: 1,
      performance_score: 1,
      financial_security_score: 1,
      dominant_driver: 'image' as const,
    };
    const caps: ArcanaCapability[] = [
      {
        id: 'c',
        user_id: 'u',
        profile_id: 'p',
        capability_kind: 'training_experience',
        proficiency: 'expert',
        metadata: {},
        created_at: '',
        updated_at: '',
      },
    ];
    const r = computeReadiness({
      profile,
      capabilities: caps,
      free_weekly_hours: 18,
      available_surplus_usd: 1500,
      historical_adherence: 0.9,
      now: '1970-01-01T00:00:00.000Z',
    });
    expect(r.recommended_membership).toBe('arcana_concierge');
  });

  test('determinism with frozen now', () => {
    const a = computeReadiness({
      profile: baseProfile,
      free_weekly_hours: 4,
      now: '1970-01-01T00:00:00.000Z',
    });
    const b = computeReadiness({
      profile: baseProfile,
      free_weekly_hours: 4,
      now: '1970-01-01T00:00:00.000Z',
    });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  test('recommendTier brackets', () => {
    expect(recommendTier(0.2, 'performance')).toBe('arcana_core');
    expect(recommendTier(0.5, 'performance')).toBe('arcana_performance');
    expect(recommendTier(0.85, 'image')).toBe('arcana_concierge');
    expect(recommendTier(0.85, 'performance')).toBe('arcana_performance');
  });
});
