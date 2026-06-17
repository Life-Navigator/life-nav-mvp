# MCP Database Mapping

**Date:** 2026-06-16 · Implementation: `app/services/ingestion.py`. **The LLM never names a table — the tool does.**

| Tool                  | Target table                                  | Key columns written                                                                                               | Idempotency (deterministic id)                  | Upsert behavior                              |
| --------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | -------------------------------------------- |
| `submit_life_fact`    | `life.facts`                                  | fact_type, value, domain, confidence, confirmation_status, source, provenance, idempotency_key                    | `uuid5(user:facts:idem or fact_type:value)`     | merge on `id`                                |
| `submit_goal`         | `life.candidate_goals`                        | goal_text, normalized_goal, domain, confidence, supporting_quote, status, confirmation_status, source, provenance | `uuid5(user:candidate_goals:normalized_goal)`   | upsert `on_conflict=user_id,normalized_goal` |
| `submit_constraint`   | `life.constraints`                            | label, detail, severity, confidence, confirmation_status, source, provenance                                      | `uuid5(user:constraints:idem or label)`         | merge on `id`                                |
| `submit_risk`         | `life.risks`                                  | label, domain, severity, confidence, confirmation_status, source, provenance                                      | `uuid5(user:risks:idem or label)`               | merge on `id`                                |
| `submit_opportunity`  | `life.opportunities`                          | label, domain, confidence, confirmation_status, source, provenance                                                | `uuid5(user:opportunities:idem or label)`       | merge on `id`                                |
| `submit_narrative`    | `life.facts` (fact_type=`dominant_narrative`) | value=narrative_key, summary (in provenance), confidence, confirmation_status                                     | `uuid5(user:facts:narrative:key)`               | merge on `id`                                |
| `submit_relationship` | `life.relationships`                          | from_ref, to_ref, relation_type, domain, confidence, confirmation_status, source, provenance                      | `uuid5(user:relationships:idem or from:rel:to)` | merge on `id`                                |

## Cross-cutting rules

- **user_id / tenant_id**: always `ctx.user_id` (from the verified JWT). Never from the payload.
- **RLS**: owner policy (`user_id = auth.uid()`) + service_role policy on every table. The server writes as service-role and supplies `user_id` explicitly; RLS is the backstop.
- **Duplicate prevention**: deterministic ids — re-submitting the same fact/goal/risk updates in place (no duplicate row). Goals additionally honor the natural `(user_id, normalized_goal)` unique key.
- **Supersession**: not destructive — a re-submission overwrites the same row; prior values are replaced, not branched. (Goal/objective supersession lifecycle remains in `discover_goal`; MCP goals land in `candidate_goals`, the portfolio store that feeds the narrative.)
- **Audit trail**: `provenance` JSONB on every row records who/what/when/source refs. (A separate token-use audit log is a tracked gap — see `INTEGRATION_SECURITY_REPORT.md`.)
- **Rollback**: deterministic ids make a targeted delete/restore possible; the gated migration is additive + reversible (drop the two new tables + the added columns).

## Schema dependency

New columns/tables ship in `supabase/migrations/20260616160000_mcp_ingestion.sql` (gated on key rotation).
Until applied, writes to the new provenance columns / `life.facts` / `life.relationships` fail at the DB
(returned as `write_failed`, never partial). Tests use `FakeSupabase` and pass independent of the migration.
