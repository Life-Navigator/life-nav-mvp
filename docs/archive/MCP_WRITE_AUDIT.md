# MCP_WRITE_AUDIT.md

Audit: every Advisor Action write goes through the MCP/IngestionService path — never a direct DB write.

## The only write call

`advisor_actions.apply()` calls **`IngestionService.submit_life_fact(ctx, payload)`** — the same method the 7-tool MCP server wraps. No `supabase.insert/update/upsert` is called anywhere in `advisor_actions.py` (verified: the file imports nothing from the DB client; it receives an `ingestion` object and calls only `submit_life_fact`).

## What IngestionService enforces (inherited, unchanged)

- **Tenant scope**: `user_id`/`tenant_id` set from `ctx.user_id` (JWT), never from the payload.
- **Schema validation**: payload validated against `LifeFactIn` (fact_type ≤ 80 chars, value non-empty, domain enum, confidence 0–1).
- **Provenance required**: every row carries `provenance.submitted_by="arcana-action-loop"`, `source_type="user_message"`.
- **Idempotent**: deterministic `uuid5(user:facts:key)` + `idempotency_key="action:{type}:{fact_type}"` → re-approval upserts, never duplicates.

## Confirmation status

Action writes use `confirmation_status="confirmed"` (the user explicitly approved the change) → they surface in the UI (the reader trusts `confirmed`/`inferred`). Candidate inferences are never produced by this path.

## Live evidence

14 facts written across 5 domains, all with `provenance.submitted_by='arcana-action-loop'`, `confirmation_status='confirmed'`:
| domain | facts |
|---|---|
| career | 4 | family | 2 | finance | 3 | education | 3 | health | 2 |

## Verdict

No silent writes, no direct DB access, full provenance + tenant isolation + idempotency. The action loop is a thin, gated caller of the existing MCP write layer.
