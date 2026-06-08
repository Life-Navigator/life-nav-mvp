-- 129_education_api_exposure.sql — expose the `education` schema via PostgREST.
--
-- IMPORTANT (the H1 incident): pgrst.db_schemas OVERRIDES the project config, so it MUST
-- list the COMPLETE set. This appends `education`, preserving public/graphql_public/storage/
-- core/finance/graphrag/health_meta/health/career/ln_central. graphrag stays exposed.

GRANT USAGE ON SCHEMA education TO authenticated, service_role, anon;  -- (also in 127; idempotent)

ALTER ROLE authenticator
  SET pgrst.db_schemas = 'public, graphql_public, storage, core, finance, graphrag, health_meta, health, career, ln_central, education';

NOTIFY pgrst, 'reload config';
NOTIFY pgrst, 'reload schema';
