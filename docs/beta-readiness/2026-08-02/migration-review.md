# Migration Review — candidate `e8b0dac4`

**Reviewed:** 2026-07-31. **Applied:** NO. Prompt 0 forbids application.

Three migrations are new in this candidate. The brief named two; `20260728000000` is an additional
migration found during preflight and is reviewed here on the same terms.

**Overall risk: LOW.** All three are purely additive, all use `IF NOT EXISTS` / `ADD COLUMN IF NOT
EXISTS`, none drops or alters an existing column, none rewrites a large table, and all three are
safe to apply _before_ the application deployment.

---

## M1 — `20260728000000_advisor_turns_sources.sql`

**Not named in the brief. Reviewed anyway.**

| Aspect                                    | Finding                                                                                                                                                                                                                                          |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Objects changed                           | `analytics.advisor_turns`: **+1 column** `sources jsonb NOT NULL DEFAULT '[]'::jsonb`; +1 column comment                                                                                                                                         |
| Indexes / policies / triggers / functions | **none**                                                                                                                                                                                                                                         |
| Additive                                  | **YES**                                                                                                                                                                                                                                          |
| Locks / rewrites                          | **NO.** PostgreSQL 11+ adds a non-volatile-default column via catalog metadata only — no table rewrite. `ACCESS EXCLUSIVE` is held only momentarily. `advisor_turns` is an append-only analytics table; contention risk negligible at beta scale |
| Old app code compatible                   | **YES — verified at HEAD.** `_ADVISOR_TURNS_COLUMNS` (`advisor_orchestrator.py:172-180`) **deliberately excludes `"sources"`**, with an inline comment stating it must be added _only after_ this migration is applied                           |
| Apply before deploy                       | **YES — and it is safe in every ordering**, including applied-and-never-deployed, and deployed-and-never-applied                                                                                                                                 |
| Rollback                                  | `ALTER TABLE analytics.advisor_turns DROP COLUMN IF EXISTS sources;` — safe _only while_ `"sources"` is absent from the whitelist, which is the current state. Preferred: **no rollback needed**; leave the column in place                      |

**Why this migration is the safest of the three, and the most important to understand:** the file
documents a prior production incident — inserting a column the table lacks 400s the request and
**silently drops every turn from the durable audit table**. The whitelist exists because that
already happened. The migration is written so that neither ordering can reproduce it.

**Follow-up (NOT part of this release):** after this migration is applied and verified, add
`"sources"` to `_ADVISOR_TURNS_COLUMNS`. That is a separate, deliberately-sequenced change.

### Verification SQL

```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'analytics' AND table_name = 'advisor_turns' AND column_name = 'sources';
-- expect exactly 1 row: sources | jsonb | NO | '[]'::jsonb
```

---

## M2 — `20260731000000_advisor_response_reports.sql`

| Aspect                  | Finding                                                                                                                                                                                |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Schema                  | `CREATE SCHEMA IF NOT EXISTS feedback`                                                                                                                                                 |
| Table                   | **new** `feedback.advisor_response_reports` (28 columns)                                                                                                                               |
| Constraints             | PK `report_id`; CHECK on `category` (7 values), `severity` (5), `review_status` (5); CHECK `length(explanation) <= 4000`; **self-referencing FK** `duplicate_of → report_id`           |
| Indexes                 | 4 btree (`turn_idx`, `user_idx`, `triage_idx`, `release_idx`) + **1 partial unique** `(user_id, turn_id, category) WHERE review_status IN ('new','investigating')`                     |
| RLS                     | `ENABLE` + **`FORCE`** ROW LEVEL SECURITY                                                                                                                                              |
| Policies                | 1 — `service_advisor_response_reports` `FOR ALL TO service_role USING (true) WITH CHECK (true)`                                                                                        |
| Grants                  | `USAGE ON SCHEMA feedback`, `ALL ON` table — **`service_role` only**                                                                                                                   |
| Triggers / functions    | **none**                                                                                                                                                                               |
| Additive                | **YES** — creates only new objects                                                                                                                                                     |
| Locks / rewrites        | **NO** — new empty table                                                                                                                                                               |
| Old app code compatible | **YES** — pre-candidate code has no knowledge of this table and does not read or write it                                                                                              |
| Apply before deploy     | **YES** — required ordering. The table must exist before the deployed API writes to it                                                                                                 |
| Rollback                | `DROP TABLE IF EXISTS feedback.advisor_response_reports CASCADE;` — **destroys user-submitted reports**. Prefer forward-fix. Safe only in the window before any real report is written |

