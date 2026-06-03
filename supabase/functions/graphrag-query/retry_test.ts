// Tests for the Gemini transient-retry helper.
// Run with: deno test supabase/functions/graphrag-query/retry_test.ts
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { geminiFetch } from './retry.ts';

// Sequenced mock fetch — returns the next status each call, counts calls.
function mockFetch(statuses: number[]) {
  let i = 0;
  const calls = { count: 0 };
  const fn = ((_url: string | URL, _init?: RequestInit) => {
    calls.count++;
    const s = statuses[Math.min(i, statuses.length - 1)];
    i++;
    return Promise.resolve(new Response(s === 200 ? '{"ok":true}' : null, { status: s }));
  }) as unknown as typeof fetch;
  return { fn, calls };
}

// Deterministic + instant: no real backoff, zero jitter.
const fast = { backoffMs: [1, 1], sleep: () => Promise.resolve(), rand: () => 0 };

Deno.test('503 then 200 — succeeds after one retry', async () => {
  const { fn, calls } = mockFetch([503, 200]);
  const resp = await geminiFetch('http://x', {}, 'test', { ...fast, fetchImpl: fn });
  assertEquals(resp.status, 200);
  assertEquals(calls.count, 2); // initial + 1 retry
});

Deno.test('429 then 200 — succeeds after one retry', async () => {
  const { fn, calls } = mockFetch([429, 200]);
  const resp = await geminiFetch('http://x', {}, 'test', { ...fast, fetchImpl: fn });
  assertEquals(resp.status, 200);
  assertEquals(calls.count, 2);
});

Deno.test('500 then 200 — succeeds after one retry', async () => {
  const { fn, calls } = mockFetch([500, 200]);
  const resp = await geminiFetch('http://x', {}, 'test', { ...fast, fetchImpl: fn });
  assertEquals(resp.status, 200);
  assertEquals(calls.count, 2);
});

Deno.test('auth error (401) — NOT retried', async () => {
  const { fn, calls } = mockFetch([401, 200]);
  const resp = await geminiFetch('http://x', {}, 'test', { ...fast, fetchImpl: fn });
  assertEquals(resp.status, 401);
  assertEquals(calls.count, 1); // no retry
});

Deno.test('validation error (400) — NOT retried', async () => {
  const { fn, calls } = mockFetch([400, 200]);
  const resp = await geminiFetch('http://x', {}, 'test', { ...fast, fetchImpl: fn });
  assertEquals(resp.status, 400);
  assertEquals(calls.count, 1);
});

Deno.test('persistent 503 — exhausts max retries, returns last response', async () => {
  const { fn, calls } = mockFetch([503, 503, 503, 503]);
  const resp = await geminiFetch('http://x', {}, 'test', { ...fast, fetchImpl: fn });
  assertEquals(resp.status, 503); // caller treats as error
  assertEquals(calls.count, 3); // initial + 2 retries (max)
});
