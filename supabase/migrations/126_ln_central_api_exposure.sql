-- 126_ln_central_api_exposure.sql — expose the `ln_central` reference schema via PostgREST.
--
-- The Compensation/Market engines read ln_central (compensation_bands, market_demand_
-- snapshots, …) through PostgREST with Accept-Profile, so the schema must be in
-- pgrst.db_schemas. (Missed in 125, which only added `career`.) As always (the H1 incident),
-- this lists the COMPLETE set — graphrag/finance/health/career all preserved.

GRANT USAGE ON SCHEMA ln_central TO authenticated, service_role, anon;  -- (also in 123; idempotent)

ALTER ROLE authenticator
  SET pgrst.db_schemas = 'public, graphql_public, storage, core, finance, graphrag, health_meta, health, career, ln_central';

NOTIFY pgrst, 'reload config';
NOTIFY pgrst, 'reload schema';
