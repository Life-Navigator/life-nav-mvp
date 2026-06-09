-- 155 — Sprint 34: the intelligence layer. Persisted edges, objective lifecycle, themes,
-- constraints, confidence. Replaces query-time edges + accumulating objectives.
ALTER TABLE life.life_objectives ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';   -- active/superseded/archived/rejected
ALTER TABLE life.life_objectives ADD COLUMN IF NOT EXISTS confidence NUMERIC;
ALTER TABLE life.life_objectives ADD COLUMN IF NOT EXISTS themes JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE life.life_objectives ADD COLUMN IF NOT EXISTS alternatives JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE life.life_objectives ADD COLUMN IF NOT EXISTS reasoning TEXT;
ALTER TABLE life.life_objectives ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS life.life_graph_edges (
  edge_id UUID PRIMARY KEY, user_id UUID NOT NULL, tenant_id UUID NOT NULL,
  source_node TEXT NOT NULL, target_node TEXT NOT NULL, edge_type TEXT NOT NULL,
  domain TEXT, confidence NUMERIC, status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());

CREATE TABLE IF NOT EXISTS life.constraints (
  id UUID PRIMARY KEY, user_id UUID NOT NULL, tenant_id UUID NOT NULL,
  objective_id UUID, label TEXT NOT NULL, kind TEXT, detail TEXT, severity TEXT DEFAULT 'medium',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now());

CREATE INDEX IF NOT EXISTS idx_life_edges_user ON life.life_graph_edges(user_id, status);
CREATE INDEX IF NOT EXISTS idx_life_constraints_user ON life.constraints(user_id);

DO $$ DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['life_graph_edges','constraints'] LOOP
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
