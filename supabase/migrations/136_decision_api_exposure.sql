-- 136_decision_api_exposure.sql — expose the `decision` schema via PostgREST.
-- The H1 incident: pgrst.db_schemas OVERRIDES project config, so list the COMPLETE set.
GRANT USAGE ON SCHEMA decision TO authenticated, service_role, anon;  -- (also in 134; idempotent)
ALTER ROLE authenticator
  SET pgrst.db_schemas = 'public, graphql_public, storage, core, finance, graphrag, health_meta, health, career, ln_central, education, family, decision';
NOTIFY pgrst, 'reload config';
NOTIFY pgrst, 'reload schema';
