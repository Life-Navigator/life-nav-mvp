# Database Hardening Report

Sprint N.2 Phase 5 deliverable.

This report enumerates every database-layer change made during Sprint
N.2, with the rationale, the migration that closes each gap, and the
verifier that proves it.

## Summary

| Finding                                                   | Migration                                                                         | Verifier                                                          |
| --------------------------------------------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| 3 conflicting variants of migration 002                   | Consolidated `002_storage_buckets.sql` + `_archived/`                             | manual diff                                                       |
| Migration 005 created 14 tables without RLS               | Appended `ENABLE ROW LEVEL SECURITY` + self-test to `005_scenario_lab_schema.sql` | self-test inside the migration                                    |
| 90+ SECURITY DEFINER functions without pinned search_path | New `094_harden_security_definer_search_path.sql`                                 | dynamic enumeration + self-test inside the migration              |
| Missing verifiers for 090, 092, 093                       | N/A — see Phase 8                                                                 | `scripts/validation/verify_090_*.sql`, `_092_*.sql`, `_093_*.sql` |

## 1. Migration 002 consolidation

### Before

Three files with the same migration id `002_` co-existed in
`supabase/migrations/`:

| File                             | LOC | Difference                                                                             |
| -------------------------------- | --- | -------------------------------------------------------------------------------------- |
| `002_storage_buckets.sql`        | 153 | original; idempotent ON CONFLICT DO NOTHING; CREATE POLICY DDL inline                  |
| `002_storage_buckets_fixed.sql`  | 106 | upserts buckets with `DO UPDATE`; deferred policies to Dashboard UI                    |
| `002_storage_buckets_robust.sql` | 344 | production-grade settings (2 MB avatars, no `image/gif`); upserts buckets; no policies |

Risk: depending on which Supabase ordering picked, production could
end up with permissive (5 MB avatars + GIF) or restrictive (2 MB
no-GIF) buckets, and with or without policies.

### After

Single canonical `002_storage_buckets.sql` that:

- Uses the `_robust` variant's hardened bucket sizes (2 MB avatars,
  no `image/gif` on public buckets — GIF parsers have a long CVE
  history).
- Embeds the CREATE POLICY DDL with `DROP POLICY IF EXISTS` guards so
  re-runs converge.
- Adds the `ingestion` bucket (used by Sprint N.1 / N.2 multimodal
  upload) with a 2 GB cap, NULL `allowed_mime_types` (the application
  classifier gates), and owner-managed RLS.
- `ON CONFLICT (id) DO UPDATE` makes the migration idempotent.

The two superseded variants moved to
`supabase/migrations/_archived/` with `README.md` documenting the
consolidation rationale.

### Verification

```bash
ls supabase/migrations/002_*       # exactly one file
ls supabase/migrations/_archived/  # two files + README
```

## 2. Migration 005 RLS retrofit

### Before

`005_scenario_lab_schema.sql` created 14 public tables
(`scenario_labs`, `scenario_versions`, `scenario_documents`,
`scenario_extracted_fields`, `scenario_inputs`, `scenario_sim_runs`,
`scenario_goal_snapshots`, `plans`, `plan_phases`, `plan_tasks`,
`scenario_reports`, `scenario_pins`, `scenario_audit_log`,
`scenario_jobs`) without any `ENABLE ROW LEVEL SECURITY`. Migration
006 added RLS + policies, but the window between 005 and 006
applications was a theoretical leak.

### After

Appended at the end of 005:

```sql
ALTER TABLE public.scenario_labs              ENABLE ROW LEVEL SECURITY;
-- ... 13 more ...
ALTER TABLE public.scenario_jobs              ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE bad TEXT[];
BEGIN
  SELECT array_agg(c.relname) INTO bad
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r'
    AND c.relname IN (...the 14 names...)
    AND NOT c.relrowsecurity;
  IF bad IS NOT NULL AND array_length(bad, 1) > 0 THEN
    RAISE EXCEPTION '005 self-test: RLS missing on tables: %', bad;
  END IF;
END $$;
```

