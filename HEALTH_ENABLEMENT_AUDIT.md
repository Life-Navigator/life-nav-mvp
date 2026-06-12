# HEALTH ENABLEMENT AUDIT (Agent 6 — READ-ONLY)

**Date:** 2026-06-11
**Scope:** `healthcare/add`, `/api/health-monitoring/manual-entry`, biometrics, labs, medications, fitness, nutrition, vitals, insurance, monitoring/alerts.
**Mandate:** READ-ONLY. No code edited. Health NOT enabled. Every health surface is BLOCKED (gated).

## GO / NO-GO: **NO-GO for beta.** Health stays gated.

There are **three independent blockers**, any one of which is sufficient to keep Health off:

1. **Feature gate is locked.** `public.is_health_enabled()` returns `false` (migration `038_health_locked.sql`). No later migration flips it. Confirmed LIVE via RPC probe (status 200, body `false`). Every `health_meta` RLS policy is `USING (is_health_enabled() AND auth.uid()=user_id)`, so all owner-context reads/writes are denied.
2. **Core tables are not migrated to prod.** The manual-entry route writes to `health_meta.daily_wellbeing / vitals_log / body_measurements / lab_results`. Live PostgREST returns **404 PGRST205 "Could not find the table … in the schema cache"** for these even under service-role — meaning migration `063_health_intake_expansion.sql` (and the monitoring tables in `073`) are **not applied to the production database**. The `health_meta` schema exists and is partially migrated (hints reference `basic_r…`, `wearabl…`, `health_…`), but the manual-entry target tables are absent.
3. **The `healthcare/add` form points at endpoints that do not exist.** It POSTs to `${NEXT_PUBLIC_API_URL}/api/v1/health/{insurance|medications|appointments|vitals}`. The real Core API router prefix is `/v1/health` (NOT `/api/v1/health`), and even at the correct prefix there are **no POST routes** for insurance / medications / appointments / vitals — only GET list-routes plus wellness POSTs (`/profile`, `/goal`, `/habit`, `/check-in`, `/safety-check`). The form also defaults `NEXT_PUBLIC_API_URL` to `http://localhost:8000`, which `env-client.clientEnvUrl` rejects as a loopback in any non-local environment.

## SURFACES TABLE

| Surface                                                          | Route (UI)                                                                | Endpoint                                                                          | Table                                                                    | Status  |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------- |
| Manual healthcare add (insurance/medication/appointment/vitals)  | `/dashboard/healthcare/add`                                               | `${API}/api/v1/health/*` (DEAD — wrong prefix, no POST routes, localhost default) | `health` schema (GET-only in Core API)                                   | BLOCKED |
| Health monitoring manual entry (daily_wellbeing/vitals/body/lab) | (no dedicated UI; programmatic)                                           | `POST /api/health-monitoring/manual-entry` (Next route, exists & well-built)      | `health_meta.{daily_wellbeing,vitals_log,body_measurements,lab_results}` | BLOCKED |
| Biometrics / body measurements                                   | —                                                                         | `manual-entry` kind `body_measurement`                                            | `health_meta.body_measurements`                                          | BLOCKED |
| Labs                                                             | —                                                                         | `manual-entry` kind `lab_result`                                                  | `health_meta.lab_results`                                                | BLOCKED |
| Medications                                                      | `/dashboard/healthcare/add` (medication tab)                              | `${API}/api/v1/health/medications` (DEAD)                                         | `health_meta.medications` (063, not in prod)                             | BLOCKED |
| Fitness / training                                               | onboarding/intake                                                         | onboarding routes (gated writes)                                                  | `health_meta.{workout_logs,training_profile}`                            | BLOCKED |
| Nutrition                                                        | onboarding/intake                                                         | onboarding routes (gated writes)                                                  | `health_meta.{nutrition_profile,diet_log}`                               | BLOCKED |
| Vitals                                                           | `/dashboard/healthcare/add` (vitals tab — "coming soon", submit disabled) | `${API}/api/v1/health/vitals` (DEAD)                                              | `health_meta.vitals_log`                                                 | BLOCKED |
| Monitoring preferences                                           | —                                                                         | `/api/health-monitoring/preferences`                                              | `health_meta.health_monitoring_preferences`                              | BLOCKED |
| Monitoring alerts                                                | —                                                                         | `/api/health-monitoring/alerts`                                                   | `health_meta.health_alert_events`                                        | BLOCKED |
| Wearable event ingest                                            | —                                                                         | `/api/health-monitoring/wearable-event`                                           | `health_meta.*` via runner                                               | BLOCKED |

