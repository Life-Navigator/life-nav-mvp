# Migration Rollback Plan

**Date:** 2026-06-17 · Both migrations are additive, so rollback is a clean drop of what they added. No data restore needed (no existing data is altered or deleted).

## Apply (for reference)

Both are plain SQL run against the prod DB **with a ROTATED credential** (never the compromised PAT). Options:

- `supabase login` (rotated PAT) → `supabase db push` (applies pending migrations in order), **or**
- Supabase Management API: `POST https://api.supabase.com/v1/projects/<ref>/database/query` with the rotated PAT, body = the migration SQL, **or**
- Supabase SQL editor (paste the file).

Wrap each in a transaction where possible and run inside a low-traffic window.

## Rollback — `20260617130000_pilot_feedback_metrics.sql`

```sql
BEGIN;
DROP INDEX IF EXISTS analytics.pilot_feedback_kind_idx;
ALTER TABLE analytics.pilot_feedback DROP COLUMN IF EXISTS kind;
ALTER TABLE analytics.pilot_feedback DROP COLUMN IF EXISTS metrics;
ALTER TABLE analytics.pilot_feedback DROP COLUMN IF EXISTS context;
ALTER TABLE analytics.pilot_feedback DROP COLUMN IF EXISTS insight_detected;
ALTER TABLE analytics.pilot_feedback DROP COLUMN IF EXISTS surprised;
NOTIFY pgrst, 'reload schema';
COMMIT;
```

Effect: reverts `pilot_feedback` to its `20260616120000` shape. Legacy feedback rows are untouched. The `FeedbackService` resilient-insert fallback resumes (new fields accepted-not-stored).

## Rollback — `20260616160000_mcp_ingestion.sql`

```sql
BEGIN;
-- new tables
DROP TABLE IF EXISTS life.relationships;
DROP TABLE IF EXISTS life.facts;
-- provenance columns added to existing tables
ALTER TABLE life.candidate_goals DROP COLUMN IF EXISTS confirmation_status;
ALTER TABLE life.candidate_goals DROP COLUMN IF EXISTS source;
ALTER TABLE life.candidate_goals DROP COLUMN IF EXISTS provenance;
ALTER TABLE life.candidate_goals DROP COLUMN IF EXISTS idempotency_key;
ALTER TABLE life.risks         DROP COLUMN IF EXISTS confidence, DROP COLUMN IF EXISTS confirmation_status,
                               DROP COLUMN IF EXISTS source, DROP COLUMN IF EXISTS provenance, DROP COLUMN IF EXISTS idempotency_key;
ALTER TABLE life.opportunities DROP COLUMN IF EXISTS confidence, DROP COLUMN IF EXISTS confirmation_status,
                               DROP COLUMN IF EXISTS source, DROP COLUMN IF EXISTS provenance, DROP COLUMN IF EXISTS idempotency_key;
ALTER TABLE life.constraints   DROP COLUMN IF EXISTS confidence, DROP COLUMN IF EXISTS confirmation_status,
                               DROP COLUMN IF EXISTS source, DROP COLUMN IF EXISTS provenance, DROP COLUMN IF EXISTS idempotency_key;
NOTIFY pgrst, 'reload schema';
COMMIT;
```

⚠️ Dropping `life.facts`/`life.relationships` discards any MCP-submitted rows. Only roll back if no real submissions exist, or export them first:

```sql
\copy (SELECT * FROM life.facts) TO 'facts_backup.csv' CSV HEADER;
\copy (SELECT * FROM life.relationships) TO 'relationships_backup.csv' CSV HEADER;
```

## Validation after rollback

1. `GET /healthz` → 200.
2. `GET /v1/life/my-life`, `/v1/life/goals`, `POST /v1/feedback` → 401 anon / 200 for a valid user (no 500s).
3. Confirm the dropped columns/tables are gone (`information_schema`); PostgREST schema reloaded.
4. Re-run core-api suite → green (services degrade gracefully without the columns).

## Failure-mid-apply

Because every statement is `IF [NOT] EXISTS`, a re-run is safe and a partial apply is recoverable by re-running the migration (to finish) or the rollback (to revert). No manual state reconciliation required.
