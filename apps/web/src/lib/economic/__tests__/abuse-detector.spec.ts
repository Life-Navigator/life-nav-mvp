/**
 * @jest-environment node
 */

import { scoreAbuse, ABUSE_THRESHOLDS } from '../abuse-detector';
import type { AbuseSignal } from '../abuse-detector';

const QUIET: AbuseSignal = {
  chat_messages_1h: 0,
  uploads_1h: 0,
  uploads_24h: 0,
  cost_1h_micros: 0,
  cost_24h_micros: 0,
  distinct_requests_1h: 0,
  retries_5m: 0,
  tokens_1h: 0,
  bot_score: 0,
};

describe('scoreAbuse — quiet user', () => {
  test('produces no findings', () => {
    expect(scoreAbuse(QUIET)).toEqual([]);
  });
});

describe('scoreAbuse — prompt flooding', () => {
  test('fires at threshold', () => {
    const r = scoreAbuse({
      ...QUIET,
      chat_messages_1h: ABUSE_THRESHOLDS.prompt_flooding.messages_1h,
    });
    expect(r.find((f) => f.kind === 'prompt_flooding')).toBeDefined();
  });
  test('does not fire just below threshold', () => {
    const r = scoreAbuse({
      ...QUIET,
      chat_messages_1h: ABUSE_THRESHOLDS.prompt_flooding.messages_1h - 1,
    });
    expect(r.find((f) => f.kind === 'prompt_flooding')).toBeUndefined();
  });
  test('action is THROTTLE', () => {
    const r = scoreAbuse({ ...QUIET, chat_messages_1h: 60 });
    expect(r[0].action).toBe('THROTTLE');
  });
});

describe('scoreAbuse — upload flooding', () => {
  test('20 uploads/hr fires', () => {
    const r = scoreAbuse({ ...QUIET, uploads_1h: 20 });
    expect(r.find((f) => f.kind === 'upload_flooding')).toBeDefined();
  });
});

describe('scoreAbuse — cost farming', () => {
  test('$1/hour fires BLOCK', () => {
    const r = scoreAbuse({ ...QUIET, cost_1h_micros: 1_000_000 });
    const f = r.find((x) => x.kind === 'cost_farming');
    expect(f).toBeDefined();
    expect(f!.action).toBe('BLOCK');
  });
});

describe('scoreAbuse — automation', () => {
  test('high distinct-request count fires REVIEW', () => {
    const r = scoreAbuse({ ...QUIET, distinct_requests_1h: 120 });
    const f = r.find((x) => x.kind === 'automation');
    expect(f).toBeDefined();
    expect(f!.action).toBe('REVIEW');
  });
  test('high bot score fires REVIEW', () => {
    const r = scoreAbuse({ ...QUIET, bot_score: 0.9 });
    expect(r.find((x) => x.kind === 'automation')).toBeDefined();
  });
});

describe('scoreAbuse — retry abuse', () => {
  test('10 retries in 5 min fires WARN', () => {
    const r = scoreAbuse({ ...QUIET, retries_5m: 10 });
    const f = r.find((x) => x.kind === 'retry_abuse');
    expect(f).toBeDefined();
    expect(f!.action).toBe('WARN');
  });
});

describe('scoreAbuse — token burn', () => {
  test('500k tokens/hr fires THROTTLE', () => {
    const r = scoreAbuse({ ...QUIET, tokens_1h: 500_000 });
    const f = r.find((x) => x.kind === 'token_burn');
    expect(f).toBeDefined();
    expect(f!.action).toBe('THROTTLE');
  });
});

describe('scoreAbuse — api_abuse', () => {
  test('$10/day fires CRITICAL BLOCK', () => {
    const r = scoreAbuse({ ...QUIET, cost_24h_micros: 10_000_000 });
    const f = r.find((x) => x.kind === 'api_abuse');
    expect(f).toBeDefined();
    expect(f!.severity).toBe('CRITICAL');
    expect(f!.action).toBe('BLOCK');
  });
});

describe('scoreAbuse — composite signals', () => {
  test('a user violating multiple thresholds produces multiple findings', () => {
    const r = scoreAbuse({
      ...QUIET,
      chat_messages_1h: 80,
      uploads_1h: 22,
      cost_1h_micros: 2_000_000,
    });
    expect(r.length).toBeGreaterThanOrEqual(3);
    expect(r.map((f) => f.kind).sort()).toEqual([
      'cost_farming',
      'prompt_flooding',
      'upload_flooding',
    ]);
  });
});
