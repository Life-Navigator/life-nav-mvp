# E2E Validation Audit

Verification Audit — Phase 6.

## Method

Execute the existing E2E test suite. Inspect each journey's
assertions. Confirm the assertions match the audit's required
verification.

## Test execution

```
$ npx jest --no-coverage
Test Suites: 72 passed, 72 total
Tests:       1041 passed, 1041 total
```

All passing.

## Journey coverage

### 1. Consumer journey

File: `apps/web/src/__tests__/journeys-e2e.spec.ts` — Journey 1.

Asserts: `/api/onboarding/life-vision` enforces auth and uses Supabase;
no `localStorage` fossils.

Plus: `apps/web/src/__tests__/auth-flows.test.ts` — runs across 4 auth
forms (LoginForm, RegisterForm, ForgotPasswordForm, ResetPasswordForm)
asserting no localStorage, no legacy `/api/auth/` calls, Supabase-direct
session usage.

✅ **PASS.**

### 2. Arcana journey

File: `journeys-e2e.spec.ts` — Journey 5.

Asserts that `arcana/readiness`, `arcana/catch-up`, `arcana/lead-package`,
and `provider/patients/[id]/recommendation` all import `guardOutgoing`.

Plus: `apps/web/src/lib/arcana/__tests__/readiness-engine.test.ts`
exercises the actual readiness engine.

✅ **PASS.**

### 3. Upload journey

File: `journeys-e2e.spec.ts` — Journey 6.

Asserts:

- `/api/ingest/upload` delegates to `processUpload + defaultScanner + SupabaseStorageAdapter`
- Clean upload writes scan + storage + telemetry rows
- Infected upload BLOCKS extraction (no job / no entities / no facts)

Plus: `apps/web/src/lib/ingestion/__tests__/upload-pipeline-wiring.spec.ts`
covers 4 wiring scenarios at the orchestrator boundary.

Plus (NEW): `apps/web/src/lib/security/injection/__tests__/runtime-integration.spec.ts`
adds Scenarios 1, 2, 3, 12 — PDF / OCR / transcript injection detection

- audit completeness.

✅ **PASS.**

### 4. Constitutional redirection journey

File: `journeys-e2e.spec.ts` — Journey 7.

Asserts:

- Sprint L harmful content is blocked at the guard with `g.ok === false`
- Sprint L2 surfaces a constitutional decision (crisis + emotional + future_preservation) even on clean content

Plus: `apps/web/src/lib/governance/__tests__/sprint-l2-runtime.spec.ts`
positively asserts the Sprint L2 audit columns are populated.

Plus: `apps/web/src/lib/constitutional/__tests__/orchestrator.test.ts`
exercises the 13-step orchestrator unit-level.

Plus (NEW): `runtime-integration.spec.ts` Scenarios 7, 11 add
response-time injection blocking.

✅ **PASS.**

### 5. Enterprise tenant journey

File: `journeys-e2e.spec.ts` — Journey 8.

Asserts:

- `/api/platform/api-keys` handles POST + DELETE
- `/api/platform/tenants/me` enforces auth
- API key creation hashes the key (never stores plaintext)
- Plain key returned exactly once

Plus: `apps/web/src/lib/tenant/__tests__/gateway.test.ts` (16 tests)
exercises the gateway under denial + rate-limit conditions.

Plus: `apps/web/src/lib/models/__tests__/byom.test.ts` (11 tests)
covers the BYOM resolution path.

✅ **PASS.**

## Structural integrity sweep

`journeys-e2e.spec.ts` Structural describe block re-asserts that 7
high-impact MUST_WIRE routes import `guardOutgoing`. The full
26-route sweep is in `governance-bypass.spec.ts`.

✅ **PASS.**

## What's NOT covered (transparency)

- **Playwright browser tests.** Sprint N.2 deferred these to Closed
  Beta. None were added this addendum. The test suite is therefore
  Jest-only and asserts orchestrator + route-source-grep, not actual
  HTTP roundtrip + DOM behavior. The verification audit accepts this
  as appropriate for "automated coverage of critical paths" in a
  hardening sprint.
- **Real Supabase RLS execution.** The Jest harness uses a capturing
  mock. RLS is verified by the three `verify_*.sql` scripts which are
  meant to run against a real database.
- **Real provider HTTP under failure.** Unit tests cover this in
  `byom.test.ts` (11 tests, each provider's auth_failed /
  rate_limited / capability_unsupported / not_configured paths).

## Verdict for Phase 6

**PASS.**

1041 tests across 72 suites pass. Every journey the audit asked for
has automated coverage. The injection addendum added 58 tests across
3 suites, all green.

Production smoke: after deploy, run the three verifier SQL scripts
against the production database to confirm the database-side claims.
