# Post-Migration Smoke Test

**Date:** 2026-06-17 · Pre-apply baseline captured; full post-apply checklist below.

## Pre-apply baseline (deployed core-api v124, no migration yet) — PASS

| Endpoint                    | Method | Result                        |
| --------------------------- | ------ | ----------------------------- |
| `/healthz`                  | GET    | **200**                       |
| `/v1/life/my-life`          | GET    | **401** (auth-gated, routing) |
| `/v1/life/goals`            | GET    | **401** (auth-gated, routing) |
| `/v1/feedback`              | POST   | **401** (auth-gated, routing) |
| `/v1/admin/pilot-analytics` | GET    | **401** (auth-gated, routing) |

All endpoints are deployed and routing correctly **before** the migration — confirming the read path + canonical goals + feedback endpoints already ship in v124 and degrade honestly without the migration. No auth/RLS/dashboard breakage at baseline.

Logic suites green: ingestion (10) + pilot (10) + canonical goals (7) = **27 pass**; full core-api **515 pass**.

## Full post-apply smoke (run AFTER migrations applied with a rotated credential)

Authenticate as a real test user (JWT) and verify:

1. `GET /v1/life/my-life` → 200; `canonical_goals` present; no error.
2. `GET /v1/life/goals` → 200; deduped goals or honest empty.
3. `POST /v1/feedback` with an instrument payload → `{ok:true, stored:true}` (not `degraded`).
4. `GET /v1/admin/pilot-analytics` (admin) → `instruments` block populated; (non-admin) → 403.
5. MCP: run each `submit_*` tool live → insert succeeds, provenance stored, tenant-scoped (see `MCP_VALIDATION_REPORT.md`).
6. `/dashboard/pilot-analytics` renders metrics + gates + honest empty states.

## Regression checks (post-apply)

- Existing `/v1/life/my-life`, `/v1/recommendations/*`, advisor, reports still 200 for a valid user.
- RLS: a user reads only their own `life.facts`/`life.relationships`/`pilot_feedback` rows.
- No auth breakage (401 for anon, 200 for valid JWT, 403 for non-admin on admin routes).
- Re-run full core-api + web suites → still green.

## Status

Baseline **PASS**. Post-apply smoke **PENDING** (gated on credential + migration apply).
