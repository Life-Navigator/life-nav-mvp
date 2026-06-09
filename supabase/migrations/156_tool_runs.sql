-- 156 — Sprint 38: deterministic tool platform. Every tool run is a first-class, persisted,
-- auditable entity (inputs -> outputs + assumptions + confidence + limitations). No LLM numbers.
CREATE SCHEMA IF NOT EXISTS tools;
CREATE TABLE IF NOT EXISTS tools.tool_runs (
  tool_run_id UUID PRIMARY KEY, user_id UUID NOT NULL, tenant_id UUID NOT NULL,
  tool TEXT NOT NULL, scenario_id TEXT, objective_id UUID,
  inputs JSONB NOT NULL DEFAULT '{}'::jsonb, outputs JSONB NOT NULL DEFAULT '{}'::jsonb,
  assumptions JSONB NOT NULL DEFAULT '[]'::jsonb, confidence NUMERIC,
  limitations JSONB NOT NULL DEFAULT '[]'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS idx_tool_runs_user ON tools.tool_runs(user_id, tool, created_at DESC);
ALTER TABLE tools.tool_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE tools.tool_runs FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS own_tool_runs ON tools.tool_runs;
CREATE POLICY own_tool_runs ON tools.tool_runs FOR ALL TO authenticated USING (user_id=auth.uid()) WITH CHECK (user_id=auth.uid());
DROP POLICY IF EXISTS svc_tool_runs ON tools.tool_runs;
CREATE POLICY svc_tool_runs ON tools.tool_runs FOR ALL TO service_role USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON tools.tool_runs TO authenticated;
GRANT ALL ON tools.tool_runs TO service_role;
GRANT USAGE ON SCHEMA tools TO authenticated, service_role, anon;
ALTER ROLE authenticator SET pgrst.db_schemas = 'public, graphql_public, storage, core, finance, graphrag, health_meta, health, career, ln_central, education, family, decision, reporting, analytics, documents, platform, recommendations, life, tools';
NOTIFY pgrst, 'reload config'; NOTIFY pgrst, 'reload schema';
