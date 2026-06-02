# Archived migrations

Files in this directory are NOT applied by `supabase db push` (Supabase only
scans the parent `migrations/` directory) and exist purely for historical
traceability.

## Why files end up here

A migration is moved here when it has been **superseded by a canonical
version with the same migration id** — i.e. the migration was authored
multiple times in parallel and the platform-hardening sprint consolidated
the variants.

The canonical version lives one directory up.

## Index

### 002*storage_buckets*\*.sql

Three variants existed:

| File                             | Purpose                                                               |
| -------------------------------- | --------------------------------------------------------------------- |
| `002_storage_buckets_fixed.sql`  | Buckets only; policies deferred to Supabase Dashboard UI              |
| `002_storage_buckets_robust.sql` | Buckets with hardened settings (smaller avatars, no GIF), no policies |

Sprint N.2 consolidated these into the canonical
`../002_storage_buckets.sql` which:

- uses the robust variant's production-grade bucket sizes,
- drops `image/gif` from public buckets (security: GIF parsers have a long
  CVE history),
- writes the CREATE POLICY DDL inline so the migration is reproducible
  without Dashboard UI steps,
- adds the `ingestion` bucket so Sprint N.2's upload pipeline can locate
  its target,
- uses `DROP POLICY IF EXISTS` + `CREATE POLICY` so re-runs converge on the
  canonical state.
