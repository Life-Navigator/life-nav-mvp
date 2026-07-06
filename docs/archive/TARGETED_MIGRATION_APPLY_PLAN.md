# TARGETED_MIGRATION_APPLY_PLAN.md — Phase 4

**Goal:** apply the genuinely-missing migrations that unlock document intelligence / provenance / conflict / resume — **without** triggering `db push`'s 105→167 cascade.

> ⚠️ Nothing here is executed. For approval only.

## Migrations to apply

| Order | Migration                          | Creates                                                                                       | Depends on                              | Status                          |
| ----- | ---------------------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------- | ------------------------------- |
| 1     | `165_document_field_provenance`    | 7 columns on `documents.document_fields` + 1 check constraint + 1 index + idempotent backfill | `documents.document_fields` (✅ exists) | **APPLY**                       |
| 2     | `166_field_conflicts`              | `documents.field_conflicts`, `documents.field_conflict_items` + 2 idx + RLS                   | none (self-contained)                   | **APPLY**                       |
| 3     | `167_resume_imports`               | `documents.resume_items` + 2 idx + RLS                                                        | none (self-contained)                   | **APPLY**                       |
| —     | `20260617120000_integration_audit` | `core.integration_audit_log` + `core.log_integration_event()`                                 | schema `core` (✅ exists)               | **HOLD — BLOCKED_NEEDS_REVIEW** |

**Dependency order:** 165 → 166 → 167 (numeric). No hard FKs between them; `field_conflict_items` references `field_conflicts(id)` (created in the same file). Order is for cleanliness, not correctness.

**`integration_audit` held back:** it is the only partially-applied migration (schema present, table+function absent), it is **not required** for the doc-intelligence features (it logs Google/MS OAuth integration events — OAuth is gated/deferred), and its idempotency was not fully confirmed (`CREATE SCHEMA core` vs existing `core`). Decide separately.

## Why NOT `supabase db push`

`db push`/`db push --include-all` would apply **everything from 105** (see DRY_RUN report) — 50+ already-applied migrations incl. force-RLS and destructive ones. The two safe execution paths below bypass that.

### Recommended path: **direct SQL apply of the three idempotent files**

All three use `ADD COLUMN IF NOT EXISTS` / `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS` / `DROP POLICY IF EXISTS … CREATE POLICY` / constraint-existence guards — safe even if partially present.

**Dry-run (no apply) — transaction that rolls back:**

```bash
# psql via the linked pooler (needs DB password) OR Management API. Wrap in a rollback to preview.
psql "$SUPABASE_DB_URL" -1 -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;
\i supabase/migrations/165_document_field_provenance.sql
\i supabase/migrations/166_field_conflicts.sql
\i supabase/migrations/167_resume_imports.sql
ROLLBACK;   -- preview only; proves no errors, applies nothing
SQL
```

**Apply (after approval):**

```bash
psql "$SUPABASE_DB_URL" -1 -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;
\i supabase/migrations/165_document_field_provenance.sql
\i supabase/migrations/166_field_conflicts.sql
\i supabase/migrations/167_resume_imports.sql
COMMIT;
SQL
```

Then record history (Phase 3 Tier A): `supabase migration repair --status applied 165 166 167 --linked`.

### Alternative path: **repair-then-push (Supabase-native)**

1. Repair-mark all present-but-unrecorded migrations (Phase 3 Tier B) so history = reality.
2. `supabase db push --dry-run --linked` → pending should reduce to exactly `165 166 167` (+ `20260617120000` if included).
3. `supabase db push --linked` applies only those.
   This is cleaner long-term but requires the full Tier-B repair first; otherwise push still cascades.

## Expected schema delta (apply of 165/166/167)

- `documents.document_fields`: +7 columns (`page_number, section, char_start, char_end, extraction_method, extracted_at, review_status`), +1 CHECK (`review_status ∈ {extracted,needs_review,user_confirmed,user_edited,rejected}`), +1 index, low-confidence rows (`confidence<0.6`) re-flagged `needs_review`.
- `documents.field_conflicts` (16 cols, 2 CHECKs), `documents.field_conflict_items` (15 cols, FK→field_conflicts) + 2 indexes + FORCE RLS + owner/service policies + grants.
- `documents.resume_items` (15 cols, 2 CHECKs) + 2 indexes + FORCE RLS + owner/service policies + grants.
- **No drops, no data deletion, no changes to existing columns.**

## Post-apply validation queries

```sql
-- 165
SELECT count(*) AS provenance_cols FROM information_schema.columns
 WHERE table_schema='documents' AND table_name='document_fields'
   AND column_name IN ('page_number','section','char_start','char_end','extraction_method','extracted_at','review_status'); -- expect 7
SELECT conname FROM pg_constraint WHERE conname='document_fields_review_status_chk';                                       -- expect 1 row
-- 166 / 167
SELECT to_regclass('documents.field_conflicts'), to_regclass('documents.field_conflict_items'), to_regclass('documents.resume_items'); -- all non-null
-- RLS on the new tables
SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class
 WHERE relname IN ('field_conflicts','field_conflict_items','resume_items');  -- rls + force = true
-- history recorded
SELECT version FROM supabase_migrations.schema_migrations WHERE version IN ('165','166','167'); -- expect 3 rows
```

## Rollback (if needed, post-apply)

```sql
-- 167 / 166 (new tables — safe drop; no prod data yet)
DROP TABLE IF EXISTS documents.resume_items;
DROP TABLE IF EXISTS documents.field_conflict_items;
DROP TABLE IF EXISTS documents.field_conflicts;
-- 165 (new columns — drop the additions)
ALTER TABLE documents.document_fields
  DROP COLUMN IF EXISTS page_number, DROP COLUMN IF EXISTS section, DROP COLUMN IF EXISTS char_start,
  DROP COLUMN IF EXISTS char_end, DROP COLUMN IF EXISTS extraction_method,
  DROP COLUMN IF EXISTS extracted_at, DROP COLUMN IF EXISTS review_status;
ALTER TABLE documents.document_fields DROP CONSTRAINT IF EXISTS document_fields_review_status_chk;
-- then: supabase migration repair --status reverted 165 166 167 --linked
```

Note: 165's backfill flips some `review_status` to `needs_review`; rollback drops the column entirely, so the flag disappears with it (no residual state).
</content>
