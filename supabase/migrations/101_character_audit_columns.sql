-- ============================================================================
-- 101: Character audit columns + character findings table (Sprint Q)
--
-- Extends governance.decision_governance_audit with character-review
-- columns and creates a per-finding table so the operator dashboard
-- can aggregate failure rate / weakest dimension / dignity violations
-- by user, time window, and category.
-- ============================================================================

-- ---- 1. Extend decision_governance_audit --------------------------------
ALTER TABLE governance.decision_governance_audit
  ADD COLUMN IF NOT EXISTS character_score_overall    NUMERIC(4,3);
ALTER TABLE governance.decision_governance_audit
  ADD COLUMN IF NOT EXISTS character_score_weakest    NUMERIC(4,3);
ALTER TABLE governance.decision_governance_audit
  ADD COLUMN IF NOT EXISTS character_weakest_dimension TEXT;
ALTER TABLE governance.decision_governance_audit
  ADD COLUMN IF NOT EXISTS character_needs_regeneration BOOLEAN;
ALTER TABLE governance.decision_governance_audit
  ADD COLUMN IF NOT EXISTS character_family_table_passes BOOLEAN;
ALTER TABLE governance.decision_governance_audit
  ADD COLUMN IF NOT EXISTS character_trusted_advisor_passes BOOLEAN;
ALTER TABLE governance.decision_governance_audit
  ADD COLUMN IF NOT EXISTS character_dignity_violation BOOLEAN;
ALTER TABLE governance.decision_governance_audit
  ADD COLUMN IF NOT EXISTS character_family_audiences_failed TEXT[];
ALTER TABLE governance.decision_governance_audit
  ADD COLUMN IF NOT EXISTS character_advisor_concern_count INT;
ALTER TABLE governance.decision_governance_audit
  ADD COLUMN IF NOT EXISTS character_flourishing_harming_axes TEXT[];

CREATE INDEX IF NOT EXISTS idx_dga_character_regen
  ON governance.decision_governance_audit(character_needs_regeneration)
  WHERE character_needs_regeneration = TRUE;
CREATE INDEX IF NOT EXISTS idx_dga_character_dignity
  ON governance.decision_governance_audit(character_dignity_violation)
  WHERE character_dignity_violation = TRUE;
CREATE INDEX IF NOT EXISTS idx_dga_character_weakest
  ON governance.decision_governance_audit(character_weakest_dimension)
  WHERE character_weakest_dimension IS NOT NULL;

-- Re-create the public view so the new columns are exposed to the SDK.
DROP VIEW IF EXISTS public.decision_governance_audit;
CREATE OR REPLACE VIEW public.decision_governance_audit AS
  SELECT * FROM governance.decision_governance_audit;
GRANT SELECT ON public.decision_governance_audit TO authenticated;

-- ---- 2. Per-finding table -----------------------------------------------
-- Captures every rule that fired for a given audit row. This is what
-- the dashboard queries to compute weakest-dimension distribution + per
-- rule_id failure counts.
CREATE TABLE IF NOT EXISTS governance.character_findings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id        UUID NOT NULL REFERENCES governance.decision_governance_audit(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  dimension       TEXT NOT NULL,        -- one of the 8 CharacterDimension values
  rule_id         TEXT NOT NULL,
  severity        TEXT NOT NULL CHECK (severity IN ('low','moderate','high','critical')),
  reason          TEXT,
  evidence        TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cf_audit ON governance.character_findings(audit_id);
CREATE INDEX IF NOT EXISTS idx_cf_user_time ON governance.character_findings(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cf_dimension ON governance.character_findings(dimension);
CREATE INDEX IF NOT EXISTS idx_cf_rule ON governance.character_findings(rule_id);

ALTER TABLE governance.character_findings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cf_owner ON governance.character_findings;
CREATE POLICY cf_owner ON governance.character_findings
  FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS cf_service ON governance.character_findings;
CREATE POLICY cf_service ON governance.character_findings
  FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

CREATE OR REPLACE VIEW public.character_findings AS
  SELECT * FROM governance.character_findings;
GRANT SELECT ON public.character_findings TO authenticated;

-- ---- 3. Self-test --------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='governance' AND table_name='decision_governance_audit'
      AND column_name='character_score_overall'
  ) THEN
    RAISE EXCEPTION '101 self-test: character_score_overall column missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname='governance' AND c.relname='character_findings'
  ) THEN
    RAISE EXCEPTION '101 self-test: character_findings table missing';
  END IF;
END $$;
