/**
 * @jest-environment node
 */

import { __test } from '../usage-meter';
import { recordUsage } from '../usage-meter';
import { MICROS_PER_USD } from '../types';

const { applyWindows, nextUserStatus, nextPlatformStatus } = __test;

// Explicit literal caps so the percentage-threshold assertions below test the
// status LOGIC, not the business default (which changed to $4/$20/$80). The
// numbers here intentionally stay 1M/5M/20M so the 70/80/95/100% inputs are
// easy to read.
const SAMPLE_ROW = {
  daily_budget_micros: 1_000_000,
  weekly_budget_micros: 5_000_000,
  monthly_budget_micros: 20_000_000,
  current_daily_micros: 0,
  current_weekly_micros: 0,
  current_monthly_micros: 0,
  daily_window_start: '2099-01-01', // stale
  weekly_window_start: '2099-01-01',
  monthly_window_start: '2099-01-01',
  operator_override: false,
};

describe('applyWindows', () => {
  test('rolls stale windows then adds cost', () => {
    const next = applyWindows({ ...SAMPLE_ROW, current_daily_micros: 999 }, 250_000);
    expect(next.daily_window_start).not.toBe('2099-01-01');
    expect(next.current_daily_micros).toBe(250_000);
    expect(next.current_weekly_micros).toBe(250_000);
    expect(next.current_monthly_micros).toBe(250_000);
  });

  test('does not roll fresh windows', () => {
    const today = __test.todayUtc();
    const next = applyWindows(
      { ...SAMPLE_ROW, daily_window_start: today, current_daily_micros: 100 },
      50
    );
    expect(next.current_daily_micros).toBe(150);
  });
});

describe('nextUserStatus', () => {
  test('ACTIVE under 75%', () => {
    const r = nextUserStatus({ ...SAMPLE_ROW, current_daily_micros: 700_000 });
    expect(r).toBe('ACTIVE'); // 70%
  });
  test('WARNING at 75–89%', () => {
    const r = nextUserStatus({ ...SAMPLE_ROW, current_daily_micros: 800_000 });
    expect(r).toBe('WARNING'); // 80%
  });
  test('THROTTLED at 90–99%', () => {
    const r = nextUserStatus({ ...SAMPLE_ROW, current_daily_micros: 950_000 });
    expect(r).toBe('THROTTLED'); // 95%
  });
  test('BLOCKED at 100%+', () => {
    const r = nextUserStatus({ ...SAMPLE_ROW, current_daily_micros: 1_500_000 });
    expect(r).toBe('BLOCKED');
  });
  test('operator override keeps WARNING even at BLOCKED level', () => {
    const r = nextUserStatus({
      ...SAMPLE_ROW,
      current_daily_micros: 5_000_000,
      operator_override: true,
    });
    expect(r).toBe('WARNING');
  });
  test('uses MAX of daily/weekly/monthly fractions', () => {
    const r = nextUserStatus({
      ...SAMPLE_ROW,
      current_daily_micros: 200_000, // 20% daily
      current_weekly_micros: 4_500_000, // 90% weekly
      current_monthly_micros: 1_000_000, // 5% monthly
    });
    expect(r).toBe('THROTTLED');
  });
});

describe('nextPlatformStatus', () => {
  const CAP = 500 * MICROS_PER_USD;
  test('NORMAL under 50%', () => {
    expect(nextPlatformStatus(CAP, 100 * MICROS_PER_USD, false)).toBe('NORMAL');
  });
  test('INFORMATIONAL at 50%', () => {
    expect(nextPlatformStatus(CAP, 250 * MICROS_PER_USD, false)).toBe('INFORMATIONAL');
  });
  test('ALERT at 75%', () => {
    expect(nextPlatformStatus(CAP, 375 * MICROS_PER_USD, false)).toBe('ALERT');
  });
  test('HIGH_ALERT at 90%', () => {
    expect(nextPlatformStatus(CAP, 450 * MICROS_PER_USD, false)).toBe('HIGH_ALERT');
  });
  test('EMERGENCY at 95%', () => {
    expect(nextPlatformStatus(CAP, 475 * MICROS_PER_USD, false)).toBe('EMERGENCY');
  });
  test('HARD_STOP at 100%', () => {
    expect(nextPlatformStatus(CAP, 500 * MICROS_PER_USD, false)).toBe('HARD_STOP');
  });
  test('operator override stays EMERGENCY at 100%', () => {
    expect(nextPlatformStatus(CAP, 500 * MICROS_PER_USD, true)).toBe('EMERGENCY');
  });
  test('zero cap returns NORMAL', () => {
    expect(nextPlatformStatus(0, 1_000_000, false)).toBe('NORMAL');
  });
});

