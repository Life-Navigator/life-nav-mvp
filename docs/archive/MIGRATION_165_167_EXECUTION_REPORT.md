# MIGRATION_165_167_EXECUTION_REPORT.md

**Date:** 2026-06-21 · **Operator:** Claude (Management API path) · **Approver:** Timothy Riffe
**Prod DB:** Supabase `diwkyyahglnqmyledsey` · **Branch:** `fix/dashboard-advisor-mode-and-floating-chat`

## Mission

Apply only the genuinely-missing migrations `165` (document field provenance), `166` (field conflicts), `167` (resume imports) to production, reconcile their history, validate, and test — without `db push`, without touching drift or `integration_audit`, without deploys.

## Execution timeline

### Step 1 — Commit migrations (git)

Committed exactly three files (nothing else):

```
40cb485 feat(documents): provenance + conflict + resume migrations (165-167)
  supabase/migrations/165_document_field_provenance.sql
  supabase/migrations/166_field_conflicts.sql
  supabase/migrations/167_resume_imports.sql
```

They were previously untracked working-tree files; now reproducible from git.

### Step 2 — Transaction-control probe

Confirmed the Supabase Management API honors transaction control: `BEGIN; CREATE TABLE public._dryrun_probe…; ROLLBACK;` → `to_regclass('public._dryrun_probe') = false` (rolled back). This made `BEGIN…ROLLBACK` a trustworthy dry run.

### Step 3 — Dry run (no mutation)

`BEGIN;` + 165 + 166 + 167 + `ROLLBACK;` (9,495 bytes) via Management API → executed with **no error**. Post-check: `f165_cols=0, field_conflicts=false, field_conflict_items=false, resume_items=false` → **nothing persisted**. Dry run PASSED.

### Step 4 — Apply (committed)

`BEGIN;` + 165 + 166 + 167 + `COMMIT;` via Management API → **no error**. Immediate check: `f165_cols_of_7=7, field_conflicts=true, field_conflict_items=true, resume_items=true`. Single atomic transaction; all-or-nothing.

### Step 5 — History repair (165/166/167 only)

```
supabase migration repair --status applied 165 166 167 --linked
→ Repaired migration history: [165 166 167] => applied
```

Verified: history now lists `165 document_field_provenance`, `166 field_conflicts`, `167 resume_imports`. No other versions touched.

### Step 6 — Validation

See POST_APPLY_VALIDATION.md. All object/RLS/index/constraint checks pass (7/7 columns, both conflict tables + items, resume table, FK, 5 CHECK constraints, RLS+FORCE on all 3 tables, owner+service policies, 4/4 indexes).

### Step 7 — Tests

`58 passed` (conflicts/resume/provenance/pdf/report) · `594 passed` (full backend suite). No regressions.

## Schema delta applied to production

- `documents.document_fields`: **+7 columns** (`page_number, section, char_start, char_end, extraction_method, extracted_at, review_status`), **+1 CHECK** (`document_fields_review_status_chk`), **+1 index** (`idx_document_fields_review`), idempotent backfill flipping low-confidence (`<0.6`) rows to `needs_review`.
- `documents.field_conflicts` (+CHECKs status/severity), `documents.field_conflict_items` (+FK→field_conflicts) — **2 new tables**, 2 indexes, RLS+FORCE, owner/service policies, grants.
- `documents.resume_items` — **1 new table** (+CHECKs section/review), 2 indexes, RLS+FORCE, owner/service policies, grants.
- **No drops. No data deletion. No changes to existing columns.**

## Boundaries honored

| Constraint                          | Status                              |
| ----------------------------------- | ----------------------------------- |
| Commit 165/166/167 first            | ✅ (40cb485)                        |
| Dry run before apply                | ✅ (rolled back, persisted nothing) |
| Apply 165/166/167 only              | ✅                                  |
| Repair history for 165/166/167 only | ✅                                  |
| Do NOT run `supabase db push`       | ✅ not run                          |
| Do NOT repair drifted migrations    | ✅ 160/164/timestamped untouched    |
| Do NOT touch `integration_audit`    | ✅ still partial, untouched         |
| Do NOT deploy unrelated work        | ✅ no deploys; only 3-file commit   |

## Rollback (if ever needed)

```sql
DROP TABLE IF EXISTS documents.resume_items;
DROP TABLE IF EXISTS documents.field_conflict_items;
DROP TABLE IF EXISTS documents.field_conflicts;
ALTER TABLE documents.document_fields
  DROP COLUMN IF EXISTS page_number, DROP COLUMN IF EXISTS section, DROP COLUMN IF EXISTS char_start,
  DROP COLUMN IF EXISTS char_end, DROP COLUMN IF EXISTS extraction_method,
  DROP COLUMN IF EXISTS extracted_at, DROP COLUMN IF EXISTS review_status;
ALTER TABLE documents.document_fields DROP CONSTRAINT IF EXISTS document_fields_review_status_chk;
```

then `supabase migration repair --status reverted 165 166 167 --linked`. Safe — new objects, no prod data.

## Features unlocked

Document-field **provenance** (page/section/char-span + confidence + confirm/edit/reject review loop), **conflict detection** (contested facts flagged with both sources, no silent overwrite), **resume import** (staged reviewable items → domain tables).

## Follow-ups (NOT done here — separate decisions)

1. **Drift repair** (160/164 + timestamped) so future `db push` is safe — recommended hygiene sprint (MIGRATION_REPAIR_PLAN Tier B).
2. **`integration_audit`** partial state — apply or revert separately (BLOCKED_NEEDS_REVIEW).
3. **Rotate** the shared Supabase access token + Vercel token (plaintext in transcript).
4. The commit `40cb485` is local on the branch — push when ready (no push performed).

---

# FINAL STATUS: **MIGRATIONS_165_167_APPLIED**

</content>