### Security review of M2 — the substantive points

**✅ Tenancy is resolved server-side.** `tenant_id` and `user_id` are both documented and commented as
resolved from the verified JWT and **never accepted from the client**. The column comment states this
explicitly on the table itself, which is where it survives.

**✅ No chain-of-thought persistence.** `llm_response_raw` is explicitly _never_ copied into a report.
Documented as design note 4 and enforced by the absence of the column.

**✅ Evidence snapshot is deliberate, not duplication-by-accident.** `question_snapshot` /
`response_snapshot` exist because `analytics.advisor_turns` is `service_role`-writable and therefore
**not provably immutable** — so a report preserves what the reporter actually saw. This is correct
reasoning and rare.

**⚠ FINDING M2-1 (accepted, documented, not blocking).** `turn_id` is `NOT NULL` but carries **no
foreign key** to `analytics.advisor_turns`. Cross-schema FK is possible in PostgreSQL, so this is a
choice. The migration explains the surrounding constraint (`advisor_turns` has no `tenant_id` column
and adding one is a separate data-contract decision). Consequence: a report can reference a
`turn_id` that does not exist, and orphan detection is the application's job. **Ownership is
enforced by joining the turn's `user_id` against the authenticated caller — this is exactly what R-1
must probe.** Not a launch blocker; it _is_ an R-1 test case.

**⚠ FINDING M2-2 (low).** `service_role`-only with `USING (true)` means the API is the sole guard.
This matches the existing `analytics.advisor_turns` posture and is internally consistent, but it
means **RLS provides no defense-in-depth here** — a bug in the API's identity resolution is
unmitigated by the database. R-1 must probe the API, not the table.

### Verification SQL

```sql
-- table + RLS forced
SELECT relname, relrowsecurity, relforcerowsecurity
FROM pg_class WHERE oid = 'feedback.advisor_response_reports'::regclass;
-- expect: advisor_response_reports | t | t

-- exactly one policy, service_role only
SELECT policyname, roles, cmd FROM pg_policies
WHERE schemaname = 'feedback' AND tablename = 'advisor_response_reports';
-- expect: service_advisor_response_reports | {service_role} | ALL

-- 5 indexes incl. the partial unique
SELECT indexname, indexdef FROM pg_indexes
WHERE schemaname = 'feedback' AND tablename = 'advisor_response_reports' ORDER BY indexname;
-- expect 5 rows + the PK constraint index

-- the 7 categories are enforced
SELECT pg_get_constraintdef(oid) FROM pg_constraint
WHERE conrelid = 'feedback.advisor_response_reports'::regclass AND contype = 'c'
  AND pg_get_constraintdef(oid) LIKE '%category%';
```

---

## M3 — `20260731010000_response_report_review.sql`

| Aspect                  | Finding                                                                                                        |
| ----------------------- | -------------------------------------------------------------------------------------------------------------- |
| Table                   | **new** `feedback.advisor_report_events` (10 columns)                                                          |
| Constraints             | PK `event_id`; **FK `report_id → feedback.advisor_response_reports(report_id)`**; CHECK on `action` (7 values) |
| Indexes                 | 2 btree (`report_idx`, `actor_idx`)                                                                            |
| RLS                     | `ENABLE` + **`FORCE`**                                                                                         |
| Policies                | 1 — `service_advisor_report_events`, `service_role` only                                                       |
| Grants                  | `ALL ON` table to `service_role`                                                                               |
| Additive                | **YES**                                                                                                        |
| Locks / rewrites        | **NO** — new empty table                                                                                       |
| Old app code compatible | **YES** — unknown to pre-candidate code                                                                        |
| Apply before deploy     | **YES**                                                                                                        |
| **Ordering**            | **MUST run after M2** — hard FK dependency. Timestamp ordering (`…731000000` < `…731010000`) is correct        |
| Rollback                | `DROP TABLE IF EXISTS feedback.advisor_report_events;` — must be dropped **before** M2 if both are reverted    |

