# LIFE_FACTS_BACKFILL_DRY_RUN.md — Phase 2

Read-only dry run (preview + `BEGIN … INSERT … ROLLBACK`). Nothing persisted. Prod `diwkyyahglnqmyledsey`.

## Counts

| Metric                                         | Value                           |
| ---------------------------------------------- | ------------------------------- |
| `document_fields` found                        | 58                              |
| Eligible (non-rejected, has value/key/user)    | **58**                          |
| Excluded — rejected                            | 0                               |
| Excluded — missing value/key/user/docid        | 0                               |
| Distinct idempotency keys                      | 58 (no intra-source collisions) |
| Facts that **would** be created                | **58**                          |
| Skipped due to idempotency (life.facts empty)  | 0                               |
| High-confidence (≥0.85, still marked inferred) | 32                              |

## STOP-condition checks — all clear

| Condition                                     | Result                                      |
| --------------------------------------------- | ------------------------------------------- |
| user_id missing                               | 0 ✅                                        |
| document_id missing                           | 0 ✅                                        |
| field_value empty                             | 0 ✅                                        |
| field_key missing                             | 0 ✅                                        |
| review_status ambiguous (all `extracted`)     | none ambiguous ✅                           |
| duplicate collision unsafe                    | 58 distinct keys, ON CONFLICT DO NOTHING ✅ |
| mapping would promote unconfirmed → confirmed | no — all mapped to `inferred` ✅            |

## Sample mapped rows

| fact_type                             | value   | domain | conf | status   |
| ------------------------------------- | ------- | ------ | ---- | -------- |
| offer_letter.base_salary              | 185000  | career | 0.90 | inferred |
| life_insurance_policy.coverage_amount | 1000000 | family | 0.90 | inferred |
| offer_letter.equity_grant             | 300000  | career | 0.90 | inferred |
| offer_letter.signing_bonus            | 25000   | career | 0.90 | inferred |
| life_insurance_policy.premium         | 85      | family | 0.90 | inferred |

## Transactional proof

`BEGIN; <INSERT … ON CONFLICT DO NOTHING RETURNING 1>; SELECT count → would_insert = 58; ROLLBACK;` → post-rollback `life.facts` count = **0** (nothing persisted).

## Verdict

**DRY RUN PASSES.** No STOP condition. Safe to apply.
</content>
