/**
 * @jest-environment node
 */

import { computeDashboardSnapshot } from '../dashboard-queries';

function makeSupabase(seed: Record<string, unknown>) {
  return {
    from(table: string) {
      const recs = seed[table] ?? [];
      return {
        select(_cols: string, opts?: { count?: string; head?: boolean }) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const data = Array.isArray(recs) ? recs : (recs as any);
          const builder = {
            gte() {
              return builder;
            },
            eq() {
              return builder;
            },
            in() {
              return builder;
            },
            maybeSingle: () => Promise.resolve({ data: null, error: null }),
            then: undefined as undefined,
          };
          if (opts?.count === 'exact' && opts?.head) {
            // Resolve immediately with count.
            return Promise.resolve({
              count: Array.isArray(data) ? data.length : 0,
              data: null,
              error: null,
            });
          }
          // Return a chainable that resolves to data when awaited.
          const chain = {
            gte: () => chain,
            eq: () => chain,
            in: () => chain,
            then(onFulfilled: (v: { data: unknown; error: null }) => unknown) {
              return Promise.resolve({ data, error: null }).then(onFulfilled);
            },
          };
          return chain;
        },
      };
    },
  };
}

describe('computeDashboardSnapshot', () => {
  test('returns zero snapshot when no data', async () => {
    const sb = makeSupabase({});
    const s = await computeDashboardSnapshot(sb, 7);
    expect(s.window_days).toBe(7);
    expect(s.user_activity.dau).toBe(0);
    expect(s.recommendations.generated).toBe(0);
    expect(s.cost.per_dau_usd).toBe(0);
  });

  test('aggregates user activity from analytics_user_events', async () => {
    const sb = makeSupabase({
      analytics_user_events: [
        { user_id: 'u1' },
        { user_id: 'u1' },
        { user_id: 'u2' },
        { user_id: 'u3' },
      ],
    });
    const s = await computeDashboardSnapshot(sb, 7);
    expect(s.user_activity.dau).toBe(3);
    expect(s.user_activity.wau).toBe(3);
  });

  test('aggregates cost by provider', async () => {
    const sb = makeSupabase({
      analytics_user_events: [{ user_id: 'u1' }, { user_id: 'u2' }],
      ops_llm_usage_meter: [
        { provider: 'gemini', cost_usd_micros: 1_000_000 }, // $1.00
        { provider: 'gemini', cost_usd_micros: 500_000 }, // $0.50
        { provider: 'openai', cost_usd_micros: 250_000 }, // $0.25
        { provider: 'anthropic', cost_usd_micros: 100_000 }, // $0.10
        { provider: 'local', cost_usd_micros: 50_000 }, // $0.05 → "other"
      ],
    });
    const s = await computeDashboardSnapshot(sb, 7);
    expect(s.cost.gemini_usd).toBe(1.5);
    expect(s.cost.openai_usd).toBe(0.25);
    expect(s.cost.anthropic_usd).toBe(0.1);
    expect(s.cost.other_usd).toBe(0.05);
    expect(s.cost.per_dau_usd).toBeCloseTo((1.5 + 0.25 + 0.1 + 0.05) / 2, 4);
  });
});
