# POST_APPLY_VALIDATION.md

**Date:** 2026-06-21 · **Prod DB:** Supabase `diwkyyahglnqmyledsey` · **Scope:** validate migrations 165/166/167 only. All checks via Supabase Management API (read-only) + backend test suite.

## 1. Migration history

`supabase_migrations.schema_migrations` now records:

```
165  document_field_provenance
166  field_conflicts
167  resume_imports
```

(160/164 + timestamped drift intentionally left as-is per scope — not repaired.)

## 2. Migration 165 — document field provenance

| Check                                                | Expected | Actual                                                                                           | ✓   |
| ---------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------ | --- |
| Provenance columns on `documents.document_fields`    | 7        | `char_end, char_start, extracted_at, extraction_method, page_number, review_status, section` (7) | ✅  |
| Check constraint `document_fields_review_status_chk` | 1        | 1                                                                                                | ✅  |
| Index `idx_document_fields_review`                   | 1        | 1                                                                                                | ✅  |

## 3. Migration 166 — field conflicts

| Check                                                                   | Expected          | Actual                                                       | ✓   |
| ----------------------------------------------------------------------- | ----------------- | ------------------------------------------------------------ | --- |
| Table `documents.field_conflicts`                                       | exists            | exists                                                       | ✅  |
| Table `documents.field_conflict_items`                                  | exists            | exists                                                       | ✅  |
| FK `field_conflict_items.conflict_id → field_conflicts(id)`             | present           | `field_conflict_items_conflict_id_fkey`                      | ✅  |
| CHECK constraints                                                       | status + severity | `field_conflicts_status_chk`, `field_conflicts_severity_chk` | ✅  |
| Indexes `idx_field_conflicts_user`, `idx_field_conflict_items_conflict` | 2                 | present (in 4/4 set)                                         | ✅  |

## 4. Migration 167 — resume imports

| Check                                                          | Expected         | Actual                                                | ✓   |
| -------------------------------------------------------------- | ---------------- | ----------------------------------------------------- | --- |
| Table `documents.resume_items`                                 | exists           | exists                                                | ✅  |
| CHECK constraints                                              | section + review | `resume_items_section_chk`, `resume_items_review_chk` | ✅  |
| Indexes `idx_resume_items_user_doc`, `idx_resume_items_review` | 2                | present (in 4/4 set)                                  | ✅  |

**Index roll-up:** `idx_166_167_of_4 = 4` (all four 166/167 indexes present).

## 5. RLS — all three new tables

| Table                            | `relrowsecurity` | `relforcerowsecurity` | Policies                                                         |
| -------------------------------- | ---------------- | --------------------- | ---------------------------------------------------------------- |
| `documents.field_conflicts`      | true             | true                  | `users_own_field_conflicts`, `service_field_conflicts`           |
| `documents.field_conflict_items` | true             | true                  | `users_own_field_conflict_items`, `service_field_conflict_items` |
| `documents.resume_items`         | true             | true                  | `users_own_resume_items`, `service_resume_items`                 |

RLS **enabled and forced** on every new table; owner (`user_id = auth.uid()`) + service-role policies present — matches the 116-RLS pattern.

## 6. Backend tests

```
tests/test_conflicts.py tests/test_resume.py tests/test_document_provenance.py
tests/test_pdf_renderer.py tests/test_report_engine.py  →  58 passed in 0.28s
Full suite                                              →  594 passed in 3.84s
```

## 7. Non-mutation guarantees honored

- No `supabase db push` run.
- No drift repair beyond 165/166/167.
- `integration_audit` untouched (still partial — out of scope).
- No deploys. No unrelated work committed.
- Dry run (`BEGIN…ROLLBACK`) verified to persist nothing before the committed apply.

## Verdict: **ALL VALIDATIONS PASS**

</content>
