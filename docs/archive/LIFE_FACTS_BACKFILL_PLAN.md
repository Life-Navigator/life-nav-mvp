# LIFE_FACTS_BACKFILL_PLAN.md — Phase 1

One-time, idempotent backfill of already-extracted document fields into `life.facts` so the (already-shipped) advisor reader + dashboard strip have real data. **No new infra; pure SQL over existing tables.**

## Source → destination

- **Source:** `documents.document_fields` (58 rows) JOIN `documents.documents` (for `user_id`, `doc_type`, `affects_domains`).
- **Destination:** `life.facts`.

## Mapping rules

| life.facts column       | value                                                                                                   |
| ----------------------- | ------------------------------------------------------------------------------------------------------- | --- | --- | --- | ------------------------------------------------------------------------- |
| `id`                    | `gen_random_uuid()`                                                                                     |
| `user_id` / `tenant_id` | `documents.documents.user_id` (single-tenant = user_id, matching the bridge)                            |
| `fact_type`             | `doc_type                                                                                               |     | '.' |     | field_key`(e.g.`offer_letter.base_salary`) — identical to the live bridge |
| `value`                 | `field_value`                                                                                           |
| `domain`                | `affects_domains[1]` (the document's own primary domain), else `core`                                   |
| `confidence`            | `document_fields.confidence` (unchanged)                                                                |
| `confirmation_status`   | **`inferred`** for all (see below)                                                                      |
| `source`                | `document`                                                                                              |
| `provenance`            | `{submitted_by: document-intelligence-backfill, source_type: document, document_id, document_field_id}` |
| `idempotency_key`       | `document_id                                                                                            |     | ':' |     | field_key` — **identical to the live bridge key**                         |

## Trust rules (honored)

- **Rejected fields excluded:** `WHERE review_status <> 'rejected'`. (0 in prod.)
- **No candidate promotion:** never write `candidate`. (0 candidates produced.)
- **Confirmed remain confirmed:** the source has **no** user-confirmed fields (all 58 are machine-`extracted`), so none are promoted to `confirmed`. Every backfilled fact is **`inferred` → renders as "pending your confirmation"** and is flagged by the advisor as unconfirmed. This is the conservative, honest choice: a machine-extracted value the user has not reviewed is never asserted as settled fact. (32 fields are conf ≥ 0.85; we still mark them `inferred` — the user confirms via the existing migration-165 review loop.)
- **Low-confidence → needs review:** `inferred` maps to the UI's "pending confirmation" state.

## Idempotency

`ON CONFLICT (user_id, idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING`, targeting the migration's `uq_life_facts_idem` partial unique index. Because the key equals the live bridge's key, a future real upload of the same document will **not** create duplicates. Re-running the backfill is a no-op.

## User scoping

`user_id` is taken from `documents.documents.user_id` (never from field input). RLS-safe; service-role insert with explicit user_id.

## Excluded fields

`review_status='rejected'` (0), empty `field_value` (0), null `field_key` (0), null `user_id` (0).

## Rollback plan

Every backfilled row is tagged `provenance->>'submitted_by' = 'document-intelligence-backfill'`:

```sql
DELETE FROM life.facts WHERE provenance->>'submitted_by' = 'document-intelligence-backfill';
```

Surgical and complete — removes only backfilled rows, leaves any future bridge-written facts intact.
</content>
