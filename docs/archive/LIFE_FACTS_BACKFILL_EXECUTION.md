# LIFE_FACTS_BACKFILL_EXECUTION.md — Phase 3

Applied 2026-06-22 via Supabase Management API (single committed `INSERT … SELECT … ON CONFLICT DO NOTHING`). Prod `diwkyyahglnqmyledsey`.

## Result

| Metric                          | Value                                 |
| ------------------------------- | ------------------------------------- |
| Before count                    | 0                                     |
| Inserted                        | **58**                                |
| Skipped (idempotency)           | 0                                     |
| After count                     | **58**                                |
| Candidates produced (must be 0) | 0 ✅                                  |
| Confirmation status             | all `inferred` (pending confirmation) |

## Per-user

| user_id         | facts |
| --------------- | ----- |
| 0a291b09…1158ca | 52    |
| 1ae69cd7…4bc025 | 5     |
| bcdd40d5…841500 | 1     |

(3 users had processed documents; the rest of the 182 users have none yet.)

## Per-domain

| domain  | facts |
| ------- | ----- |
| career  | 23    |
| health  | 18    |
| family  | 9     |
| finance | 8     |

## Coverage

19 distinct source documents → 58 facts. All 58 carry `provenance.document_id` + `document_field_id`.

## Sample applied facts

`offer_letter.base_salary=185000` (career) · `life_insurance_policy.coverage_amount=1000000` (family) · `offer_letter.equity_grant=300000` (career) · `life_insurance_policy.premium=85` (family) — all `inferred`.

## Rollback query (surgical, complete)

```sql
DELETE FROM life.facts WHERE provenance->>'submitted_by' = 'document-intelligence-backfill';
-- expected: 58 rows deleted; removes ONLY backfilled rows.
```

</content>
