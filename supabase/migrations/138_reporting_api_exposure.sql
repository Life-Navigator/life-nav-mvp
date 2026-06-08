-- 138_reporting_api_exposure.sql — expose `reporting` via PostgREST (full list preserved).
GRANT USAGE ON SCHEMA reporting TO authenticated, service_role, anon;
ALTER ROLE authenticator
  SET pgrst.db_schemas = 'public, graphql_public, storage, core, finance, graphrag, health_meta, health, career, ln_central, education, family, decision, reporting';
NOTIFY pgrst, 'reload config';
NOTIFY pgrst, 'reload schema';
