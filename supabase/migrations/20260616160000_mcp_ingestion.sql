-- 20260616160000 — MCP structured ingestion: provenance + facts + relationships.
-- Backs the MCP submission tools (submit_life_fact/goal/constraint/risk/opportunity/narrative/relationship).
-- Every MCP-written row carries provenance (source, confidence, confirmation_status, idempotency_key) so
-- nothing enters the life model unattributed. Additive + idempotent (safe to re-run). 116-RLS pattern.
-- GATED: apply ONLY after the exposed Supabase PAT/service-role/anon keys are rotated (see
-- docs/finish-line/SECURITY_CLEARANCE_REPORT.md). Do NOT apply with the compromised PAT.

-- 1) life.facts — discrete life facts (has children, works at NVIDIA, getting married, considering a master's).
CREATE TABLE IF NOT EXISTS life.facts (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL, tenant_id UUID NOT NULL,
  fact_type TEXT NOT NULL,                 -- controlled vocab in the ingestion layer
  value TEXT NOT NULL,
  domain TEXT NOT NULL DEFAULT 'core',     -- finance|family|health|education|career|core
  confidence NUMERIC NOT NULL DEFAULT 0.5,
  confirmation_status TEXT NOT NULL DEFAULT 'candidate',  -- confirmed|inferred|candidate
  source TEXT NOT NULL DEFAULT 'agent_inference',         -- user_message|document|email|calendar|agent_inference|external
  provenance JSONB NOT NULL DEFAULT '{}'::jsonb,          -- {submitted_by,conversation_id,document_id,email_id,calendar_event_id}
  idempotency_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_life_facts_user ON life.facts(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_life_facts_idem ON life.facts(user_id, idempotency_key) WHERE idempotency_key IS NOT NULL;

-- 2) life.relationships — MCP-submitted graph edges (goal supports/conflicts/blocks/accelerates goal, etc.).
CREATE TABLE IF NOT EXISTS life.relationships (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL, tenant_id UUID NOT NULL,
  from_ref TEXT NOT NULL,                   -- label or id of the source node
  to_ref TEXT NOT NULL,                     -- label or id of the target node
  relation_type TEXT NOT NULL,             -- supports|conflicts|blocks|accelerates|depends_on
  domain TEXT, confidence NUMERIC NOT NULL DEFAULT 0.5,
  confirmation_status TEXT NOT NULL DEFAULT 'candidate',
  source TEXT NOT NULL DEFAULT 'agent_inference',
  provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_life_rel_user ON life.relationships(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_life_rel_idem ON life.relationships(user_id, idempotency_key) WHERE idempotency_key IS NOT NULL;

-- 3) Provenance columns on the existing life objects MCP can write (additive, idempotent).
ALTER TABLE life.candidate_goals ADD COLUMN IF NOT EXISTS confirmation_status TEXT NOT NULL DEFAULT 'candidate';
ALTER TABLE life.candidate_goals ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'agent_inference';
ALTER TABLE life.candidate_goals ADD COLUMN IF NOT EXISTS provenance JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE life.candidate_goals ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

DO $mcp$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['risks','opportunities','constraints'] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='life' AND table_name=t) THEN
      EXECUTE format('ALTER TABLE life.%I ADD COLUMN IF NOT EXISTS confidence NUMERIC NOT NULL DEFAULT 0.5', t);
      EXECUTE format($q$ALTER TABLE life.%I ADD COLUMN IF NOT EXISTS confirmation_status TEXT NOT NULL DEFAULT 'candidate'$q$, t);
      EXECUTE format($q$ALTER TABLE life.%I ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'agent_inference'$q$, t);
      EXECUTE format($q$ALTER TABLE life.%I ADD COLUMN IF NOT EXISTS provenance JSONB NOT NULL DEFAULT '{}'::jsonb$q$, t);
      EXECUTE format('ALTER TABLE life.%I ADD COLUMN IF NOT EXISTS idempotency_key TEXT', t);
    END IF;
  END LOOP;
END $mcp$;

-- 4) RLS on the two new tables — owner read/write + service_role (the MCP server writes as service_role,
--    always scoping user_id explicitly from the resolved token — never from tool input).
DO $rls$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['facts','relationships'] LOOP
    EXECUTE format('ALTER TABLE life.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE life.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format($p$DROP POLICY IF EXISTS own_%1$s ON life.%1$I$p$, t);
    EXECUTE format('CREATE POLICY own_%1$s ON life.%1$I FOR ALL TO authenticated USING (user_id=auth.uid()) WITH CHECK (user_id=auth.uid())', t);
    EXECUTE format($p$DROP POLICY IF EXISTS svc_%1$s ON life.%1$I$p$, t);
    EXECUTE format('CREATE POLICY svc_%1$s ON life.%1$I FOR ALL TO service_role USING (true) WITH CHECK (true)', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON life.%I TO authenticated, service_role', t);
  END LOOP;
END $rls$;

NOTIFY pgrst, 'reload schema';