## ROOT CAUSES

- **Gate by design.** `is_health_enabled() = false` is intentional (HIPAA / medical-liability posture). All `health_meta` tables (038, 063, 069, 073) carry the gate in their RLS `USING/WITH CHECK`. This is the correct primary safety mechanism — keep it.
- **Prod schema drift.** Migrations 063/073 that create the manual-entry + monitoring tables are not applied to the live DB (404 PGRST205). Enabling the gate today would still fail because the tables aren't there.
- **Dead client form.** `healthcare/add` was written against a planned `/api/v1/health/*` REST surface on a localhost backend that was never built. Wrong prefix, no POST handlers, loopback default. It can never succeed as written.

## WHAT ACTUALLY WORKS TODAY (non-write, honest-empty)

- **`/api/health-monitoring/manual-entry`** Next route is correctly built per the proven pattern: `createServerSupabaseClient` (USER session), Zod-validated discriminated union, `user_id` stamped from `getUser()` (not payload), per-kind table whitelist, `safeApiError`, and a graceful `feature_locked` soft-200 when RLS denies. **It is production-quality and just waiting on the gate + tables.** It is the right write path to keep; the legacy `healthcare/add` form should eventually be repointed at it (or its Core-API equivalent), not the dead `/api/v1/health/*`.
- **`health` schema GET surfaces** (`health_profiles`, `health_insurance_plans`, `vitals`, `lab_markers`) are reachable and return empty `[]` (probe status 200). Core API `/v1/health/{summary,recommendations,labs,insurance,...}` GET list-routes work against these.
- **Dashboard honesty:** `/dashboard/healthcare/page.tsx` renders the shared `DomainOverview` with a "Health is in beta preparation" banner and the "not medical advice" disclaimer; absent data degrades to `DomainEmptyState` (no fake zeros). `/api/dashboard/summary` explicitly tolerates the gate and degrades to an empty card.
- **Medical safety gate** exists server-side: Core API `health_domain.py` `/safety-check` runs `MedicalSafetyGate().evaluate(...)` (wellness-only enforcement). Disclaimer text is present across health/wellness pages.

## VALIDATION EVIDENCE (live DB, service-role + 2 throwaway users)

DB-layer probe from `apps/web` against prod creds in `/tmp/sweep_creds.txt`:

```
admin-create userA:                         200
signIn userA (password grant):              200 ok
is_health_enabled() RPC:                    200  body: false        <-- GATE LOCKED (live)
INSERT health_meta.daily_wellbeing (userA): 404  PGRST205 "table not in schema cache"
INSERT health_meta.vitals_log (userA):      404  PGRST205 "table not in schema cache"
GET    health_meta.daily_wellbeing (userA): 404  PGRST205
GET    health_meta.daily_wellbeing (svc):   404  PGRST205           <-- table not migrated to prod
cleanup delete userA:                       200
```

Schema-wide table-existence probe (service-role):

