-- 154 — Sprint 33: Life Discovery & Personal Life Graph. First-class life objects: the need behind
-- the need. Objectives carry the user's why-chain; goals hang off objectives; dependencies model
-- cross-domain requirements; risks/opportunities/events/motivations complete the graph. 116-RLS.
CREATE SCHEMA IF NOT EXISTS life;

CREATE TABLE IF NOT EXISTS life.life_vision (
  user_id UUID PRIMARY KEY, tenant_id UUID NOT NULL,
  vision_text TEXT, prompts JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());

CREATE TABLE IF NOT EXISTS life.life_objectives (
  id UUID PRIMARY KEY, user_id UUID NOT NULL, tenant_id UUID NOT NULL,
  title TEXT NOT NULL, root_objective_key TEXT, surface_goal TEXT,
  why_chain JSONB NOT NULL DEFAULT '[]'::jsonb,   -- the 5-whys: [{q,a}] discovering the real need
  domain TEXT, importance TEXT DEFAULT 'high', created_at TIMESTAMPTZ NOT NULL DEFAULT now());

CREATE TABLE IF NOT EXISTS life.goals (
  id UUID PRIMARY KEY, user_id UUID NOT NULL, tenant_id UUID NOT NULL,
  objective_id UUID, title TEXT NOT NULL, domain TEXT, target_date DATE, status TEXT DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now());

CREATE TABLE IF NOT EXISTS life.dependencies (
  id UUID PRIMARY KEY, user_id UUID NOT NULL, tenant_id UUID NOT NULL,
  objective_id UUID NOT NULL, label TEXT NOT NULL, domain TEXT, satisfied BOOLEAN,
  prompt TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now());

CREATE TABLE IF NOT EXISTS life.risks (
  id UUID PRIMARY KEY, user_id UUID NOT NULL, tenant_id UUID NOT NULL,
  objective_id UUID, label TEXT NOT NULL, domain TEXT, severity TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now());

CREATE TABLE IF NOT EXISTS life.opportunities (
  id UUID PRIMARY KEY, user_id UUID NOT NULL, tenant_id UUID NOT NULL,
  objective_id UUID, label TEXT NOT NULL, domain TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now());

CREATE TABLE IF NOT EXISTS life.life_events (
  id UUID PRIMARY KEY, user_id UUID NOT NULL, tenant_id UUID NOT NULL,
  event_type TEXT NOT NULL, event_date DATE, importance TEXT, dependencies JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now());

CREATE TABLE IF NOT EXISTS life.motivations (
  id UUID PRIMARY KEY, user_id UUID NOT NULL, tenant_id UUID NOT NULL,
  objective_id UUID, text TEXT NOT NULL, kind TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now());

CREATE TABLE IF NOT EXISTS life.risk_profiles (
  user_id UUID PRIMARY KEY, tenant_id UUID NOT NULL,
  tolerance INT, capacity INT, behavior TEXT, horizon_years INT, loss_aversion INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now());

CREATE INDEX IF NOT EXISTS idx_life_obj_user ON life.life_objectives(user_id);
CREATE INDEX IF NOT EXISTS idx_life_dep_obj ON life.dependencies(objective_id);

DO $$ DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['life_vision','life_objectives','goals','dependencies','risks','opportunities','life_events','motivations','risk_profiles'] LOOP
    EXECUTE format('ALTER TABLE life.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE life.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format($p$DROP POLICY IF EXISTS own_%1$s ON life.%1$I$p$, t);
    EXECUTE format('CREATE POLICY own_%1$s ON life.%1$I FOR ALL TO authenticated USING (user_id=auth.uid()) WITH CHECK (user_id=auth.uid())', t);
    EXECUTE format($p$DROP POLICY IF EXISTS svc_%1$s ON life.%1$I$p$, t);
    EXECUTE format('CREATE POLICY svc_%1$s ON life.%1$I FOR ALL TO service_role USING (true) WITH CHECK (true)', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON life.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON life.%I TO service_role', t);
  END LOOP;
END $$;
GRANT USAGE ON SCHEMA life TO authenticated, service_role, anon;
ALTER ROLE authenticator SET pgrst.db_schemas = 'public, graphql_public, storage, core, finance, graphrag, health_meta, health, career, ln_central, education, family, decision, reporting, analytics, documents, platform, recommendations, life';
NOTIFY pgrst, 'reload config'; NOTIFY pgrst, 'reload schema';
