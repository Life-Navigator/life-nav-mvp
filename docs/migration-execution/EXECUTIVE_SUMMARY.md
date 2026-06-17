# Migration Execution Sprint — Executive Summary

**Date:** 2026-06-17 · **Final status: MIGRATIONS_SUCCESSFUL** — applied + verified in production on explicit owner authorization (with token rotation to follow immediately).

## APPLIED 2026-06-17 (owner-authorized: "run now, I'll rotate after")

Applied via the Supabase Management API (project `diwkyyahglnqmyledsey`), in dependency order:

1. **`20260616120000_pilot_routing.sql`** — HTTP 201. **Discovered missing in prod** (exactly as the pre-migration audit flagged): it creates `analytics.pilot_feedback` + `pilot_feedback_summary` view + `analytics.model_usage`. The feedback-metrics migration depends on it, so it was applied first. Fully additive.
2. **`20260616160000_mcp_ingestion.sql`** — HTTP 201. `life.facts` + `life.relationships` (RLS on) + provenance columns on candidate_goals/risks/opportunities/constraints.
3. **`20260617130000_pilot_feedback_metrics.sql`** — HTTP 201. `pilot_feedback.metrics/context/kind/insight_detected/surprised`.

**Verified in prod:** both new `life` tables exist with `rowsecurity=true`; all 5 feedback instrument columns present; all 4 life tables carry the 5 provenance columns. **Live write/read/delete** of a synthetic instrument row (`pilot_feedback`) and a synthetic `life.facts` row succeeded and were cleaned up (no residual test data).

> 🔴 **ROTATE NOW:** the apply used the previously-exposed PAT. Per the agreement, rotate the Supabase PAT + service-role + anon keys **immediately** (the token has now been used once more and must be invalidated).

The original (pre-apply) plan/analysis follows for the record.

---

## (Pre-apply) Why it had been BLOCKED

I would not apply using the **compromised** PAT without explicit owner authorization, and there was **no other credential** (CLI not logged in, no `SUPABASE_ACCESS_TOKEN`). The owner then authorized "run now, rotate after" — which is what was executed above.

## What I completed (safe, no prod writes)

- **PRE_MIGRATION_AUDIT** — migration history, what to verify live, and a **critical reconciliation**: the sprint expects dedicated `pilot_feedback` columns (narrative_accuracy, trust_score, …) but the actual migration stores them as a **`metrics` JSONB** (+ `insight_detected`/`surprised`). The instruments ARE captured — verification must look at the JSONB keys, not dedicated columns.
- **MIGRATION_RISK_ASSESSMENT** — both files are **fully additive, idempotent, no destructive ops, no table rewrites** (constant defaults), brief locks on tiny/new tables, RLS only on new tables. **LOW RISK.**
- **MCP_VALIDATION_REPORT** + **PILOT_FEEDBACK_VALIDATION** — all 7 MCP tools + all 7 feedback instruments validated at the **logic** layer (27 tests), with a precise post-apply live checklist.
- **ANALYTICS_DASHBOARD_VALIDATION** — dashboard gate math + **honest empty states** ("no metric silently defaults to success") verified in tests.
- **POST_MIGRATION_SMOKE_TEST** — **baseline PASS** on deployed v124 (`/healthz` 200; my-life/goals/feedback/admin all routing/401); full post-apply smoke checklist.
- **MIGRATION_ROLLBACK_PLAN** — exact transactional rollback SQL for both migrations + export-first guidance + post-rollback validation.

## The final questions

| #   | Question                         | Answer                                                           |
| --- | -------------------------------- | ---------------------------------------------------------------- |
| 1   | Migrations applied successfully? | **No — BLOCKED** on credential/rotation (reviewed & ready)       |
| 2   | MCP writes operational?          | Logic ✅; live ❌ until applied                                  |
| 3   | Provenance stored?               | Enforced in code + tests ✅; live pending                        |
| 4   | Tenant isolation preserved?      | ✅ in code/tests; live RLS check pending                         |
| 5   | Pilot metrics operational?       | Logic ✅; live pending                                           |
| 6   | Analytics aggregate correctly?   | ✅ tests; live pending                                           |
| 7   | Dashboards operational?          | ✅ deployed + tested; honest empty states                        |
| 8   | Regressions?                     | **None** (515 core-api + web suites green; baseline smoke clean) |
| 9   | Rollback documented?             | ✅                                                               |
| 10  | Ready for OAuth provisioning?    | **After** migrations applied + keys rotated                      |

## Unblock path (owner)

1. **Rotate** the exposed Supabase PAT + service-role + anon keys.
2. Provide a rotated credential (`! supabase login` in this session, or set `SUPABASE_ACCESS_TOKEN`), **or** apply the two files yourself (`supabase db push` / SQL editor) — order: `20260616160000_mcp_ingestion.sql` then `20260617130000_pilot_feedback_metrics.sql`.
3. I then run the live MCP + feedback + dashboard validations + post-apply smoke (checklists already written) and flip this to **MIGRATIONS_SUCCESSFUL**.

Per the sprint's own rule: **do not begin OAuth setup until migrations + validations pass.**
