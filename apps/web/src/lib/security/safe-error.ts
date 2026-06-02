/**
 * Safe API error responses — Sprint N.2 Phase 6 security hardening.
 *
 * Routes used to return `error.message` directly to clients. That leaks:
 *   - Database constraint names, column names, schema names
 *   - Postgres function source lines
 *   - Internal microservice identifiers
 *   - Cryptic SDK details that a malicious caller can map to fingerprints
 *
 * The right pattern is:
 *   - Map the internal error to a small set of STABLE machine-readable
 *     codes (`db_constraint_violation`, `validation_failed`, ...) and
 *     a human-friendly message that does not name internal types.
 *   - Log the FULL internal detail server-side (console.error for now,
 *     Sentry when SENTRY_DSN is set).
 *
 * The helper here is intentionally narrow: it covers the most common
 * shapes Supabase + the route handlers produce.
 */

import { NextResponse } from 'next/server';
import { captureException } from '@/lib/ops/observability';

export type SafeErrorCode =
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'bad_request'
  | 'validation_failed'
  | 'db_constraint_violation'
  | 'db_persistence_error'
  | 'upstream_unavailable'
  | 'rate_limited'
  | 'internal_error';

const PUBLIC_MESSAGE: Record<SafeErrorCode, string> = {
  unauthorized: 'Authentication is required.',
  forbidden: 'You do not have access to this resource.',
  not_found: 'Resource not found.',
  bad_request: 'The request is invalid.',
  validation_failed: 'The submitted data failed validation.',
  db_constraint_violation: 'The change conflicts with existing data.',
  db_persistence_error: 'Could not save changes. Please try again.',
  upstream_unavailable: 'A required service is currently unavailable.',
  rate_limited: 'Too many requests. Please slow down.',
  internal_error: 'An unexpected error occurred.',
};

const STATUS: Record<SafeErrorCode, number> = {
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  bad_request: 400,
  validation_failed: 400,
  db_constraint_violation: 409,
  db_persistence_error: 500,
  upstream_unavailable: 503,
  rate_limited: 429,
  internal_error: 500,
};

export interface SafeErrorOptions {
  code: SafeErrorCode;
  /** Internal error to log; never sent to the client. */
  internal?: unknown;
  /** Context passed to Sentry / logs. */
  context?: Record<string, unknown>;
  /** Override the default public message. Must NOT leak internals. */
  publicMessage?: string;
  /** Override the default HTTP status. */
  status?: number;
}

export function safeApiError(opts: SafeErrorOptions): NextResponse {
  const internalString =
    opts.internal instanceof Error
      ? opts.internal.message
      : typeof opts.internal === 'string'
        ? opts.internal
        : opts.internal != null
          ? JSON.stringify(opts.internal)
          : undefined;

  // Log internal detail so on-call can investigate. Use captureException
  // when Sentry is configured.
  if (opts.internal) {
    if (process.env.NODE_ENV !== 'test') {
      // eslint-disable-next-line no-console
      console.error(`[safe_api_error:${opts.code}]`, internalString, opts.context);
    }
    void captureException(opts.internal, { code: opts.code, ...opts.context });
  }

  return NextResponse.json(
    {
      error: opts.code,
      message: opts.publicMessage ?? PUBLIC_MESSAGE[opts.code],
    },
    { status: opts.status ?? STATUS[opts.code] }
  );
}

/**
 * Convenience for the common pattern:
 *
 *   if (error) return safeDbError(error, 'failed to insert goal');
 */
export function safeDbError(internal: unknown, context?: string): NextResponse {
  return safeApiError({
    code: 'db_persistence_error',
    internal,
    context: context ? { db_op: context } : undefined,
  });
}

export const __test = { PUBLIC_MESSAGE, STATUS };
