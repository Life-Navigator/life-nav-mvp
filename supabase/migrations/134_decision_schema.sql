-- 134_decision_schema.sql — cross-domain Decision Engine store (Decision Engine D1).
--
-- A `decision` is the root of a decision graph: a life question (MBA or invest? move? new
-- job?) resolved across Finance/Health/Career/Education/Family into worst/expected/best
-- scenarios + evidence + tradeoffs + an advice boundary. The worker fans the row's JSON into
-- a Decision/Scenario/Evidence/Tradeoff/AdviceBoundary subgraph. 116-RLS. enum-before-trigger:
-- NO triggers here (added in 135 after the worker enum ships + deploys).

CREATE SCHEMA IF NOT EXISTS decision;

CREATE TABLE IF NOT EXISTS decision.decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL, tenant_id UUID NOT NULL,
  question TEXT NOT NULL,
  decision_type TEXT NOT NULL,                 -- mba_or_invest / move_states / new_job / grad_school / delay_retirement / college_funding / general
  title TEXT NOT NULL, description TEXT,        -- description = the verdict
  recommendation_type TEXT NOT NULL DEFAULT 'cross_domain_decision',
  priority TEXT NOT NULL DEFAULT 'high',
  confidence NUMERIC(4,3) NOT NULL DEFAULT 0.5,
  governance_verdict JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'active',
  scenarios_json JSONB NOT NULL DEFAULT '[]'::jsonb,   -- [{label: worst|expected|best, ...}]
  evidence_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  assumptions_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  tradeoffs_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  affected_domains TEXT[] NOT NULL DEFAULT '{}',
  source_tables TEXT[] NOT NULL DEFAULT '{}', source_graph_nodes TEXT[] NOT NULL DEFAULT '{}',
  derived_by TEXT NOT NULL DEFAULT 'decision-engine',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ, rejected_at TIMESTAMPTZ, dismissed_at TIMESTAMPTZ);

CREATE INDEX IF NOT EXISTS idx_d_decisions_user ON decision.decisions(user_id, decision_type);

ALTER TABLE decision.decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE decision.decisions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS users_own_decisions ON decision.decisions;
CREATE POLICY users_own_decisions ON decision.decisions
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS service_decisions ON decision.decisions;
CREATE POLICY service_decisions ON decision.decisions
  FOR ALL TO service_role USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON decision.decisions TO authenticated;
GRANT ALL ON decision.decisions TO service_role;

DROP VIEW IF EXISTS public.v_decisions;
CREATE VIEW public.v_decisions WITH (security_invoker = true) AS
  SELECT id, user_id, question, decision_type, title, description, priority, confidence,
         governance_verdict, status, scenarios_json, evidence_json, assumptions_json,
         tradeoffs_json, affected_domains, created_at, updated_at
  FROM decision.decisions;
GRANT SELECT ON public.v_decisions TO authenticated;

GRANT USAGE ON SCHEMA decision TO authenticated, service_role, anon;
-- NO triggers (enum-before-trigger). NO PostgREST db_schemas change here (done in 136).
