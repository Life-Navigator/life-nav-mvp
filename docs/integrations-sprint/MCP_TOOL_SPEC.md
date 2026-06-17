# MCP Tool Spec

**Date:** 2026-06-16 · Source of truth: `app/services/ingestion.py` (Pydantic models) + `mcp_server/server.py`.

All tools share a base: `confidence` (0–1, default 0.5), `confirmation_status` (`confirmed|inferred|candidate`, default `candidate`), `provenance` (**required**), `idempotency_key` (optional). Enums: `Domain = finance|family|health|education|career|core`; `SourceType = user_message|document|email|calendar|agent_inference|external`.

Every tool returns `{ok, table, id, action}` on success or `{ok:false, code, errors[]}` on rejection.

## submit_life_fact → `life.facts`

| Field       | Type         | Req          |
| ----------- | ------------ | ------------ |
| `fact_type` | string (≤80) | ✅           |
| `value`     | string       | ✅           |
| `domain`    | Domain       | default core |

e.g. user has children, works at NVIDIA, getting married, considering a master's.

## submit_goal → `life.candidate_goals`

| Field               | Type         | Req                                         |
| ------------------- | ------------ | ------------------------------------------- |
| `goal_title`        | string       | ✅                                          |
| `domain`            | Domain       | default core                                |
| `timeframe`         | string       | –                                           |
| `priority`          | string       | –                                           |
| `related_narrative` | NarrativeKey | –                                           |
| `supporting_quote`  | string       | –                                           |
| `dependencies`      | string[]     | – (stored in provenance, not auto-promoted) |
| `risks`             | string[]     | – (stored in provenance, not auto-promoted) |

Candidate/inferred goals are written `status='active'`; only `confirmation_status='confirmed'` → `status='confirmed'`.

## submit_constraint → `life.constraints`

`label` ✅, `domain`, `detail`, `severity` (low|medium|high). e.g. limited time, limited cash flow, debt burden, family obligation.

## submit_risk → `life.risks`

`label` ✅, `domain`, `severity`. e.g. overcommitment, income loss, high debt, missed deadline.

## submit_opportunity → `life.opportunities`

`label` ✅, `domain`. e.g. promotion accelerates housing; degree improves career path.

## submit_narrative → `life.facts` (fact_type=`dominant_narrative`, candidate)

`narrative_key` ✅ (`family_foundation|career_acceleration|financial_stabilization|health_life_balance|legacy_entrepreneurship|exploring`), `summary`. **Stored as a candidate signal — the canonical dominant narrative remains DERIVED from the goal set and is never overwritten.**

## submit_relationship → `life.relationships`

`from_ref` ✅, `to_ref` ✅, `relation_type` ✅ (`supports|conflicts|blocks|accelerates|depends_on`), `domain`. Self-edges (`from_ref==to_ref`) are rejected.

## Provenance object (required on every tool)

| Field                                                                | Req                                                       |
| -------------------------------------------------------------------- | --------------------------------------------------------- |
| `submitted_by`                                                       | ✅ (who/what — e.g. "arcana-discovery", "claude-desktop") |
| `source_type`                                                        | default agent_inference                                   |
| `conversation_id` / `document_id` / `email_id` / `calendar_event_id` | optional refs                                             |
| `user_message`                                                       | optional source utterance                                 |

## Adding a tool

A write path can only be added by registering a model in `TOOL_REGISTRY` and a method on `IngestionService` + a `@mcp.tool()` wrapper. There is no generic "write row" tool — by design.