// ---------------------------------------------------------------------------
// recordUsage end-to-end (capture mock)
// ---------------------------------------------------------------------------

interface Op {
  table: string;
  op: 'insert' | 'update' | 'select';
  payload?: unknown;
}

function captureSupabase(seed: Record<string, unknown[]> = {}) {
  const ops: Op[] = [];
  let counter = 0;
  const client = {
    from(table: string) {
      const rows = seed[table] ?? [];
      return {
        insert(payload: unknown) {
          counter += 1;
          ops.push({ table, op: 'insert', payload });
          return {
            select: () => ({
              single: () => Promise.resolve({ data: { id: `${table}_${counter}` }, error: null }),
            }),
          };
        },
        update(payload: unknown) {
          ops.push({ table, op: 'update', payload });
          return { eq: () => Promise.resolve({ data: null, error: null }) };
        },
        select(_cols: string) {
          ops.push({ table, op: 'select' });
          const chain = {
            eq() {
              return chain;
            },
            maybeSingle() {
              return Promise.resolve({ data: rows[0] ?? null, error: null });
            },
            single() {
              return Promise.resolve({ data: rows[0] ?? null, error: null });
            },
          };
          return chain;
        },
      };
    },
  };
  return { ops, client };
}

describe('recordUsage', () => {
  test('writes usage_events + updates user + platform budgets', async () => {
    const today = __test.todayUtc();
    const { ops, client } = captureSupabase({
      economic_user_budgets: [
        {
          user_id: 'u1',
          ...SAMPLE_ROW,
          daily_window_start: today,
          weekly_window_start: __test.weekStartUtc(),
          monthly_window_start: __test.monthStartUtc(),
          status: 'ACTIVE',
        },
      ],
      economic_platform_budget: [
        {
          monthly_cap_micros: 500_000_000,
          current_monthly_micros: 0,
          monthly_window_start: __test.monthStartUtc(),
          status: 'NORMAL',
          operator_override: false,
        },
      ],
    });
    const r = await recordUsage({
      supabase: client,
      user_id: 'u1',
      feature: 'chat',
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      cost_dimension: 'text_input',
      units: 1000,
      cost_usd_micros: 75,
    });
    expect(r.ok).toBe(true);
    expect(ops.find((o) => o.table === 'economic_usage_events' && o.op === 'insert')).toBeDefined();
    expect(ops.find((o) => o.table === 'economic_user_budgets' && o.op === 'update')).toBeDefined();
    expect(
      ops.find((o) => o.table === 'economic_platform_budget' && o.op === 'update')
    ).toBeDefined();
  });

  test('large cost flips user status to BLOCKED', async () => {
    const today = __test.todayUtc();
    const { ops, client } = captureSupabase({
      economic_user_budgets: [
        {
          user_id: 'u_block',
          ...SAMPLE_ROW,
          daily_window_start: today,
          weekly_window_start: __test.weekStartUtc(),
          monthly_window_start: __test.monthStartUtc(),
          current_daily_micros: 990_000, // just under cap
        },
      ],
      economic_platform_budget: [
        {
          monthly_cap_micros: 500_000_000,
          current_monthly_micros: 0,
          monthly_window_start: __test.monthStartUtc(),
          status: 'NORMAL',
          operator_override: false,
        },
      ],
    });
    const r = await recordUsage({
      supabase: client,
      user_id: 'u_block',
      feature: 'chat',
      cost_dimension: 'text_input',
      units: 1000,
      cost_usd_micros: 100_000, // pushes well over the cap
    });
    expect(r.user_status).toBe('BLOCKED');
    const upd = ops.find((o) => o.table === 'economic_user_budgets' && o.op === 'update');
    expect(upd).toBeDefined();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((upd!.payload as any).status).toBe('BLOCKED');
  });
});
