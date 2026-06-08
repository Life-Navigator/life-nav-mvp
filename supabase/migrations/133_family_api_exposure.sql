-- 133_family_api_exposure.sql — expose the `family` schema via PostgREST.
-- The H1 incident: pgrst.db_schemas OVERRIDES project config, so list the COMPLETE set.
-- Appends `family`, preserving public/graphql_public/storage/core/finance/graphrag/
-- health_meta/health/career/ln_central/education. graphrag stays exposed.

GRANT USAGE ON SCHEMA family TO authenticated, service_role, anon;  -- (also in 131; idempotent)

ALTER ROLE authenticator
  SET pgrst.db_schemas = 'public, graphql_public, storage, core, finance, graphrag, health_meta, health, career, ln_central, education, family';

NOTIFY pgrst, 'reload config';
NOTIFY pgrst, 'reload schema';
