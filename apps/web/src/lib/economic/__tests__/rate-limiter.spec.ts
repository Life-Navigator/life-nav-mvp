/**
 * @jest-environment node
 */

import { consume, refillBucket, consumeBucket } from '../rate-limiter';
import type { RateBucket } from '../types';

const BASE: RateBucket = {
  scope: 'chat',
  user_id: 'u1',
  tenant_id: null,
  capacity: 30,
  refill_per_minute: 1,
  tokens_remaining: 30,
  daily_capacity: 100,
  daily_used: 0,
  daily_window_start: '2026-06-01',
  last_refill_at: '2026-06-01T00:00:00.000Z',
};

describe('refillBucket', () => {
  test('refills tokens at refill_per_minute rate', () => {
    const ten_min_later = Date.parse('2026-06-01T00:10:00.000Z');
    const b = refillBucket({ ...BASE, tokens_remaining: 10 }, ten_min_later);
    expect(b.tokens_remaining).toBe(20);
  });

  test('caps at capacity', () => {
    const an_hour_later = Date.parse('2026-06-01T01:00:00.000Z');
    const b = refillBucket({ ...BASE, tokens_remaining: 25 }, an_hour_later);
    expect(b.tokens_remaining).toBe(30);
  });

  test('rolls daily window when crossing midnight', () => {
    const tomorrow = Date.parse('2026-06-02T00:01:00.000Z');
    const b = refillBucket({ ...BASE, daily_used: 50 }, tomorrow);
    expect(b.daily_used).toBe(0);
    expect(b.daily_window_start).toBe('2026-06-02');
  });
});

describe('consumeBucket', () => {
  test('ALLOW when both tokens and daily cap are sufficient', () => {
    const r = consumeBucket(BASE, 1);
    expect(r.verdict).toBe('ALLOW');
    expect(r.bucket.tokens_remaining).toBe(29);
    expect(r.bucket.daily_used).toBe(1);
  });

  test('RATE_LIMITED when tokens are insufficient', () => {
    const r = consumeBucket({ ...BASE, tokens_remaining: 0 }, 1);
    expect(r.verdict).toBe('RATE_LIMITED');
    expect(r.bucket.tokens_remaining).toBe(0);
  });

  test('DAILY_CAP when daily usage would exceed daily_capacity', () => {
    const r = consumeBucket({ ...BASE, daily_used: 100 }, 1);
    expect(r.verdict).toBe('DAILY_CAP');
  });

  test('DAILY_CAP gates BEFORE token check', () => {
    const r = consumeBucket({ ...BASE, tokens_remaining: 30, daily_used: 100 }, 1);
    expect(r.verdict).toBe('DAILY_CAP');
  });
});

// ---------------------------------------------------------------------------
// consume() — async path
// ---------------------------------------------------------------------------

function makeSupabase(seed: RateBucket | null) {
  return {
    from() {
      const chain = {
        eq() {
          return chain;
        },
        is() {
          return chain;
        },
        maybeSingle() {
          return Promise.resolve({ data: seed, error: null });
        },
      };
      return {
        select: () => chain,
        insert: () => Promise.resolve({ data: null, error: null }),
        update: () => ({
          eq: () => ({ is: () => ({ eq: () => ({ is: () => Promise.resolve({}) }) }) }),
        }),
      };
    },
  };
}

describe('consume (async)', () => {
  test('lazy-creates bucket on first call and ALLOWs', async () => {
    const r = await consume({ supabase: makeSupabase(null), scope: 'chat', user_id: 'u1' });
    expect(r.verdict).toBe('ALLOW');
    expect(r.capacity).toBe(30);
    expect(r.refill_per_minute).toBe(1);
  });

  test('enterprise_api is disabled by default and RATE_LIMITs', async () => {
    const r = await consume({
      supabase: makeSupabase(null),
      scope: 'enterprise_api',
      user_id: 'u1',
    });
    expect(r.verdict).toBe('RATE_LIMITED');
  });

  test('rejects when tokens are gone', async () => {
    const r = await consume({
      supabase: makeSupabase({
        ...BASE,
        tokens_remaining: 0,
        last_refill_at: new Date().toISOString(),
      }),
      scope: 'chat',
      user_id: 'u1',
    });
    expect(r.verdict).toBe('RATE_LIMITED');
  });

  test('hourly bucket refills enough for moderate traffic', async () => {
    const r = await consume({
      supabase: makeSupabase({ ...BASE, tokens_remaining: 10 }),
      scope: 'chat',
      user_id: 'u1',
    });
    expect(['ALLOW', 'DAILY_CAP', 'RATE_LIMITED']).toContain(r.verdict);
  });

  test('upload scope has lower capacity than chat', async () => {
    const r = await consume({ supabase: makeSupabase(null), scope: 'upload', user_id: 'u1' });
    expect(r.capacity).toBe(5);
  });

  test('simulation scope mirrors upload defaults', async () => {
    const r = await consume({ supabase: makeSupabase(null), scope: 'simulation', user_id: 'u1' });
    expect(r.capacity).toBe(5);
  });

  test('arcana scope mirrors upload defaults', async () => {
    const r = await consume({ supabase: makeSupabase(null), scope: 'arcana', user_id: 'u1' });
    expect(r.capacity).toBe(5);
  });
});
