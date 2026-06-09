-- 149 — Sprint 27: FORCE RLS on the tenant/user tables that had it enabled-but-not-forced
-- (closes the owner-bypass gap the audit found) + extend recommendations for quality fields.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT n.nspname AS sch, c.relname AS tbl
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE c.relkind='r' AND c.relrowsecurity=true AND c.relforcerowsecurity=false
      AND n.nspname IN ('platform','analytics','reporting','documents','recommendations')
  LOOP
    EXECUTE format('ALTER TABLE %I.%I FORCE ROW LEVEL SECURITY', r.sch, r.tbl);
  END LOOP;
END $$;

-- Recommendation quality fields (Sprint 27 Quality Engine).
ALTER TABLE recommendations.recommendations ADD COLUMN IF NOT EXISTS rec_type TEXT;          -- ACTION/RISK/OPPORTUNITY/DEPENDENCY/INFORMATION
ALTER TABLE recommendations.recommendations ADD COLUMN IF NOT EXISTS current_state TEXT;
ALTER TABLE recommendations.recommendations ADD COLUMN IF NOT EXISTS target_state TEXT;
ALTER TABLE recommendations.recommendations ADD COLUMN IF NOT EXISTS delta_text TEXT;
ALTER TABLE recommendations.recommendations ADD COLUMN IF NOT EXISTS quantified_impact JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE recommendations.recommendations ADD COLUMN IF NOT EXISTS narrative JSONB NOT NULL DEFAULT '{}'::jsonb;
