/**
 * @jest-environment node
 */

import { computeEconomicSnapshot } from '../economic-dashboard-queries';

function makeSupabase(fixture: Record<string, unknown[] | unknown>) {
  return {
    from(table: string) {
      const seed = fixture[table];
      const rows = Array.isArray(seed) ? seed : seed ? [seed] : [];
      const chain = {
        eq() {
          return chain;
        },
        gte() {
          return chain;
        },
        order() {
          return chain;
        },
        limit() {
          return Promise.resolve({ data: rows.slice(0, 1), error: null });
        },
        maybeSingle() {
          return Promise.resolve({ data: rows[0] ?? null, error: null });
        },
        then(onF: (v: { data: unknown; error: null }) => unknown) {
          return Promise.resolve({ data: rows, error: null }).then(onF);
        },
      };
      return { select: () => chain };
    },
  };
}

describe('computeEconomicSnapshot', () => {
  test('empty fixture returns the shape with zeros', async () => {
    const s = await computeEconomicSnapshot(makeSupabase({}));
    expect(s.spend.mtd_usd).toBe(0);
    expect(s.spend.remaining_usd).toBe(500); // default cap
    expect(s.users.active_7d).toBe(0);
    expect(s.features).toEqual([]);
    expect(s.providers).toEqual([]);
    expect(s.budgets.platform_status).toBe('NORMAL');
    expect(s.data_freshness.usage_events).toBeNull();
  });

  test('populated fixture aggregates spend + top users + providers', async () => {
    const now_iso = new Date().toISOString();
    const s = await computeEconomicSnapshot(
      makeSupabase({
        economic_platform_budget: {
          monthly_cap_micros: 500_000_000,
          current_monthly_micros: 100_000_000,
          status: 'INFORMATIONAL',
        },
        economic_usage_events: [
          {
            cost_usd_micros: 50_000,
            user_id: 'u1',
            feature: 'chat',
            provider: 'gemini',
            created_at: now_iso,
          },
          {
            cost_usd_micros: 75_000,
            user_id: 'u2',
            feature: 'chat',
            provider: 'gemini',
            created_at: now_iso,
          },
          {
            cost_usd_micros: 200_000,
            user_id: 'u1',
            feature: 'upload.vision',
            provider: 'openai',
            created_at: now_iso,
          },
        ],
        analytics_user_events: [{ user_id: 'u1' }, { user_id: 'u1' }, { user_id: 'u2' }],
        ingestion_files: [{ size_bytes: 1_000_000, created_at: now_iso }],
        economic_user_budgets: [
          { status: 'ACTIVE' },
          { status: 'WARNING' },
          { status: 'THROTTLED' },
        ],
        economic_circuit_breakers: [{ state: 'CLOSED' }, { state: 'OPEN' }],
      })
    );

    expect(s.spend.mtd_usd).toBe(100);
    expect(s.spend.remaining_usd).toBe(400);
    expect(s.users.active_7d).toBe(2);
    expect(s.users.top_cost_7d[0].user_id).toBe('u1');
    expect(s.features[0].feature).toBe('upload.vision');
    expect(s.providers.find((p) => p.provider === 'gemini')).toBeDefined();
    expect(s.budgets.users_in_warning).toBe(1);
    expect(s.budgets.users_in_throttled).toBe(1);
    expect(s.active_throttles).toBe(1);
    expect(s.active_blocks).toBe(1); // 1 OPEN breaker
  });
});
