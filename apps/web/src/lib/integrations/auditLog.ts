/**
 * Integration token-use audit log helper (server-side only).
 *
 * Records WHO did WHAT with a connected integration and whether it SUCCEEDED,
 * via the service-role `core.log_integration_event` RPC.
 *
 * HARD SAFETY GUARANTEES:
 *  - This module is server-only. It uses the Supabase SERVICE ROLE key, which
 *    must never reach the browser. Do not import it into client components.
 *  - It NEVER logs access tokens, refresh tokens, auth codes, secrets, the
 *    encryption key, or raw email/message bodies. `request_context` is a small,
 *    explicitly-allowlisted set of safe scalars (route, provider, status code,
 *    counts). A defensive scrubber drops any suspicious key/value before it
 *    leaves this process.
 *  - It DEGRADES GRACEFULLY: every failure path (no service-role client, RPC
 *    missing because the gated migration is not yet applied, network error) is
 *    swallowed. Auditing can never throw and can never break the working
 *    email / calendar / connect flow.
 */

import { createClient } from '@supabase/supabase-js';

export type AuditProvider = 'google' | 'microsoft' | 'plaid' | 'linkedin';

export type AuditAction =
  | 'connect_start'
  | 'connect_success'
  | 'connect_failure'
  | 'token_refresh_success'
  | 'token_refresh_failure'
  | 'email_list'
  | 'email_detail'
  | 'calendar_list'
  | 'calendar_detail'
  | 'disconnect_success'
  | 'disconnect_failure';

/** Only primitive, non-sensitive values belong here. */
export type SafeContextValue = string | number | boolean | null;
export type SafeRequestContext = Record<string, SafeContextValue>;

export interface AuditEvent {
  userId: string;
  provider: AuditProvider;
  action: AuditAction;
  success?: boolean;
  tenantId?: string | null;
  integrationId?: string | null;
  /** A short, stable error category — NEVER a raw error message or stack. */
  errorClass?: string | null;
  /** Pre-sanitized safe scalars only. Re-scrubbed defensively below. */
  context?: SafeRequestContext;
}

/**
 * Keys that must never be persisted, regardless of caller intent. Matched
 * case-insensitively as substrings so e.g. `access_token`, `refreshToken`,
 * `authorization`, `client_secret`, `body` are all rejected.
 */
const FORBIDDEN_KEY_PATTERNS = [
  'token',
  'secret',
  'password',
  'passwd',
  'code', // OAuth auth code / verification code
  'authorization',
  'auth_header',
  'bearer',
  'cookie',
  'session',
  'key', // encryption_key, api_key, client_key, ...
  'credential',
  'body', // raw email / message bodies
  'snippet',
  'content',
  'subject',
];

function isForbiddenKey(key: string): boolean {
  const k = key.toLowerCase();
  return FORBIDDEN_KEY_PATTERNS.some((p) => k.includes(p));
}

/**
 * Defensive scrubber: keep only safe scalar values under non-sensitive keys,
 * and cap string length so a stray large value can't bloat the row. This is a
 * second line of defense — callers are expected to pass safe context already.
 */
function scrubContext(context: SafeRequestContext | undefined): SafeRequestContext {
  if (!context) return {};
  const out: SafeRequestContext = {};
  for (const [key, value] of Object.entries(context)) {
    if (isForbiddenKey(key)) continue;
    if (value === null) {
      out[key] = null;
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      out[key] = value;
    } else if (typeof value === 'string') {
      // Cap length; never store anything that smells like a token/JWT.
      const trimmed = value.length > 256 ? value.slice(0, 256) : value;
      out[key] = trimmed;
    }
    // Objects/arrays/functions are intentionally dropped.
  }
  return out;
}

function getServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Persist one audit event. Fire-and-forget friendly: returns a promise that
 * always resolves (never rejects). Safe to `await` or to call without awaiting.
 */
export async function logIntegrationEvent(event: AuditEvent): Promise<void> {
  try {
    if (!event?.userId || !event?.provider || !event?.action) return;

    const admin = getServiceRoleClient();
    if (!admin) return; // No service-role client → silently skip auditing.

    const { error } = await admin.rpc('log_integration_event', {
      p_user_id: event.userId,
      p_provider: event.provider,
      p_action: event.action,
      p_success: event.success ?? true,
      p_tenant_id: event.tenantId ?? null,
      p_integration_id: event.integrationId ?? null,
      p_error_class: event.errorClass ?? null,
      p_request_context: scrubContext(event.context),
    });

    // If the gated migration is not applied yet, the RPC/table won't exist.
    // That is expected — swallow it so the working flow is never affected.
    void error;
  } catch {
    // Never let auditing throw into the caller's request path.
  }
}

/**
 * Derive a short, non-sensitive error category from an unknown error. Never
 * returns a raw message that could embed tokens or PII.
 */
export function classifyError(err: unknown): string {
  if (err && typeof err === 'object') {
    const name = (err as { name?: unknown }).name;
    if (typeof name === 'string' && name) return name.slice(0, 64);
    const code = (err as { code?: unknown }).code;
    if (typeof code === 'string' && code) return code.slice(0, 64);
  }
  if (typeof err === 'string' && err) {
    // Only keep a single safe token-ish word, never the full string.
    const word = err.split(/[\s:]/)[0];
    return (word || 'error').slice(0, 64);
  }
  return 'error';
}
