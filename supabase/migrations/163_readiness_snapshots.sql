-- 163_readiness_snapshots.sql
-- A citable record of computed readiness + Life Brief results, so the web tier (which
-- computes them in TypeScript) and the Python advisor/report (which can't import the TS
-- scorers) share ONE source of truth. This is a RECORD of a computed result, not a second
-- scorer — scoring stays in lib/readiness + lib/lifeBrief.
--
-- Latest-only per (user_id, domain): the web endpoints UPSERT on each compute.
-- `life` is already PostgREST-exposed (migration 154); no exposure change needed.

CREATE TABLE IF NOT EXISTS life.readiness_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  domain TEXT NOT NULL,                 -- 'career' | 'education' | 'life_brief'
  score INT,                            -- nullable (life_brief has no single score)
  status TEXT,
  confidence INT,
  components JSONB NOT NULL DEFAULT '[]',
  strengths JSONB NOT NULL DEFAULT '[]',
  gaps JSONB NOT NULL DEFAULT '[]',
  recommended_actions JSONB NOT NULL DEFAULT '[]',
  data_sources JSONB NOT NULL DEFAULT '[]',
  missing_data JSONB NOT NULL DEFAULT '[]',
  payload JSONB,                        -- the full computed contract (ReadinessResult or LifeBrief)
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, domain)
);

CREATE INDEX IF NOT EXISTS idx_readiness_snapshots_user_domain
  ON life.readiness_snapshots (user_id, domain, generated_at DESC);

ALTER TABLE life.readiness_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_own_readiness_snapshots ON life.readiness_snapshots;
CREATE POLICY users_own_readiness_snapshots ON life.readiness_snapshots
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS service_readiness_snapshots ON life.readiness_snapshots;
CREATE POLICY service_readiness_snapshots ON life.readiness_snapshots
  FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON life.readiness_snapshots TO authenticated;
GRANT ALL ON life.readiness_snapshots TO service_role;
