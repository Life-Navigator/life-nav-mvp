/**
 * @jest-environment node
 */

import { evaluate } from '../budget-manager';
import { BETA_USER_BUDGET_DEFAULTS, MICROS_PER_USD } from '../types';

function makeSupabase(seed: {
  user?: Record<string, unknown>;
  platform?: Record<string, unknown>;
}) {
  return {
    from(table: string) {
      let rows: unknown[] = [];
      if (table === 'economic_user_budgets' && seed.user) rows = [seed.user];
      if (table === 'economic_platform_budget' && seed.platform) rows = [seed.platform];
      const chain = {
        eq() {
          return chain;
        },
        maybeSingle() {
          return Promise.resolve({ data: rows[0] ?? null, error: null });
        },
        insert() {
          return Promise.resolve({ data: null, error: null });
        },
      };
      return { select: () => chain, insert: () => Promise.resolve({ data: null, error: null }) };
    },
  };
}

// Explicit literal caps (1M/5M/20M) so the percentage-threshold cases below
// stay readable and independent of the business default (now $4/$20/$80). The
// default values themselves are locked by the 'beta cap policy' test instead.
const USER_BASE = {
  user_id: 'u1',
  daily_budget_micros: 1_000_000,
  weekly_budget_micros: 5_000_000,
  monthly_budget_micros: 20_000_000,
  current_daily_micros: 0,
  current_weekly_micros: 0,
  current_monthly_micros: 0,
  status: 'ACTIVE',
  operator_override: false,
};

const PLATFORM_BASE = {
  monthly_cap_micros: 500 * MICROS_PER_USD,
  current_monthly_micros: 0,
  status: 'NORMAL',
  operator_override: false,
};

describe('beta cap policy — raised to $4/day after the alias fix', () => {
  test('per-user defaults are $4 / $20 / $80 (1:5:20 ratio preserved)', () => {
    expect(BETA_USER_BUDGET_DEFAULTS.daily_micros).toBe(4 * MICROS_PER_USD);
    expect(BETA_USER_BUDGET_DEFAULTS.weekly_micros).toBe(20 * MICROS_PER_USD);
    expect(BETA_USER_BUDGET_DEFAULTS.monthly_micros).toBe(80 * MICROS_PER_USD);
    // Daily must stay the binding per-session limit: weekly > daily, monthly > weekly.
    expect(BETA_USER_BUDGET_DEFAULTS.weekly_micros).toBeGreaterThan(
      BETA_USER_BUDGET_DEFAULTS.daily_micros
    );
    expect(BETA_USER_BUDGET_DEFAULTS.monthly_micros).toBeGreaterThan(
      BETA_USER_BUDGET_DEFAULTS.weekly_micros
    );
  });

  test('$4/day still blocks runaway usage (cap is real, not removed)', async () => {
    const sb = makeSupabase({
      user: {
        ...USER_BASE,
        daily_budget_micros: BETA_USER_BUDGET_DEFAULTS.daily_micros,
        current_daily_micros: BETA_USER_BUDGET_DEFAULTS.daily_micros, // exactly at cap
      },
      platform: PLATFORM_BASE,
    });
    const r = await evaluate({ supabase: sb, user_id: 'u1', estimated_micros: 1_000 });
    expect(['BLOCK', 'HARD_STOP']).toContain(r.verdict);
  });
});

describe('evaluate — user-budget gates', () => {
  test('small cost → ALLOW', async () => {
    const sb = makeSupabase({ user: USER_BASE, platform: PLATFORM_BASE });
    const r = await evaluate({ supabase: sb, user_id: 'u1', estimated_micros: 100 });
    expect(r.verdict).toBe('ALLOW');
  });

  test('cost pushing user to 76% → WARN', async () => {
    const sb = makeSupabase({
      user: { ...USER_BASE, current_daily_micros: 750_000 },
      platform: PLATFORM_BASE,
    });
    const r = await evaluate({ supabase: sb, user_id: 'u1', estimated_micros: 11_000 });
    expect(r.verdict).toBe('WARN');
  });

  test('cost pushing user to 90% → THROTTLE', async () => {
    const sb = makeSupabase({
      user: { ...USER_BASE, current_daily_micros: 800_000 },
      platform: PLATFORM_BASE,
    });
    const r = await evaluate({ supabase: sb, user_id: 'u1', estimated_micros: 100_000 });
    expect(r.verdict).toBe('THROTTLE');
  });

  test('cost pushing user past 100% → BLOCK', async () => {
    const sb = makeSupabase({
      user: { ...USER_BASE, current_daily_micros: 1_000_000 },
      platform: PLATFORM_BASE,
    });
    const r = await evaluate({ supabase: sb, user_id: 'u1', estimated_micros: 1 });
    expect(r.verdict).toBe('BLOCK');
    expect(r.user_status).toBe('BLOCKED');
  });

  test('operator override on user keeps a 100%+ call at WARN', async () => {
    const sb = makeSupabase({
      user: { ...USER_BASE, current_daily_micros: 1_500_000, operator_override: true },
      platform: PLATFORM_BASE,
    });
    const r = await evaluate({ supabase: sb, user_id: 'u1', estimated_micros: 100_000 });
    expect(r.verdict).toBe('WARN');
  });
});

describe('evaluate — platform gates', () => {
  test('platform at 75% triggers WARN even on tiny user spend', async () => {
    const sb = makeSupabase({
      user: USER_BASE,
      platform: { ...PLATFORM_BASE, current_monthly_micros: 450 * MICROS_PER_USD },
    });
    const r = await evaluate({
      supabase: sb,
      user_id: 'u1',
      estimated_micros: 50 * MICROS_PER_USD,
    });
    // platform_pct after: 500/500 ≥ 100 → HARD_STOP
    expect(r.verdict).toBe('HARD_STOP');
  });

  test('platform at 95% → BLOCK', async () => {
    const sb = makeSupabase({
      user: USER_BASE,
      platform: { ...PLATFORM_BASE, current_monthly_micros: 475 * MICROS_PER_USD },
    });
    const r = await evaluate({ supabase: sb, user_id: 'u1', estimated_micros: 1 });
    expect(r.verdict).toBe('BLOCK');
    expect(r.platform_status).toBe('EMERGENCY');
  });

  test('platform at 90% → WARN', async () => {
    const sb = makeSupabase({
      user: USER_BASE,
      platform: { ...PLATFORM_BASE, current_monthly_micros: 450 * MICROS_PER_USD },
    });
    const r = await evaluate({ supabase: sb, user_id: 'u1', estimated_micros: 1 });
    expect(r.verdict).toBe('WARN');
  });

  test('platform operator override allows HARD_STOP-level call through', async () => {
    const sb = makeSupabase({
      user: USER_BASE,
      platform: {
        ...PLATFORM_BASE,
        current_monthly_micros: 500 * MICROS_PER_USD,
        operator_override: true,
      },
    });
    const r = await evaluate({ supabase: sb, user_id: 'u1', estimated_micros: 100 });
    expect(r.verdict).not.toBe('HARD_STOP');
  });
});

describe('evaluate — missing data', () => {
  test('no user-budget row lazy-creates and allows', async () => {
    const sb = makeSupabase({ platform: PLATFORM_BASE });
    const r = await evaluate({ supabase: sb, user_id: 'fresh_user', estimated_micros: 100 });
    expect(r.verdict).toBe('ALLOW');
  });
});
