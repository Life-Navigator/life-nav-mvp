-- 125_career_api_exposure.sql — expose the `career` schema via PostgREST.
--
-- IMPORTANT (the H1 incident): the pgrst.db_schemas role setting OVERRIDES the project
-- config, so it MUST list the COMPLETE schema set. Dropping `graphrag` here would break
-- the worker's claim_sync_jobs again. This migration appends `career` to the full list,
-- preserving public/graphql_public/storage/core/finance/graphrag/health_meta/health.

GRANT USAGE ON SCHEMA career TO authenticated, service_role, anon;  -- (also set in 122; idempotent)

ALTER ROLE authenticator
  SET pgrst.db_schemas = 'public, graphql_public, storage, core, finance, graphrag, health_meta, health, career';

-- Reload PostgREST so the new schema + role setting take effect.
NOTIFY pgrst, 'reload config';
NOTIFY pgrst, 'reload schema';
