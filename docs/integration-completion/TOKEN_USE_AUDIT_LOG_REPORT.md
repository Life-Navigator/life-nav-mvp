# Token-Use Audit Log — Report

**Sprint:** Integration Completion — Google token persistence + token-use audit logging
**Date:** 2026-06-17
**Scope:** P2. Additive audit log. No new providers/features. No package.json/lockfile edits.

## What it records

Every meaningful use of a connected integration token — who, what, success/failure — so
the platform can answer "did this user's Gmail/Calendar token actually get used, and did
it work?" without ever persisting the token itself.

## Schema — gated migration

`supabase/migrations/20260617120000_integration_audit.sql`

- **GATED**: header comment `GATED: apply after key rotation`. Additive and idempotent
  (`CREATE TABLE IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`, `DROP POLICY IF EXISTS`),
  intentionally held from auto-apply until `INTEGRATION_ENCRYPTION_KEY` rotation
  completes. Until applied, the app helper degrades gracefully (below).

Table `core.integration_audit_log`:

| Column          | Type                 | Notes                                                                   |
| --------------- | -------------------- | ----------------------------------------------------------------------- |
| id              | UUID PK              | `gen_random_uuid()`                                                     |
| user_id         | UUID NOT NULL        | actor                                                                   |
| tenant_id       | UUID NULL            | tenant scope (nullable; `core.integration_tokens` is user-scoped today) |
| provider        | TEXT NOT NULL        | `google` / `microsoft` / `plaid` / `linkedin`                           |
| integration_id  | UUID NULL            | `core.integration_tokens.id` when known                                 |
| action          | TEXT NOT NULL        | see action list                                                         |
| success         | BOOLEAN NOT NULL     | default true                                                            |
| error_class     | TEXT NULL            | short safe category only (never a raw message)                          |
| request_context | JSONB NOT NULL       | pre-sanitized safe scalars (route, count, status)                       |
| created_at      | TIMESTAMPTZ NOT NULL | `now()`                                                                 |

RLS (116-RLS pattern):

- `integration_audit_owner_select` — `authenticated` may `SELECT` only their own rows.
- `integration_audit_service_role` — `service_role` full access. No owner INSERT/UPDATE.

RPC `core.log_integration_event(...)` — `SECURITY DEFINER`, service-role only, REVOKE
from PUBLIC. **Never throws**: returns early on malformed input so a bad audit call can't
break the working flow.

## Actions logged

`connect_start`, `connect_success`, `connect_failure`, `token_refresh_success`,
`token_refresh_failure`, `email_list`, `email_detail`, `calendar_list`,
`calendar_detail`, `disconnect_success`, `disconnect_failure`.

(`email_detail` / `calendar_detail` are defined in the helper's `AuditAction` union for
the detail routes; current shipped routes are list-style — `email_list` / `calendar_list`
— so those are the actions actively emitted today.)

## Server-side helper

`apps/web/src/lib/integrations/auditLog.ts`

- `logIntegrationEvent(event)` — uses the **service-role** Supabase client, calls
  `log_integration_event`. Always resolves; never rejects.
- `classifyError(err)` — derives a short safe label (`name`/`code`/first word, capped
  64 chars). Never returns a raw message/stack.

### Safe-logging guarantees (defense in depth)

1. Callers pass only safe scalars in `context`.
2. `scrubContext()` re-filters before send: drops any key matching
   `token|secret|password|code|authorization|bearer|cookie|session|key|credential|body|snippet|content|subject`,
   keeps only string/number/boolean/null, caps strings at 256 chars, drops
   objects/arrays. So access/refresh tokens, auth codes, secrets, the encryption key, and
   raw email bodies/subjects are stripped even if a caller passes them by mistake.
3. The DB column set has no token/secret column.

### Degrade-gracefully guarantees

- No service-role client (missing env) → skip silently, no RPC call.
- RPC/table absent (gated migration not yet applied) → Supabase returns an error which is
  swallowed (`void error`).
- RPC rejects (network) → caught; never propagates.
- Required fields missing → skip silently.

Verified in `apps/web/src/lib/integrations/__tests__/auditLog.test.ts`.

## Call sites (file:line anchors)

- `apps/web/src/app/api/integrations/oauth/callback/google/route.ts` — `connect_start`
  (~L100), `connect_success` (~L150), `connect_failure` (~L170).
- `apps/web/src/app/api/integrations/oauth/callback/microsoft/route.ts` — `connect_start`,
  `connect_success`, `connect_failure`.
- `apps/web/src/app/api/integrations/google/disconnect/route.ts` —
  `disconnect_success` / `disconnect_failure`.
- `apps/web/src/app/api/integrations/microsoft/disconnect/route.ts` —
  `disconnect_success` / `disconnect_failure`.
- `apps/web/src/app/api/email/messages/route.ts` — `email_list` (success + failure).
- `apps/web/src/app/api/calendar/events/route.ts` — `calendar_list` (success + failure
  per provider), `token_refresh_success` / `token_refresh_failure` for both Google and
  Microsoft refresh paths.

## Token-never-logged guarantees verified by tests

- Audit helper test asserts sensitive context keys are scrubbed and tokens never appear
  in the RPC payload.
- Google callback test asserts `connect_*` audit events never contain the access/refresh
  token or auth code.
- Google disconnect test asserts `disconnect_*` audit events never contain the token.

## Tooling results

- `pnpm -C apps/web type-check`: PASS.
- ESLint on all changed files: PASS.
- Jest (audit + google callback + disconnect + email + calendar): 31 passed.
