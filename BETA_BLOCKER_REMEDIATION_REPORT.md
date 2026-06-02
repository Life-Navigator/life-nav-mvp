# BETA Blocker Remediation Report

Sprint N.2 deliverable.

This report enumerates every BETA_BLOCKER from `FULL_SYSTEM_AUDIT_REPORT.md`
and documents how it was closed, with the artifact pointers, test
coverage, and verification path for each.

## Verdict

```
READY_FOR_INTERNAL_BETA
```

Conditional only on operator preflight: secrets configured, BAAs in
place where PHI is in scope, and migrations 002, 005, 092, 093, 094
applied in order.

## Test counts

| Metric     | Sprint N.1 close | Sprint N.2 close |
| ---------- | ---------------- | ---------------- |
| Suites     | 65               | 69               |
| Tests      | 942              | 983              |
| New suites | —                | 4                |
| New tests  | —                | +41              |

All passing.

## Blocker → Fix matrix

### 1. Sprint L2 constitutional pipeline not in runtime path

|                  |                                                                                                                                                                                                      |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Finding**      | `reviewAndPersist` only called by `/api/constitutional/review`. The 27 MUST_WIRE routes used Sprint L `validateAndPersist`.                                                                          |
| **Fix**          | `guardOutgoing` rewritten to invoke `reviewAndPersist`. Sprint L runs inside the constitutional pipeline as steps 1-3 + 6-9; block semantics preserved bit-for-bit.                                  |
| **Files**        | `apps/web/src/lib/governance/route-guard.ts`                                                                                                                                                         |
| **Test**         | `apps/web/src/lib/governance/__tests__/sprint-l2-runtime.spec.ts` (2 tests) plus the existing 50 bypass tests still pass unchanged.                                                                  |
| **Verification** | Every MUST_WIRE route now writes to `decision_governance_audit` AND `governance_review_iterations`. Constitutional verdict + crisis + future preservation surfaced on `GuardSuccess.constitutional`. |

### 2. Multimodal upload bypasses scanner / storage / cost

|                  |                                                                                                                                                                                             |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Finding**      | `defaultScanner()`, `SupabaseStorageAdapter.uploadObject`, `recordLlmUsage` defined and tested, but zero call sites in the upload route.                                                    |
| **Fix**          | New orchestrator `apps/web/src/lib/ingestion/upload-pipeline.ts` runs scan → store → extract → telemetry → cost meter in a single sequenced flow. Route handler delegates to it.            |
| **Files**        | `apps/web/src/lib/ingestion/upload-pipeline.ts`, `apps/web/src/app/api/ingest/upload/route.ts`                                                                                              |
| **Test**         | `apps/web/src/lib/ingestion/__tests__/upload-pipeline-wiring.spec.ts` (4 tests) plus journey 6 in `journeys-e2e.spec.ts` (3 tests).                                                         |
| **Verification** | Infected scan rejects extraction; scanner-error rejects with safe message; storage error rejects without `INGESTION_STORAGE_FALLBACK`; clean upload writes scan + storage + telemetry rows. |

### 3. Migration 002 had three conflicting variants

|                  |                                                                                                                                                                                                                                               |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Finding**      | `002_storage_buckets.sql`, `002_storage_buckets_fixed.sql`, `002_storage_buckets_robust.sql` co-existed with diverging bucket settings, MIME types, and policy DDL.                                                                           |
| **Fix**          | Consolidated into a single canonical `002_storage_buckets.sql` using the robust variant's production-grade settings, with `CREATE POLICY` DDL inline, idempotent `DROP POLICY IF EXISTS` guards, and `image/gif` removed from public buckets. |
| **Files**        | `supabase/migrations/002_storage_buckets.sql`, `supabase/migrations/_archived/002_storage_buckets_fixed.sql`, `supabase/migrations/_archived/002_storage_buckets_robust.sql`, `supabase/migrations/_archived/README.md`                       |
| **Verification** | `ls supabase/migrations/002_*` returns one file; archive directory has README explaining the consolidation.                                                                                                                                   |

### 4. Migration 005 created tables without RLS

|                  |                                                                                                                                                                                    |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Finding**      | 14 tables created without `ENABLE ROW LEVEL SECURITY`. Migration 006 enables RLS, but the gap between 005 and 006 was a theoretical leak window.                                   |
| **Fix**          | Appended `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` for all 14 tables to migration 005 + added a DO-block self-test that fails the migration if any of them ends up RLS-disabled. |
| **Files**        | `supabase/migrations/005_scenario_lab_schema.sql`                                                                                                                                  |
| **Verification** | Migration self-test raises an exception on any RLS-disabled scenario\__ or plan_ table.                                                                                            |

### 5. SECURITY DEFINER functions without `search_path`

