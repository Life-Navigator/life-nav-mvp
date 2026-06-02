/**
 * RateLimiter — Sprint O.0.2 Phase 6.
 *
 * Token-bucket per (scope, owner). The bucket has both an
 * hourly-style refill capacity AND an optional daily cap (e.g. "100
 * chat requests per day"). Both gates are checked on every
 * `consume()` call.
 *
 * Storage: `economic.rate_limit_buckets`. The bucket row is
 * lazy-created with the BETA defaults on first touch.
 *
 * Pure-function helpers (`refillBucket`, `consumeBucket`) are
 * exported for unit tests and for the beta-cost simulator.
 */

import type { RateScope, RateBucket } from './types';
import { BETA_RATE_LIMITS } from './types';

export interface ConsumeInputs {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
  scope: RateScope;
  user_id?: string | null;
  tenant_id?: string | null;
  /** Number of tokens to consume (default 1). */
  cost?: number;
}

export type RateVerdict = 'ALLOW' | 'RATE_LIMITED' | 'DAILY_CAP';

export interface ConsumeResult {
  verdict: RateVerdict;
  tokens_remaining: number;
  daily_remaining: number | null;
  reset_at: string;
  /** Bucket policy applied. */
  capacity: number;
  refill_per_minute: number;
}

export async function consume(inputs: ConsumeInputs): Promise<ConsumeResult> {
  const sb = inputs.supabase;
  const cost = Math.max(1, Math.round(inputs.cost ?? 1));
  const policy = BETA_RATE_LIMITS[inputs.scope];
  if (!policy.enabled_by_default) {
    // Feature is opt-in (enterprise_api by default). Without explicit
    // enablement the bucket has zero capacity; every call is RATE_LIMITED.
    return {
      verdict: 'RATE_LIMITED',
      tokens_remaining: 0,
      daily_remaining: 0,
      reset_at: new Date(Date.now() + 60_000).toISOString(),
      capacity: policy.capacity,
      refill_per_minute: policy.refill_per_minute,
    };
  }

  const bucket = await readOrCreate(
    sb,
    inputs.scope,
    inputs.user_id ?? null,
    inputs.tenant_id ?? null
  );
  const now = Date.now();
  const refilled = refillBucket(bucket, now);
  const consumed = consumeBucket(refilled, cost);

  await persist(sb, consumed);

  // Reset-at: how long before this bucket would next allow `cost`
  // tokens. Equals max(0, cost - tokens_remaining) / refill_per_minute
  // minutes from now.
  const need = Math.max(0, cost - consumed.bucket.tokens_remaining);
  const refill_per_min = Math.max(consumed.bucket.refill_per_minute, 1);
  const reset_at = new Date(now + (need / refill_per_min) * 60_000).toISOString();
  return {
    verdict: consumed.verdict,
    tokens_remaining: consumed.bucket.tokens_remaining,
    daily_remaining:
      consumed.bucket.daily_capacity == null
        ? null
        : consumed.bucket.daily_capacity - consumed.bucket.daily_used,
    reset_at,
    capacity: consumed.bucket.capacity,
    refill_per_minute: consumed.bucket.refill_per_minute,
  };
}

// ---------------------------------------------------------------------------
// Pure helpers (exported for tests + simulator)
// ---------------------------------------------------------------------------

export function refillBucket(bucket: RateBucket, now_ms: number): RateBucket {
  const last = Date.parse(bucket.last_refill_at);
  const elapsed_min = Math.max(0, (now_ms - last) / 60_000);
  const refill = Math.floor(elapsed_min * bucket.refill_per_minute);
  const tokens = Math.min(bucket.capacity, bucket.tokens_remaining + refill);

  // Roll the daily window if necessary.
  const today = new Date(now_ms).toISOString().slice(0, 10);
  let daily_used = bucket.daily_used;
  let daily_window_start = bucket.daily_window_start;
  if (daily_window_start !== today) {
    daily_window_start = today;
    daily_used = 0;
  }

  return {
    ...bucket,
    tokens_remaining: tokens,
    last_refill_at: new Date(now_ms).toISOString(),
    daily_used,
    daily_window_start,
  };
}

export interface ConsumedBucket {
  bucket: RateBucket;
  verdict: RateVerdict;
}

export function consumeBucket(bucket: RateBucket, cost: number): ConsumedBucket {
  // Daily cap first — a global limit even if the bucket has tokens.
  if (bucket.daily_capacity != null && bucket.daily_used + cost > bucket.daily_capacity) {
    return { bucket, verdict: 'DAILY_CAP' };
  }
  if (bucket.tokens_remaining < cost) {
    return { bucket, verdict: 'RATE_LIMITED' };
  }
  return {
    bucket: {
      ...bucket,
      tokens_remaining: bucket.tokens_remaining - cost,
      daily_used: bucket.daily_used + cost,
    },
    verdict: 'ALLOW',
  };
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

async function readOrCreate(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: any,
  scope: RateScope,
  user_id: string | null,
  tenant_id: string | null
): Promise<RateBucket> {
  const policy = BETA_RATE_LIMITS[scope];
  try {
    let q = sb.from('economic_rate_limit_buckets').select('*').eq('scope', scope);
    q = user_id ? q.eq('user_id', user_id) : q.is('user_id', null);
    q = tenant_id ? q.eq('tenant_id', tenant_id) : q.is('tenant_id', null);
    const r = await q.maybeSingle();
    if (r.data) return r.data as RateBucket;
  } catch {
    /* fall through */
  }
  const today = new Date().toISOString().slice(0, 10);
  const fresh: RateBucket = {
    scope,
    user_id,
    tenant_id,
    capacity: policy.capacity,
    refill_per_minute: policy.refill_per_minute,
    tokens_remaining: policy.capacity,
    daily_capacity: policy.daily_capacity ?? null,
    daily_used: 0,
    daily_window_start: today,
    last_refill_at: new Date().toISOString(),
  };
  try {
    await sb.from('economic_rate_limit_buckets').insert(fresh);
  } catch {
    /* concurrent insert ignored */
  }
  return fresh;
}

async function persist(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: any,
  consumed: ConsumedBucket
): Promise<void> {
  const b = consumed.bucket;
  try {
    let q = sb
      .from('economic_rate_limit_buckets')
      .update({
        tokens_remaining: b.tokens_remaining,
        daily_used: b.daily_used,
        daily_window_start: b.daily_window_start,
        last_refill_at: b.last_refill_at,
        updated_at: new Date().toISOString(),
      })
      .eq('scope', b.scope);
    q = b.user_id ? q.eq('user_id', b.user_id) : q.is('user_id', null);
    q = b.tenant_id ? q.eq('tenant_id', b.tenant_id) : q.is('tenant_id', null);
    await q;
  } catch {
    /* persist is best-effort; the next refill will reconcile */
  }
}