Fail-closed semantics: without policies, no SELECT works. Migration
006 still adds the per-policy grants that actually permit access.
The window between 005 and 006 is now safe.

### Idempotency

`ALTER TABLE ... ENABLE ROW LEVEL SECURITY` is a no-op when already
enabled, so re-running 005 is safe.

### Migration-drift caveat

Editing 005 in place will trigger a hash-mismatch warning in CLIs that
track migration hashes. Sprint N.2 accepted this risk because the
codebase has not yet been deployed to a long-lived production database.
Operators applying to an existing production database should run:

```bash
supabase migration repair --status applied 005
```

after pulling the Sprint N.2 changes.

## 3. SECURITY DEFINER search_path

### Before

90+ SECURITY DEFINER functions across `public`, `governance`,
`graphrag`, `ingestion`, `ops`, `platform`, `connectors`, `models`,
and `auth_ext` lacked an explicit `SET search_path = ...` clause.
This is the Supabase Linter's "Function Search Path Mutable" finding.

Risk: a SECURITY DEFINER function inherits the caller's `search_path`.
A malicious caller can shadow a built-in operator, function, or table
in a transient schema and weaponize the elevated privileges.

### After

`supabase/migrations/094_harden_security_definer_search_path.sql`
dynamically enumerates every SECURITY DEFINER function in the managed
schemas and runs:

```sql
ALTER FUNCTION <schema>.<fn>(<args>) SET search_path = public, pg_catalog, pg_temp;
```

`public, pg_catalog, pg_temp` is the safe Supabase default. `pg_temp`
last so transient temp schemas can't shadow the others.

### Self-test

The migration's second DO-block re-enumerates and raises an exception
if any SECURITY DEFINER function in those schemas is still missing
the pinned search_path. The migration fails to apply if the fix
doesn't take.

### Idempotency

Re-running 094 alters zero functions (because every function already
has `search_path` set in `proconfig`) and the self-test passes.

## 4. Verifier scripts for 090 / 092 / 093

New files in `scripts/validation/`:

- `verify_090_beta_ops_meter.sql` — schemas, tables, RLS on user-bound
  tables, public views, cost-meter integer constraint enforcement.
- `verify_092_multimodal_production.sql` — tables, RLS, enum check
  helpers, scanner/status/cost_kind CHECK enforcement, cross-user
  RLS leak test, public views.
- `verify_093_enterprise_foundation.sql` — schemas, tables, RLS,
  `platform.is_tenant_member` SECURITY DEFINER helper with pinned
  search_path, seed count (≥11 models + ≥12 connectors), cross-tenant
  RLS leak test, `tenant_api_keys.key_hash` uniqueness.

Each verifier wraps in `BEGIN; ... ROLLBACK;` so production rollouts
can run them in a smoke-test phase without leaving any trace.

## Operator runbook

```bash
# Apply migrations in order (Supabase will detect 005 hash mismatch
# in existing databases; run `migration repair` if so).
supabase db push

# Then run the three new verifiers against a copy of the prod DB.
psql "$DATABASE_URL" -f scripts/validation/verify_090_beta_ops_meter.sql
psql "$DATABASE_URL" -f scripts/validation/verify_092_multimodal_production.sql
psql "$DATABASE_URL" -f scripts/validation/verify_093_enterprise_foundation.sql

# Each script returns with no rows if successful; raises EXCEPTION
# on first failed assertion.
```

## What remains (deferred to subsequent sprints)

- `_archived/` migrations are kept for traceability only; CI should
  not apply them. Supabase ignores directories starting with `_` by
  default. Verify your CI does the same.
- Some non-managed-schema SECURITY DEFINER functions in
  `supabase_internal`, `pgmq`, `realtime` etc. are owned by Supabase
  and not in our migration scope.
- The "industry overlay" and "dedicated" graph projections for
  `platform.tenants.isolation_mode IN ('industry','dedicated')` are
  still queued for the Paid Pilot tier (see `FULL_SYSTEM_AUDIT_REPORT.md`
  §14).
