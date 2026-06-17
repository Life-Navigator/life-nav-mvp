# Migration Risk Assessment

**Date:** 2026-06-17 · Files: `20260616160000_mcp_ingestion.sql`, `20260617130000_pilot_feedback_metrics.sql`. Verdict: **LOW RISK — safe to apply.**

## The 7 questions

| #   | Question             | `mcp_ingestion`                                                                                                                                          | `pilot_feedback_metrics`                                                                 |
| --- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 1   | Additive?            | ✅ `CREATE TABLE IF NOT EXISTS` (life.facts, life.relationships) + `ADD COLUMN IF NOT EXISTS` (candidate_goals/risks/opportunities/constraints)          | ✅ `ADD COLUMN IF NOT EXISTS` only (kind, metrics, context, insight_detected, surprised) |
| 2   | Destructive ops?     | ❌ none (grep: no DROP/TRUNCATE/DELETE/ALTER TYPE)                                                                                                       | ❌ none                                                                                  |
| 3   | Table rewrites?      | ❌ new tables are empty; added columns use **constant** defaults (`'{}'::jsonb`, `'candidate'`, `'agent_inference'`) → Postgres 11+ adds without rewrite | ❌ same — constant defaults, no rewrite                                                  |
| 4   | Locks?               | Brief `ACCESS EXCLUSIVE` for `ADD COLUMN`/`CREATE INDEX`, but on tiny/new tables → milliseconds                                                          | Brief lock on `pilot_feedback` (small, pilot-stage) → negligible                         |
| 5   | Index creation risk? | `CREATE INDEX IF NOT EXISTS` (non-CONCURRENT) incl. two partial unique indexes — fine on empty/new tables                                                | one `CREATE INDEX IF NOT EXISTS` on a small table — fine                                 |
| 6   | RLS changes?         | Adds `ENABLE/FORCE RLS` + owner + service_role policies on the **NEW** tables only; does NOT alter existing-table RLS                                    | none (no RLS statements)                                                                 |
| 7   | Rollback concerns?   | Clean: `DROP TABLE life.facts, life.relationships` + `DROP COLUMN` the added cols (see rollback plan)                                                    | Clean: `DROP COLUMN` the 5 added cols                                                    |

## Idempotency

Both are fully idempotent (`IF NOT EXISTS` everywhere + guarded `DO` blocks). Safe to re-run; safe if partially applied.

## Notes

- `mcp_ingestion` uses a `DO` block to add provenance columns to `risks/opportunities/constraints` only `IF EXISTS` the table — so it won't fail if a table is absent.
- Both end with `NOTIFY pgrst, 'reload schema'` so PostgREST picks up the new columns immediately.
- The added defaults are `NOT NULL DEFAULT '{}'`/constant — existing rows backfill instantly with the default (no rewrite, no null violations).
- No foreign keys added → no validation scan against existing data.

## Recommended apply order

1. `20260616160000_mcp_ingestion.sql`
2. `20260617130000_pilot_feedback_metrics.sql`

Order is independent (different tables), but apply MCP first to match the sprint phases. Apply **after key rotation**, inside a transaction, with the post-apply validations in `MCP_VALIDATION_REPORT.md` / `PILOT_FEEDBACK_VALIDATION.md`.
