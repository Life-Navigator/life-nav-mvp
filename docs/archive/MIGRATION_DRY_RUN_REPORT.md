# MIGRATION_DRY_RUN_REPORT.md — Phase 5

**Read-only.** No migrations applied. Two dry surfaces captured: (A) the native `db push --dry-run`, and (B) the targeted object-level verification that stands in for a per-statement dry run of 165/166/167.

## A) `supabase db push --dry-run --linked`

**Command:**

```bash
SUPABASE_ACCESS_TOKEN=*** supabase db push --dry-run --linked
```

**Output (verbatim, trimmed):**

```
DRY RUN: migrations will *not* be pushed to the database.
Connecting to remote database...
Skipping migration 143b_documents_exposure.sql... (file name must match pattern "<timestamp>_name.sql")
Skipping migration 146b_platform_exposure.sql... (file name must match pattern "<timestamp>_name.sql")
Skipping migration 148b_reco_exposure.sql... (file name must match pattern "<timestamp>_name.sql")
Found local migration files to be inserted before the last migration on remote database.

Rerun the command with --include-all flag to apply these migrations:
supabase/migrations/105_finance_graphrag_api_grants.sql
supabase/migrations/106_finance_plaid_unique_indexes.sql
... (continuous) ...
supabase/migrations/149_force_rls_and_reco_quality.sql
supabase/migrations/150_force_rls_all_user_tables.sql
...
supabase/migrations/158_force_rls_public_user_tables.sql
supabase/migrations/159_deprecate_orphaned_truth_tables.sql
supabase/migrations/160_advisor_turns.sql
[continues with 164–167 + the 2026* timestamped set]
```

**Expected changes if run with `--include-all`:** apply **~55+ migrations from `105` onward**, the vast majority of whose objects **already exist** in prod (verified Phase 2).

**Warnings / errors surfaced:**

- "Found local migration files to be inserted before the last migration on remote database" — the **out-of-order insertion** warning. Remote's recorded baseline is `163`; everything from `105` is unrecorded and sorts before it.
- Three `Skipping migration …` notices for `143b/146b/148b` (non-timestamp filenames the CLI ignores).

## 🛑 STOP CONDITION TRIGGERED

The Phase-5 rule says: _"If dry-run indicates relation already exists or ordering risk: STOP."_

- **Ordering risk:** explicitly reported (insert-before-remote).
- **Relation-already-exists risk:** certain — Phase 2 proved `analytics.advisor_turns`, all `family.*`, `chat.projects`, `finance.asset_documents`, `life.facts`, etc. already exist, yet push would re-run their `CREATE` migrations.
- **Destructive risk:** the set includes `159_deprecate_orphaned_truth_tables` and three force-RLS migrations (`149/150/158`).

**Therefore `supabase db push` / `--include-all` is REJECTED as the apply mechanism.** Proceed only via the targeted path in TARGETED_MIGRATION_APPLY_PLAN.md.

## B) Targeted preview for 165 / 166 / 167

A true transactional dry run (`BEGIN; \i 165; \i 166; \i 167; ROLLBACK;`) requires the DB connection string and was **not executed** (kept to read-only verification this phase). In its place, object-level checks establish the apply is conflict-free:

| Check                                                  | Result                                                                     | Implication for apply                       |
| ------------------------------------------------------ | -------------------------------------------------------------------------- | ------------------------------------------- |
| `documents.document_fields` exists                     | ✅                                                                         | 165 `ALTER … ADD COLUMN` has a valid target |
| 165's 7 columns / constraint / index                   | ❌ absent                                                                  | clean create, no collision                  |
| `documents.field_conflicts*`, `documents.resume_items` | ❌ absent                                                                  | clean create, no collision                  |
| 165/166/167 SQL idempotency                            | ✅ all use `IF NOT EXISTS` / guarded constraints / `DROP POLICY IF EXISTS` | re-runnable, no "already exists" failures   |
| Cross-deps on unrecorded migrations                    | none                                                                       | safe to apply in isolation                  |

**Predicted result of the targeted apply:** success, additive-only delta (see apply plan), zero errors, zero data loss.

**Recommended real dry-run before apply (needs `SUPABASE_DB_URL`):**

```bash
psql "$SUPABASE_DB_URL" -1 -v ON_ERROR_STOP=1 \
  -c 'BEGIN;' -f supabase/migrations/165_document_field_provenance.sql \
  -f supabase/migrations/166_field_conflicts.sql \
  -f supabase/migrations/167_resume_imports.sql -c 'ROLLBACK;'
```

Run this and confirm a clean `ROLLBACK` before the committed apply.
</content>
