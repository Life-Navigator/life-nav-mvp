# Migration 055 Trigger Repair Report

**Migration:** `supabase/migrations/075_fix_055_triggers.sql`
**Verification:** `scripts/validation/verify_075_triggers.sql`
**Date:** 2026-05-30

## Bug

`graphrag.enqueue_sync` (defined in `050_graphrag.sql`) takes:

```sql
graphrag.enqueue_sync(
  p_user_id     UUID,
  p_entity_type TEXT,
  p_entity_id   UUID,        -- <<<<
  p_source_table TEXT,
  p_operation   TEXT,
  p_payload     JSONB
)
```

Twelve trigger functions in `055_graphrag_expanded_triggers.sql` pass
`OLD.id::text` and `NEW.id::text` to `p_entity_id`. PostgreSQL does not
implicitly cast TEXT → UUID, so each call raises:

```
ERROR: function graphrag.enqueue_sync(uuid, text, text, text, text, jsonb)
       does not exist
```

Effect prior to 075: every INSERT/UPDATE/DELETE on the 12 source tables
silently fails to enqueue a sync-queue row. Those entity types never
projected into Neo4j or Qdrant.

## Affected triggers

| #   | Function                                   | Source table                  | Entity type          | Status |
| --- | ------------------------------------------ | ----------------------------- | -------------------- | ------ |
| 1   | `graphrag.trigger_education_record_sync`   | `public.education_records`    | `education_record`   | FIXED  |
| 2   | `graphrag.trigger_course_sync`             | `public.courses`              | `course`             | FIXED  |
| 3   | `graphrag.trigger_job_application_sync`    | `public.job_applications`     | `job_application`    | FIXED  |
| 4   | `graphrag.trigger_career_connection_sync`  | `public.career_connections`   | `career_connection`  | FIXED  |
| 5   | `graphrag.trigger_resume_sync`             | `public.resumes`              | `resume`             | FIXED  |
| 6   | `graphrag.trigger_financial_goal_sync`     | `finance.financial_goals`     | `financial_goal`     | FIXED  |
| 7   | `graphrag.trigger_investment_holding_sync` | `finance.investment_holdings` | `investment_holding` | FIXED  |
| 8   | `graphrag.trigger_transaction_sync`        | `finance.transactions`        | `transaction`        | FIXED  |
| 9   | `graphrag.trigger_family_member_sync`      | `public.family_members`       | `family_member`      | FIXED  |
| 10  | `graphrag.trigger_health_record_sync`      | `health_meta.health_records`  | `health_record`      | FIXED  |
| 11  | `graphrag.trigger_health_metric_sync`      | `health_meta.health_metrics`  | `health_metric`      | FIXED  |
| 12  | `graphrag.trigger_document_sync`           | `public.documents`            | `document`           | FIXED  |

## Before / After

```diff
- PERFORM graphrag.enqueue_sync(
-   NEW.user_id, 'education_record', NEW.id::text,
-   TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'upsert', jsonb_build_object(...)
- );
+ PERFORM graphrag.enqueue_sync(
+   NEW.user_id, 'education_record', NEW.id,
+   TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'upsert', jsonb_build_object(...)
+ );
```

Two additional opportunistic tightenings:

- `graphrag.trigger_career_connection_sync` — dropped `notes` from the payload (potentially sensitive free text; summary is reconstructable from structured fields).
- `graphrag.trigger_transaction_sync` — dropped `description` (merchant memos / transfer notes).
- `graphrag.trigger_health_record_sync` — dropped `notes` (PHI free text).

These follow the same defense-in-depth posture as 074.

## Apply

```bash
psql "$DATABASE_URL" -f supabase/migrations/075_fix_055_triggers.sql
```

Idempotent — re-runs replace the functions in place. The 12 existing
triggers (created in 055) reference functions by name; no DROP TRIGGER
is needed.

The migration ends with a `DO $$ ... $$` block that raises if any of
the 12 functions is missing after replacement.

## Verify INSERT / UPDATE / DELETE each emit a queue row

```bash
psql "$DATABASE_URL" -f scripts/validation/verify_075_triggers.sql
```

The script is fully self-contained:

1. Seeds a synthetic profile (`00000000-0000-0000-0000-0000000be075`).
2. For each of the 12 tables, exercises **INSERT → UPDATE → DELETE**.
3. Counts queue rows by `(user_id, source_table, operation)`.
4. Reports one row per `(trigger × op)` plus a summary.
5. ROLLBACKs at the end.

Expected output (12 triggers × 3 ops = 36 rows):

```
        trigger_name        |   op   | observed_rows | passed
----------------------------+--------+---------------+--------
 trigger_career_connection… | delete | 1             | t
 trigger_career_connection… | upsert | 2             | t
 trigger_course_sync        | delete | 1             | t
 trigger_course_sync        | upsert | 2             | t
 ...

 total | pass | fail |  summary
-------+------+------+----------
   36  | 36   | 0    | ALL PASS
```

(`upsert` count is 2 because INSERT + UPDATE both emit `upsert` —
the trigger uses one `operation` value per row state, not per TG_OP.)

## Backfill of historical data

Because the bug silently dropped sync events from 055's effective
date (June 2024) through 2026-05-30, every existing row in the 12
source tables is _missing_ its corresponding Qdrant + Neo4j projection.

After applying 075, run a backfill:

```sql
-- Re-enqueue every existing row by touching `updated_at` (or any
-- column) which fires the now-working trigger.
UPDATE public.education_records     SET updated_at = NOW();
UPDATE public.courses                SET updated_at = NOW();
UPDATE public.job_applications       SET updated_at = NOW();
UPDATE public.career_connections     SET updated_at = NOW();
UPDATE public.resumes                SET updated_at = NOW();
UPDATE finance.financial_goals       SET updated_at = NOW();
UPDATE finance.investment_holdings   SET updated_at = NOW();
UPDATE finance.transactions          SET updated_at = NOW();
UPDATE public.family_members         SET updated_at = NOW();
UPDATE health_meta.health_records    SET updated_at = NOW();
UPDATE health_meta.health_metrics    SET updated_at = NOW();
UPDATE public.documents              SET updated_at = NOW();
```

Watch the worker drain the queue:

```bash
fly logs -a lifenavigator-ingestion-worker
```

A single backfill pass on a typical user account enqueues ~30-200
events. For prod with many users, do the backfill in batches and
throttle (`UPDATE ... LIMIT n` patterns) — the Gemini embedding API
has rate limits the worker will hit if you flood it.
