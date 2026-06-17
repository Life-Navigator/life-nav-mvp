# MCP Schema Enforcement

**Date:** 2026-06-16 · Implementation: `app/services/ingestion.py`. Tests: `tests/test_ingestion.py` (10).

## What is enforced on every write

| Rule                     | How                                                                                                   | Test                                                                  |
| ------------------------ | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Required fields present  | Pydantic required fields (`...`)                                                                      | `test_provenance_is_required`, `test_every_tool_validates_provenance` |
| Allowed enum values only | `Enum` types (Domain, ConfirmationStatus, SourceType, RelationType, Severity, NarrativeKey)           | `test_invalid_schema_rejected_no_partial_write`                       |
| Valid domain             | `Domain` enum                                                                                         | same                                                                  |
| Confidence in [0,1]      | `Field(ge=0, le=1)`                                                                                   | same                                                                  |
| `user_id` / `tenant_id`  | injected from the resolved context, **never** the payload (models have no such field; extras ignored) | `test_tenant_isolation_user_id_from_context_not_payload`              |
| `source` type            | `provenance.source_type` enum                                                                         | `test_valid_fact_write_persists_with_provenance`                      |
| `confirmation_status`    | enum; candidate/inferred never auto-promoted                                                          | `test_candidate_is_not_promoted_to_confirmed`                         |
| `confidence`             | required-with-default, validated                                                                      | —                                                                     |
| `provenance`             | **required** object with `submitted_by`                                                               | `test_provenance_is_required`                                         |
| `idempotency_key`        | optional; folds into a deterministic id                                                               | `test_duplicate_submission_is_idempotent`                             |
| Semantic guard           | relationship self-edge rejected                                                                       | `test_relationship_rejects_self_edge`                                 |

## Rejection contract

Invalid input returns:

```json
{
  "ok": false,
  "code": "schema_validation",
  "errors": [{ "field": "confidence", "msg": "Input should be less than or equal to 1" }]
}
```

and writes **nothing** (`sb.inserts == []` asserted). There are **no partial writes** — validation happens
before any DB call. A database-level failure (e.g. missing column pre-migration) returns
`{ok:false, code:"write_failed"}` — also non-partial.

## Why Pydantic at the boundary

Validation runs at the tool-call boundary (the MCP client gets the JSON schema from the model, so a
well-behaved LLM self-corrects), and again inside `IngestionService` (defense in depth — the service is
safe even if called directly). Enums mean the LLM cannot invent a domain, source, severity, relation, or
narrative key.
