/**
 * @jest-environment node
 */

import { evaluate, recordOutcome, forceOpen, reset } from '../circuit-breaker';
import type { BreakerRow } from '../circuit-breaker';

function makeSupabase(seed: BreakerRow | null) {
  let state: BreakerRow | null = seed ? { ...seed } : null;
  return {
    state: () => state,
    client: {
      from() {
        const chain = {
          eq() {
            return chain;
          },
          maybeSingle() {
            return Promise.resolve({ data: state, error: null });
          },
        };
        return {
          select: () => chain,
          insert: (row: Partial<BreakerRow>) => {
            if (!state)
              state = {
                feature: row.feature ?? 'x',
                state: 'CLOSED',
                trigger_reason: null,
                failure_count: 0,
                failure_threshold: 5,
                opened_at: null,
                retry_at: null,
                open_action: row.open_action ?? 'degrade',
                operator_override: false,
              };
            return Promise.resolve({ data: null, error: null });
          },
          update: (patch: Partial<BreakerRow>) => {
            if (state) state = { ...state, ...patch };
            return { eq: () => Promise.resolve({ data: null, error: null }) };
          },
        };
      },
    },
  };
}

const CLOSED: BreakerRow = {
  feature: 'provider.gemini',
  state: 'CLOSED',
  trigger_reason: null,
  failure_count: 0,
  failure_threshold: 5,
  opened_at: null,
  retry_at: null,
  open_action: 'DEGRADE',
  operator_override: false,
};

describe('CircuitBreaker — evaluate', () => {
  test('CLOSED → PASS', async () => {
    const m = makeSupabase(CLOSED);
    const r = await evaluate({ supabase: m.client, feature: 'provider.gemini' });
    expect(r.verdict).toBe('PASS');
    expect(r.state).toBe('CLOSED');
  });

  test('no row → PASS (lazy creation handled elsewhere)', async () => {
    const m = makeSupabase(null);
    const r = await evaluate({ supabase: m.client, feature: 'unknown.feature' });
    expect(r.verdict).toBe('PASS');
  });

  test('OPEN without elapsed retry_at → DEGRADE for provider features', async () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    const m = makeSupabase({ ...CLOSED, state: 'OPEN', retry_at: future, trigger_reason: 'r' });
    const r = await evaluate({ supabase: m.client, feature: 'provider.gemini' });
    expect(r.verdict).toBe('DEGRADE');
    expect(r.state).toBe('OPEN');
  });

  test('OPEN past retry_at → transitions to HALF_OPEN + PASS', async () => {
    const past = new Date(Date.now() - 1).toISOString();
    const m = makeSupabase({ ...CLOSED, state: 'OPEN', retry_at: past });
    const r = await evaluate({ supabase: m.client, feature: 'provider.gemini' });
    expect(r.verdict).toBe('PASS');
    expect(r.state).toBe('HALF_OPEN');
  });

  test('upload.vision OPEN → DISABLED', async () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    const m = makeSupabase({
      ...CLOSED,
      feature: 'upload.vision',
      state: 'OPEN',
      retry_at: future,
    });
    const r = await evaluate({ supabase: m.client, feature: 'upload.vision' });
    expect(r.verdict).toBe('DISABLED');
  });

  test('governance_review OPEN → PASS (never break governance)', async () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    const m = makeSupabase({
      ...CLOSED,
      feature: 'governance_review',
      state: 'OPEN',
      retry_at: future,
    });
    const r = await evaluate({ supabase: m.client, feature: 'governance_review' });
    expect(r.verdict).toBe('PASS');
  });
});

describe('CircuitBreaker — recordOutcome', () => {
  test('4 failures stays CLOSED', async () => {
    const m = makeSupabase(CLOSED);
    for (let i = 0; i < 4; i++) {
      await recordOutcome({ supabase: m.client, feature: 'provider.gemini', outcome: 'failure' });
    }
    expect(m.state()!.state).toBe('CLOSED');
    expect(m.state()!.failure_count).toBe(4);
  });

  test('5th failure opens the breaker', async () => {
    const m = makeSupabase(CLOSED);
    for (let i = 0; i < 5; i++) {
      await recordOutcome({ supabase: m.client, feature: 'provider.gemini', outcome: 'failure' });
    }
    expect(m.state()!.state).toBe('OPEN');
    expect(m.state()!.opened_at).toBeTruthy();
    expect(m.state()!.retry_at).toBeTruthy();
  });

  test('success in HALF_OPEN closes the breaker', async () => {
    const m = makeSupabase({ ...CLOSED, state: 'HALF_OPEN', failure_count: 5 });
    await recordOutcome({ supabase: m.client, feature: 'provider.gemini', outcome: 'success' });
    expect(m.state()!.state).toBe('CLOSED');
    expect(m.state()!.failure_count).toBe(0);
  });

  test('success in CLOSED with prior failure count resets count', async () => {
    const m = makeSupabase({ ...CLOSED, failure_count: 3 });
    await recordOutcome({ supabase: m.client, feature: 'provider.gemini', outcome: 'success' });
    expect(m.state()!.failure_count).toBe(0);
  });
});

describe('CircuitBreaker — forceOpen + reset', () => {
  test('forceOpen flips state immediately', async () => {
    const m = makeSupabase(CLOSED);
    await forceOpen(m.client, 'provider.gemini', 'platform_budget_emergency', 'DISABLED');
    expect(m.state()!.state).toBe('OPEN');
    expect(m.state()!.trigger_reason).toBe('platform_budget_emergency');
  });

  test('reset returns to CLOSED', async () => {
    const m = makeSupabase({
      ...CLOSED,
      state: 'OPEN',
      failure_count: 5,
      opened_at: new Date().toISOString(),
      retry_at: new Date().toISOString(),
    });
    await reset(m.client, 'provider.gemini');
    expect(m.state()!.state).toBe('CLOSED');
    expect(m.state()!.failure_count).toBe(0);
    expect(m.state()!.opened_at).toBeNull();
  });
});
