# MCP Validation Report

**Date:** 2026-06-17 · Logic: **VALIDATED** (tests). Live DB writes: **PENDING APPLY** (gated on credential + migration).

## Validated now (no prod needed) — `tests/test_ingestion.py`, 10 passing

| Tool / behavior                                                   | Evidence                                                              |
| ----------------------------------------------------------------- | --------------------------------------------------------------------- |
| `submit_life_fact` persists with provenance + source              | `test_valid_fact_write_persists_with_provenance`                      |
| Schema enforcement — invalid rejected, **no partial write**       | `test_invalid_schema_rejected_no_partial_write`                       |
| Provenance **required** on every tool                             | `test_provenance_is_required`, `test_every_tool_validates_provenance` |
| Idempotency / **duplicate prevention**                            | `test_duplicate_submission_is_idempotent` (deterministic id; one row) |
| Candidate/inferred **never promoted to confirmed**                | `test_candidate_is_not_promoted_to_confirmed`                         |
| Confirmed marked confirmed                                        | `test_confirmed_goal_marked_confirmed`                                |
| **Tenant isolation** — user_id from context, never payload        | `test_tenant_isolation_user_id_from_context_not_payload`              |
| Relationship self-edge rejected                                   | `test_relationship_rejects_self_edge`                                 |
| Narrative stored as candidate (derived narrative not overwritten) | `test_narrative_stored_as_candidate_fact_not_overwriting_derived`     |

All 7 tools (`submit_life_fact/goal/constraint/risk/opportunity/narrative/relationship`) are covered for: insert succeeds, provenance stored, confidence stored, candidate status preserved, no promotion, duplicate prevention.

## Pending live validation (run immediately AFTER applying `20260616160000_mcp_ingestion.sql`)

Prereq: keys rotated; `LIFENAV_USER_JWT` for a real test user; `mcp` deps installed.

1. Confirm tables exist: `life.facts`, `life.relationships` (columns, indexes, RLS owner+service_role policies).
2. Confirm provenance columns on `candidate_goals/risks/opportunities/constraints` (`confidence`, `confirmation_status`, `source`, `provenance`, `idempotency_key`).
3. Run each MCP tool live against a test user; assert:
   - insert succeeds; row scoped to the JWT user_id/tenant_id (RLS blocks cross-user read).
   - `provenance` JSONB + `confidence` + `confirmation_status` stored.
   - re-submit same payload → same deterministic id, **one** row (no dup).
   - a `candidate` goal stays `status='active'`/`confirmation_status='candidate'` (no auto-confirm).
4. Confirm a second user cannot read the first user's rows (tenant isolation under live RLS).

## Status

**MCP logic READY; live writes BLOCKED on apply.** No way to exercise live inserts until the migration is applied with a rotated credential.