```
[health_meta] daily_wellbeing:               404 PGRST205 (table absent)
[health_meta] vitals_log:                    404 PGRST205 (table absent)
[health_meta] body_measurements:             404 PGRST205 (table absent)
[health_meta] lab_results:                   404 PGRST205 (absent; hint -> basic_r…)
[health_meta] medications:                   404 PGRST205 (absent; hint -> wearabl…)
[health_meta] health_monitoring_preferences: 404 PGRST205 (absent; hint -> health_…)
[health_meta] health_alert_events:           404 PGRST205 (absent; hint -> health_…)
[health_meta] health_records:                403 42501 permission denied (table present, gated)
[health_meta] health_metrics:                403 42501 permission denied (table present, gated)
[health]      health_profiles:               200 []   (present, reachable)
[health]      health_insurance_plans:        200 []   (present, reachable)
[health]      vitals:                        200 []   (present, reachable)
[health]      lab_markers:                   200 []   (present, reachable)
[public]      profiles:                      200 [..] (sanity OK)
[finance]     financial_accounts:            200 [..] (sanity OK)
```

Interpretation: 038's `health_records/health_metrics` exist in prod and correctly enforce the gate (403). 063/073's manual-entry + monitoring tables are **not in prod at all** (404). RLS isolation could not be exercised because the write never lands — that is itself the BLOCKED evidence.

## EXACT STEPS A FUTURE HEALTH-ENABLEMENT SPRINT MUST TAKE

1. **Legal / compliance sign-off first.** Decide the medical-data posture (HIPAA applicability, BAA needs, data-retention, consent copy). Do not flip the gate without this.
2. **Apply the missing migrations to prod.** Push `063_health_intake_expansion.sql`, `069_intake_logs_and_benefit_profile.sql`, `073_wearable_monitoring.sql` to the live DB, then `NOTIFY pgrst, 'reload schema'`. Re-run the table-existence probe — all `health_meta` targets must return 200/403, none 404.
3. **Confirm schema exposure.** `health_meta` is already in `pgrst.db_schemas` (migrations 126/133/136). Verify it survives the reload and that owner-context grants exist (the finance/graphrag pattern needed an explicit API grant — see migration 105; mirror it for `health_meta` if writes 401/403 after the gate flips).
4. **Flip the gate deliberately.** `CREATE OR REPLACE FUNCTION public.is_health_enabled() ... SELECT true;` — but gate it behind an allow-list (per-user flag or env), not a global `true`, for staged rollout.
5. **Repoint or retire `healthcare/add`.** Replace the dead `/api/v1/health/*` POST targets with either (a) the existing, proven `POST /api/health-monitoring/manual-entry` (preferred — already RLS-correct), or (b) real POST routes on the Core API `/v1/health` router (currently GET-only for insurance/medications/vitals). Fix the `NEXT_PUBLIC_API_URL` localhost default. Map friendly fields -> real columns with a `toRow()` whitelist (insurance -> `health.health_insurance_plans`; medication -> `health_meta.medications`; vitals -> `health_meta.vitals_log`).
6. **Error-handling standard.** Make `healthcare/add` surface the server's machine-readable reason (it currently shows blanket `'Failed to add healthcare data'`); the manual-entry route already meets the standard.
7. **Medical-disclaimer / safety as a hard gate.** Keep the `MedicalSafetyGate` wellness-only enforcement on every health write/chat path. Require an explicit consent acknowledgement before first health write. Ensure every health surface renders the "not medical advice" disclaimer (most already do).
8. **GraphRAG triggers.** Triggers on `health_meta.{daily_wellbeing,body_measurements,training_profile,nutrition_profile}` (migration 074) fire on write regardless of the gate — verify they don't leak PHI into the graph before enabling; add a PHI-redaction step if needed.
9. **Two-user RLS validation.** Only after 1-8: re-run the DB probe with userA+userB to prove 201 insert under userA, row present for userA, ABSENT for userB, service-role verify, then clean up. Health stays BLOCKED until that passes.

## REMAINING RISKS

- PHI in GraphRAG/Neo4j/Qdrant via the 074 triggers if the gate is flipped before redaction review.
- `healthcare/add` will keep showing a confusing dead-end (loopback or "Failed to add") to any user who reaches it while gated — consider hiding the `next_action` button or routing it to discovery while Health is off.
- Prod schema drift (063/073 absent) suggests the migration pipeline did not apply the full health set; audit which other migrations are unapplied before the sprint.