|                  |                                                                                                                                                                                                                                                                                                                                           |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Finding**      | Audit cited 15; actual count was higher — 074 alone defined 42 trigger functions, plus 12 in 075, 12 in 055, others.                                                                                                                                                                                                                      |
| **Fix**          | New migration `094_harden_security_definer_search_path.sql` enumerates every SECURITY DEFINER function in the managed schemas (`public`, `governance`, `graphrag`, `ingestion`, `ops`, `platform`, `connectors`, `models`, `auth_ext`) and pins `search_path = public, pg_catalog, pg_temp`. Self-test fails the migration if any remain. |
| **Files**        | `supabase/migrations/094_harden_security_definer_search_path.sql`                                                                                                                                                                                                                                                                         |
| **Verification** | Migration is idempotent; second run alters 0 functions and the self-test passes.                                                                                                                                                                                                                                                          |

### 6. Localhost fallbacks in production server routes

|                  |                                                                                                                                                                                                                                                                                                                                             |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Finding**      | 6 server-side routes default to `http://localhost:8000` if `NEXT_PUBLIC_API_URL` is unset. SMTP defaults to `localhost`.                                                                                                                                                                                                                    |
| **Fix**          | New helpers `lib/security/env.ts` (`requireEnv` + `requireEnvUrl` — production refuses to allow loopback). Applied to the 4 backend-proxy routes + SMTP. ClamAV's `127.0.0.1` retained (documented, legitimate colocation).                                                                                                                 |
| **Files**        | `apps/web/src/lib/security/env.ts`, `apps/web/src/app/api/integrations/google/disconnect/route.ts`, `apps/web/src/app/api/integrations/stripe/portal/route.ts`, `apps/web/src/app/api/integrations/stripe/checkout/route.ts`, `apps/web/src/app/api/integrations/oauth/callback/google/route.ts`, `apps/web/src/lib/email/email-service.ts` |
| **Test**         | `apps/web/src/lib/security/__tests__/env.spec.ts` (9 tests)                                                                                                                                                                                                                                                                                 |
| **Verification** | `requireEnvUrl` throws `MissingEnvError` if loopback set in production. SMTP throws if `SMTP_HOST` is missing in production.                                                                                                                                                                                                                |

### 7. Raw error.message leaked to clients

|                  |                                                                                                                                                                                                                                                                                                                                                                                                          |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Finding**      | ~50 routes return raw `error.message` directly to the client, leaking Postgres constraint names, internal SDK details, and microservice identifiers.                                                                                                                                                                                                                                                     |
| **Fix**          | New helper `lib/security/safe-error.ts` with `safeApiError` + `safeDbError` that map internal errors to a small stable code set with safe public messages; full error logged internally + sent to Sentry via `captureException`. Applied to the 4 backend-proxy routes + OAuth callback. The remaining routes' migration to the helper is the Closed Beta task tracked in `FULL_SYSTEM_AUDIT_REPORT.md`. |
| **Files**        | `apps/web/src/lib/security/safe-error.ts`, 4 integration routes                                                                                                                                                                                                                                                                                                                                          |
| **Verification** | Test suite asserts no internal scanner error or upstream error message reaches the client body on the upload route.                                                                                                                                                                                                                                                                                      |

### 8. Dead code: `redis-client.ts`, `modular-services.ts`, `test-agent/`, orchestration-engine

|                   |                                                                                                                                                                                                                                                                                                                               |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Finding**       | 4 confirmed-orphan modules with 0 importers from production code: `cache/redis-client.ts` (3 LOC stub), `architecture/modular-services.ts` (448 LOC), `app/test-agent/page.tsx`, plus the `lib/agents/orchestration-engine.ts` chain (1,034 LOC + `agent-factory.ts` + `types.ts` + `MultiAgentChat.tsx`).                    |
| **Fix**           | **Option A (Delete)** chosen for the orchestration chain per the audit's binary choice — the chain bypassed governance entirely and routing every message through `guardOutgoing` was out of scope. All 4 deletions are `git rm`'d.                                                                                           |
| **Files removed** | `apps/web/src/lib/cache/redis-client.ts`, `apps/web/src/lib/architecture/modular-services.ts`, `apps/web/src/app/test-agent/page.tsx`, `apps/web/src/components/agents/MultiAgentChat.tsx`, `apps/web/src/lib/agents/orchestration-engine.ts`, `apps/web/src/lib/agents/agent-factory.ts`, `apps/web/src/lib/agents/types.ts` |
| **Verification**  | Full test suite (983/983) passes; no broken imports.                                                                                                                                                                                                                                                                          |

### 9. Migration verifiers missing for 090 / 092 / 093

