/**
 * Tenant API gateway — Sprint P Phase 2.
 *
 * Single entry point every `/api/platform/**` route calls:
 *
 *   const ctx = await resolveApiKey(supabase, request);
 *   if (!ctx.ok) return ctx.response;
 *   const u = await meterUsage(supabase, ctx, { route, status, latency_ms, ... });
 *
 * resolveApiKey():
 *   1. Reads `Authorization: Bearer lnk_*` (or `x-api-key`) from
 *      the request headers.
 *   2. Looks up by `prefix` + verifies sha256(key) === key_hash.
 *   3. Confirms status='active' AND (expires_at IS NULL OR > NOW()).
 *   4. Returns the tenant_id + scopes + api_key_id.
 *
 * meterUsage(): inserts a row into platform.tenant_api_usage.
 */

import { NextResponse } from 'next/server';
import { sha256Hex, isValidKeyShape } from './api-keys';

export interface ApiKeyContext {
  ok: true;
  tenant_id: string;
  api_key_id: string;
  scopes: string[];
}
export interface ApiKeyDenial {
  ok: false;
  response: NextResponse;
  reason: string;
}
export type ApiKeyResolution = ApiKeyContext | ApiKeyDenial;

function readKey(request: Request): string | null {
  const auth = request.headers.get('authorization') ?? '';
  if (auth.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim();
  const x = request.headers.get('x-api-key');
  if (x) return x.trim();
  return null;
}

export async function resolveApiKey(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  request: Request
): Promise<ApiKeyResolution> {
  const raw = readKey(request);
  if (!raw) {
    return {
      ok: false,
      reason: 'missing_api_key',
      response: NextResponse.json({ error: 'missing_api_key' }, { status: 401 }),
    };
  }
  if (!isValidKeyShape(raw)) {
    return {
      ok: false,
      reason: 'bad_key_shape',
      response: NextResponse.json({ error: 'invalid_api_key' }, { status: 401 }),
    };
  }
  const prefix = raw.slice(0, 12);
  const hash = sha256Hex(raw);
  const r = await supabase
    .from('platform_tenant_api_keys')
    .select('id, tenant_id, status, expires_at, scopes, key_hash')
    .eq('prefix', prefix)
    .maybeSingle();
  if (!r.data || r.data.key_hash !== hash) {
    return {
      ok: false,
      reason: 'unknown_key',
      response: NextResponse.json({ error: 'invalid_api_key' }, { status: 401 }),
    };
  }
  if (r.data.status !== 'active') {
    return {
      ok: false,
      reason: `status_${r.data.status}`,
      response: NextResponse.json({ error: 'api_key_inactive' }, { status: 401 }),
    };
  }
  if (r.data.expires_at && new Date(r.data.expires_at) <= new Date()) {
    return {
      ok: false,
      reason: 'expired',
      response: NextResponse.json({ error: 'api_key_expired' }, { status: 401 }),
    };
  }
  return {
    ok: true,
    tenant_id: r.data.tenant_id,
    api_key_id: r.data.id,
    scopes: r.data.scopes ?? [],
  };
}

export interface MeterArgs {
  route_path: string;
  method: string;
  status_code: number;
  latency_ms?: number;
  request_bytes?: number;
  response_bytes?: number;
  cost_usd_micros?: number;
}

export async function meterUsage(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  ctx: ApiKeyContext,
  args: MeterArgs
): Promise<void> {
  try {
    await supabase.from('platform_tenant_api_usage').insert({
      tenant_id: ctx.tenant_id,
      api_key_id: ctx.api_key_id,
      route_path: args.route_path,
      method: args.method,
      status_code: args.status_code,
      latency_ms: args.latency_ms ?? null,
      request_bytes: args.request_bytes ?? null,
      response_bytes: args.response_bytes ?? null,
      cost_usd_micros: args.cost_usd_micros ?? 0,
    });
    // Update last_used_at — best-effort.
    await supabase
      .from('platform_tenant_api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', ctx.api_key_id);
  } catch {
    /* meter is best-effort */
  }
}

// ---------------------------------------------------------------------------
// In-memory token-bucket rate limiter
//
// Per-tenant + per-minute. The DB-backed quota table covers durable
// daily limits; this in-memory limiter handles request bursts.
// ---------------------------------------------------------------------------

interface Bucket {
  tokens: number;
  reset_at: number;
}
const BUCKETS = new Map<string, Bucket>();

export function checkRateLimit(
  tenant_id: string,
  max_per_minute = 600
): { ok: boolean; remaining: number; reset_at: number } {
  const now = Date.now();
  const cur = BUCKETS.get(tenant_id);
  if (!cur || cur.reset_at < now) {
    const reset_at = now + 60_000;
    BUCKETS.set(tenant_id, { tokens: max_per_minute - 1, reset_at });
    return { ok: true, remaining: max_per_minute - 1, reset_at };
  }
  if (cur.tokens <= 0) return { ok: false, remaining: 0, reset_at: cur.reset_at };
  cur.tokens -= 1;
  return { ok: true, remaining: cur.tokens, reset_at: cur.reset_at };
}

export const __test = { resolveApiKey, meterUsage, checkRateLimit, readKey };
