-- 121_health_api_exposure.sql — expose the `health` schema to PostgREST + grant usage.
--
-- migration 119 granted table privileges but NOT schema USAGE, and `health` was not in
-- PostgREST's exposed-schema list, so Core API reads of health.* returned 403/406. This
-- migration fixes both, reproducibly.
--
-- IMPORTANT: the pgrst.db_schemas role setting OVERRIDES the project's PostgREST config,
-- so it MUST list EVERY exposed schema (notably `graphrag`, which the ingestion worker
-- uses for claim_sync_jobs — omitting it breaks the worker). Keep this list in sync with
-- supabase/config.toml `[api] schemas`.

-- Schema usage for the API roles (the missing grant from 119).
GRANT USAGE ON SCHEMA health TO authenticated, service_role, anon;

-- Expose schemas to PostgREST (full list incl. graphrag + health).
ALTER ROLE authenticator
  SET pgrst.db_schemas = 'public, graphql_public, storage, core, finance, graphrag, health_meta, health';

-- Tell PostgREST to reload its config + schema cache.
NOTIFY pgrst, 'reload config';
NOTIFY pgrst, 'reload schema';