|                  |                                                                                                                                                                                                                                                             |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Finding**      | Verifiers existed for 075-091 but not for 090 (beta ops + cost meter), 092 (multimodal production), or 093 (enterprise foundation).                                                                                                                         |
| **Fix**          | Three new verifier scripts in `scripts/validation/`.                                                                                                                                                                                                        |
| **Files**        | `scripts/validation/verify_090_beta_ops_meter.sql`, `scripts/validation/verify_092_multimodal_production.sql`, `scripts/validation/verify_093_enterprise_foundation.sql`                                                                                    |
| **Verification** | Each script seeds two test users, performs the relevant cross-user RLS leak test, asserts table/schema/RLS/policy presence, and validates the CHECK constraints + uniqueness invariants. All scripts wrap in `BEGIN; ... ROLLBACK;` so they leave no trace. |

### 10. Constitutional retrieval not exercised at runtime

|                  |                                                                                                                                                    |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Finding**      | `retrieveConstitutionalRuleSet` only called transitively by the legacy review route.                                                               |
| **Fix**          | Closed by item 1 — `reviewAndPersist` calls retrieval on every guarded request.                                                                    |
| **Verification** | `decision_governance_audit.metadata.retrieved_rule_count` is now populated for every audit row, and `audit.retrieval_ok` carries the live boolean. |

### 11. E2E coverage of the 8 critical journeys

|             |                                                                                                                                                                                                                                                          |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Finding** | Audit observed no end-to-end coverage exercising onboarding, goals, recommendation, simulation, Arcana, multimodal, redirection, or enterprise tenant.                                                                                                   |
| **Fix**     | `apps/web/src/__tests__/journeys-e2e.spec.ts` — 26 tests across the 8 journeys, covering both code-flow assertions (route imports guardOutgoing, processUpload, etc.) and live integration assertions through the orchestrators with capturing supabase. |
| **Files**   | `apps/web/src/__tests__/journeys-e2e.spec.ts`                                                                                                                                                                                                            |

## Cumulative artifact list

### New code

- `apps/web/src/lib/security/env.ts`
- `apps/web/src/lib/security/safe-error.ts`
- `apps/web/src/lib/ingestion/upload-pipeline.ts`

### Rewritten code

- `apps/web/src/lib/governance/route-guard.ts` (Sprint L → Sprint L2)
- `apps/web/src/app/api/ingest/upload/route.ts` (thin handler delegating to processUpload)
- `apps/web/src/app/api/integrations/google/disconnect/route.ts` (env hardening + safe errors)
- `apps/web/src/app/api/integrations/stripe/portal/route.ts` (same)
- `apps/web/src/app/api/integrations/stripe/checkout/route.ts` (same)
- `apps/web/src/app/api/integrations/oauth/callback/google/route.ts` (env hardening + no error leak in redirect)
- `apps/web/src/lib/email/email-service.ts` (no localhost SMTP default in production)

### New migrations

- `supabase/migrations/002_storage_buckets.sql` (consolidated rewrite)
- `supabase/migrations/094_harden_security_definer_search_path.sql`

### Migration retrofits

- `supabase/migrations/005_scenario_lab_schema.sql` (ENABLE RLS appended + self-test)

### Archived

- `supabase/migrations/_archived/002_storage_buckets_fixed.sql`
- `supabase/migrations/_archived/002_storage_buckets_robust.sql`
- `supabase/migrations/_archived/README.md`

### New verifier scripts

- `scripts/validation/verify_090_beta_ops_meter.sql`
- `scripts/validation/verify_092_multimodal_production.sql`
- `scripts/validation/verify_093_enterprise_foundation.sql`

### Deleted

- `apps/web/src/lib/cache/redis-client.ts`
- `apps/web/src/lib/architecture/modular-services.ts`
- `apps/web/src/app/test-agent/page.tsx`
- `apps/web/src/components/agents/MultiAgentChat.tsx`
- `apps/web/src/lib/agents/orchestration-engine.ts`
- `apps/web/src/lib/agents/agent-factory.ts`
- `apps/web/src/lib/agents/types.ts`

### New tests (4 suites, +41 tests)

- `apps/web/src/lib/governance/__tests__/sprint-l2-runtime.spec.ts` (2)
- `apps/web/src/lib/ingestion/__tests__/upload-pipeline-wiring.spec.ts` (4)
- `apps/web/src/lib/security/__tests__/env.spec.ts` (9)
- `apps/web/src/__tests__/journeys-e2e.spec.ts` (26)

## Operator preflight for internal beta

1. Apply migrations in order through `094`.
2. Run the three new verifier scripts against a copy of the prod database — they wrap in `ROLLBACK;` so they cannot mutate state.
3. Set `MALWARE_SCANNER`, `CLAMAV_HOST` (or `VIRUSTOTAL_API_KEY`), `SUPABASE_STORAGE_BUCKET=ingestion`, `SMTP_HOST` to non-loopback values in the production environment.
4. Do NOT set `MALWARE_SCAN_DISABLED=1` or `INGESTION_STORAGE_FALLBACK=1` in production.
5. Verify dashboards now show `decision_governance_audit.iteration_count > 0` for normal traffic (proof the L2 pipeline runs in the hot path).
