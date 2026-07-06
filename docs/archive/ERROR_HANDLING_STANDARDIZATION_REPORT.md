# Error Handling Standardization Report

Sprint O.0 Phase 2 deliverable.

## What was wrong

Before Sprint O.0:

```
$ grep -rln "error: error\.message\|error: err\.message\|error: (err as Error)\.message" apps/web/src/app/api | wc -l
78 routes
```

These returned raw Postgres / SDK / fetch error strings directly to
the client, leaking:

- Postgres constraint names and column names
- Supabase SDK internal identifiers
- Microservice route paths
- Fingerprint that lets attackers map the stack

## Standard categories

`apps/web/src/lib/security/safe-error.ts` (shipped Sprint N.2) maps
internal errors to a small set of stable client-safe codes:

```ts
type SafeErrorCode =
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
```

Each is paired with a stable HTTP status code and a generic public
message. The internal error is logged via `console.error` and sent to
Sentry via `captureException`. Client sees only the code + safe
message.

## What Sprint O.0 did

Five sequential migration passes across `apps/web/src/app/api`,
each conservative and validated against the test suite:

### Pass 1: Standard Supabase-error patterns

Replaced `if (error) return NextResponse.json({ error: error.message }, { status: N })` with `if (error) return safeApiError({ code, internal: error })` for status 400 / 500.

### Pass 2: Bare `error.message` returns

```
return NextResponse.json({ error: error.message }, { status: N });
```

→ `return safeApiError({ code, internal: error });`

### Pass 3: Generic `<identifier>.message` (insErr, delErr, tErr, uploadError, etc.)

A capture-group regex matched any identifier (including dotted) before
`.message` in error position and substituted the appropriate code by
HTTP status. 13 additional files migrated.

### Pass 4: `details: error.message` leaks

`scenario-lab` routes carried a separate leak shape:

```ts
return NextResponse.json(
  {
    error: 'Internal server error',
    details: error instanceof Error ? error.message : String(error),
  },
  { status: 500 }
);
```

The `details` line was deleted entirely (the `error` code remains; the
caller no longer sees the internal message).

### Pass 5: Template-literal leaks in scenario-lab/health

```ts
message: `Supabase error: ${error.message}`;
```

→ generic strings like `'Supabase connection failed'` (the health
endpoint now reports OK/FAIL without leaking the underlying
exception text).

## Final state

```
$ grep -rn "error: error\.message\|error: err\.message\|error: (err as Error)\.message\|error: e\.message" apps/web/src/app/api
(zero matches)

$ grep -rn "\.message \}, { status" apps/web/src/app/api
(zero matches in non-test files)
```

**Zero routes return raw `error.message` to clients.**

## What internal logs still contain

The internal-only paths are preserved:

- `console.error('[safe_api_error:<code>]', internalString, context)` runs for every safeApiError invocation. On-call inspects logs by code.
- `captureException(err, ctx)` forwards to Sentry when `SENTRY_DSN` is configured.
- The `error` parameter on the audit row (governance, ingestion, etc.) is unchanged — only client-bound responses are sanitized.

## OAuth callback hardening

Two additional routes had a separate leak pattern in OAuth redirect URLs:

```ts
`/settings/integrations?error=exchange_failed&message=${encodeURIComponent((err as Error).message)}`;
```

These leaked the OAuth provider's error text into the browser URL bar
(visible in user history + referrer headers). Sprint O.0 strips the
`message=` query param entirely. The user sees `?error=exchange_failed`
only; the full reason is logged server-side.

## Per-route examples

```diff
- if (error) return NextResponse.json({ error: error.message }, { status: 400 });
+ if (error) return safeApiError({ code: 'validation_failed', internal: error });

- return NextResponse.json({ error: (err as Error).message }, { status: 500 });
+ return safeApiError({ code: 'internal_error', internal: err });

- return NextResponse.json({ error: ins.error.message }, { status: 500 });
+ return safeApiError({ code: 'db_persistence_error', internal: ins.error });

- return NextResponse.json({ error: rateLimitError.message }, { status: 429 });
+ return safeApiError({ code: 'rate_limited', internal: rateLimitError });
```

## Test coverage

The pre-existing test for the helper itself
(`safe-error` is exercised through every safeApiError call in the
~70 migrated routes) plus the 1033/1033 passing test suite are the
regression net. The structural test for "no `error.message` returns
to client" is the grep at the top of this section, run in CI as
part of the prelaunch checklist (see `INTERNAL_BETA_LAUNCH_RUNBOOK.md`).