**✅ Append-only separation is correct design.** Immutable evidence (M2) is separated from mutable
reviewer history (M3) so a status update can never overwrite prior history. The table comment states
no `UPDATE`/`DELETE` path exists in the application contract.

**⚠ FINDING M3-1 (low, note only).** Append-only is enforced by _application contract_, not by the
database — `service_role` holds `ALL`, so `UPDATE`/`DELETE` are physically possible. A `REVOKE
UPDATE, DELETE ON feedback.advisor_report_events FROM service_role` would make the claim structural
rather than aspirational. **Recommended, not blocking**; it would need verification that no code path
requires update.

**⚠ FINDING M3-2 (informational).** `actor_email` is `NOT NULL` free text — reviewer PII lands in an
audit table. Acceptable for internal reviewers; must be covered by the data-retention statement.

### Verification SQL

```sql
SELECT relname, relrowsecurity, relforcerowsecurity
FROM pg_class WHERE oid = 'feedback.advisor_report_events'::regclass;
-- expect: advisor_report_events | t | t

SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
WHERE conrelid = 'feedback.advisor_report_events'::regclass AND contype = 'f';
-- expect FK → feedback.advisor_response_reports(report_id)
```

---

## Combined apply order and gate

```
1. 20260728000000_advisor_turns_sources.sql       (independent, safest, any time)
2. 20260731000000_advisor_response_reports.sql    (must precede M3)
3. 20260731010000_response_report_review.sql      (FK depends on M2)
```

**All three may be applied before the application deploy. None requires a maintenance window. None
is destructive.**

**Backup requirement stands regardless:** confirm a Supabase PITR/backup timestamp immediately before
applying to the locked production environment, and record it in `evidence-index.md`.

## Apply mechanism (added by Prompt 1A)

`scripts/beta/apply_migrations.sh` applies these three in timestamp order and:

- requires an explicit `--env` (no default target)
- **refuses production unless `--i-am-sure-production` is ALSO passed** — two independent flags,
  because one flag is one typo away from production DDL
- supports `--dry-run` and `--status` with **no credentials required for the listing**
- prints filenames, never connection strings
- wraps each file in `--single-transaction -v ON_ERROR_STOP=1`, so a partial apply is impossible
- records applied versions to `evidence/migrations/applied-<env>.txt`
- **performs no automatic destructive rollback** — on failure it stops and points at `rollback-plan.md §4`

Verified 2026-07-31: refuses a missing `--env` (exit 1), refuses `--env production` without the
second flag (exit 1), and a staging dry run lists all three with **no DROP/TRUNCATE detected**.

> **Consequence of the shared data plane (see `staging-data-strategy.md`): applying these to
> "staging" IS applying them to production.** There is no separate Supabase project, so Prompt 1A
> could not apply them at all — rule 5 forbids production migrations. Authorisation belongs to a
> later prompt, after a PITR/backup timestamp is recorded per `rollback-plan.md §0`.

## Migration risk assessment — summary

| Migration                     | Additive | Destructive | Locks | Back-compat        | Risk    |
| ----------------------------- | -------- | ----------- | ----- | ------------------ | ------- |
| M1 `advisor_turns_sources`    | ✅       | ❌          | ❌    | ✅ both directions | **LOW** |
| M2 `advisor_response_reports` | ✅       | ❌          | ❌    | ✅                 | **LOW** |
| M3 `response_report_review`   | ✅       | ❌          | ❌    | ✅                 | **LOW** |

**No stop condition triggered by migration review.** Three findings recorded (M2-1, M3-1, M3-2), none
blocking; M2-1 converts into an R-1 probe case.
