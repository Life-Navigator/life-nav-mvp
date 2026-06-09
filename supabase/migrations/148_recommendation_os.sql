-- 148_recommendation_os.sql — Recommendation Operating System (Elite Sprint 25).
-- ONE registry every module writes to; every consumer (readiness, graph, reports, chat,
-- prioritization) reads from here. Recommendations are first-class objects, not strings. 116-RLS.
CREATE SCHEMA IF NOT EXISTS recommendations;

CREATE TABLE IF NOT EXISTS recommendations.recommendations (
  id UUID PRIMARY KEY,                                  -- deterministic (uuid5 of source+title) -> idempotent, no dupes
  user_id UUID NOT NULL, tenant_id UUID NOT NULL,
  title TEXT NOT NULL, description TEXT,
  category TEXT NOT NULL, source_module TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium',              -- high/medium/low
  status TEXT NOT NULL DEFAULT 'new',                   -- new/viewed/accepted/in_progress/deferred/completed/dismissed
  confidence NUMERIC,
  evidence JSONB NOT NULL DEFAULT '[]'::jsonb,          -- [{statement, source_table/source}]
  assumptions JSONB NOT NULL DEFAULT '[]'::jsonb,
  impacted_domains TEXT[] NOT NULL DEFAULT '{}',
  readiness_impact JSONB NOT NULL DEFAULT '{}'::jsonb,  -- {domain, delta, ...}
  decision_impact JSONB NOT NULL DEFAULT '{}'::jsonb,
  recommended_action TEXT, estimated_effort TEXT, estimated_benefit TEXT,
  blocking_dependencies JSONB NOT NULL DEFAULT '[]'::jsonb,
  report_visibility BOOLEAN NOT NULL DEFAULT true, chat_visibility BOOLEAN NOT NULL DEFAULT true,
  rank_score NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());

CREATE TABLE IF NOT EXISTS recommendations.recommendation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id UUID NOT NULL, user_id UUID NOT NULL, tenant_id UUID NOT NULL,
  event TEXT NOT NULL,                                  -- the lifecycle transition
  created_at TIMESTAMPTZ NOT NULL DEFAULT now());

CREATE INDEX IF NOT EXISTS idx_recos_user ON recommendations.recommendations(user_id, rank_score DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_reco_events ON recommendations.recommendation_events(recommendation_id, created_at DESC);

DO $$ DECLARE t TEXT; BEGIN
  FOREACH t IN ARRAY ARRAY['recommendations','recommendation_events'] LOOP
    EXECUTE format('ALTER TABLE recommendations.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE recommendations.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format($p$DROP POLICY IF EXISTS own_%1$s ON recommendations.%1$I$p$, t);
    EXECUTE format('CREATE POLICY own_%1$s ON recommendations.%1$I FOR ALL TO authenticated USING (user_id=auth.uid()) WITH CHECK (user_id=auth.uid())', t);
    EXECUTE format($p$DROP POLICY IF EXISTS svc_%1$s ON recommendations.%1$I$p$, t);
    EXECUTE format('CREATE POLICY svc_%1$s ON recommendations.%1$I FOR ALL TO service_role USING (true) WITH CHECK (true)', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON recommendations.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON recommendations.%I TO service_role', t);
  END LOOP;
END $$;
GRANT USAGE ON SCHEMA recommendations TO authenticated, service_role, anon;
