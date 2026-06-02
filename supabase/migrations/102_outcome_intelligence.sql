-- ============================================================================
-- 102: Outcome Intelligence (Sprint O)
--
-- Schema for the outcome-improvement engine:
--
--   outcome.recommendation_effectiveness — per-recommendation rolled
--                                          up effectiveness score.
--   outcome.decision_quality_index        — per (user, window) composite
--                                          score across the platform's
--                                          recommendations.
--   outcome.attribution_links             — explicit link between a
--                                          recommendation and a measured
--                                          change on a goal or life axis.
--   outcome.goal_progress_snapshots       — per (user, goal_id, ts)
--                                          milestone snapshot.
--   outcome.life_progress_snapshots       — per (user, ts) trajectory
--                                          across the 9 flourishing
--                                          axes.
--   outcome.tenant_reports                — enterprise per-tenant rollup.
--
-- Hard requirement (mirrored at the column level):
-- Every effectiveness row carries an `is_safety_compliant` flag derived
-- from the source recommendation's character + governance review.
-- Outcome optimization MUST consult this flag and refuse to push for
-- non-compliant outcomes.
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS outcome;

-- ---- Enum helpers --------------------------------------------------------

CREATE OR REPLACE FUNCTION outcome.is_progress_kind(p TEXT) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE
SET search_path = public, pg_catalog, pg_temp
AS $$
  SELECT p IN (
    'baseline','milestone','periodic','completion','reversal'
  )
$$;

CREATE OR REPLACE FUNCTION outcome.is_flourishing_axis(p TEXT) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE
SET search_path = public, pg_catalog, pg_temp
AS $$
  SELECT p IN (
    'health','safety','relationships','education','career',
    'financial','resilience','responsibility','future_opportunity'
  )
$$;

-- ============================================================================
-- 1. outcome.recommendation_effectiveness
-- ============================================================================
CREATE TABLE IF NOT EXISTS outcome.recommendation_effectiveness (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id   UUID NOT NULL UNIQUE,
  user_id             UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tenant_id           UUID,
  governance_audit_id UUID,
  decision_outcome_id UUID,
  -- Composite score in [0,1]
  effectiveness_score NUMERIC(4,3) CHECK (effectiveness_score IS NULL OR effectiveness_score BETWEEN 0 AND 1),
  -- Sub-scores in [0,1]
  acceptance_score    NUMERIC(4,3),
  speed_score         NUMERIC(4,3),
  outcome_score       NUMERIC(4,3),
  reversal_penalty    NUMERIC(4,3),
  attribution_score   NUMERIC(4,3),
  character_score     NUMERIC(4,3),
  /** Hard safety contract — must be TRUE for the row to influence
   *  outcome optimization. */
  is_safety_compliant BOOLEAN NOT NULL DEFAULT FALSE,
  /** Number of attribution links that contributed to this score. */
  attribution_links_count INT NOT NULL DEFAULT 0,
  /** Time window the score was computed over (snapshot). */
  computed_over_days  INT NOT NULL DEFAULT 30,
  metadata            JSONB NOT NULL DEFAULT '{}',
  computed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_re_user_time
  ON outcome.recommendation_effectiveness(user_id, computed_at DESC);
CREATE INDEX IF NOT EXISTS idx_re_safety
  ON outcome.recommendation_effectiveness(is_safety_compliant)
  WHERE is_safety_compliant = TRUE;
CREATE INDEX IF NOT EXISTS idx_re_score
  ON outcome.recommendation_effectiveness(effectiveness_score)
  WHERE effectiveness_score IS NOT NULL;

-- ============================================================================
-- 2. outcome.decision_quality_index
-- ============================================================================
CREATE TABLE IF NOT EXISTS outcome.decision_quality_index (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tenant_id           UUID,
  window_days         INT NOT NULL DEFAULT 30,
  -- Composite DQI in [0,1]
  dqi_overall         NUMERIC(4,3),
  -- Sub-dimensions
  acceptance_rate     NUMERIC(4,3),
  completion_rate     NUMERIC(4,3),
  reversal_rate       NUMERIC(4,3),
  avg_effectiveness   NUMERIC(4,3),
  avg_character_score NUMERIC(4,3),
  future_preservation_score NUMERIC(4,3),
  recommendations_evaluated INT NOT NULL DEFAULT 0,
  metadata            JSONB NOT NULL DEFAULT '{}',
  computed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, window_days, computed_at)
);
CREATE INDEX IF NOT EXISTS idx_dqi_user_time
  ON outcome.decision_quality_index(user_id, computed_at DESC);

-- ============================================================================
-- 3. outcome.attribution_links
--    Every measurable goal-progress change is linked to the
--    recommendation that most plausibly produced it.
-- ============================================================================
CREATE TABLE IF NOT EXISTS outcome.attribution_links (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recommendation_id     UUID NOT NULL,
  goal_id               UUID,
  /** Quantified delta in [-1, 1] applied to the goal/axis. */
  delta                 NUMERIC(4,3) CHECK (delta IS NULL OR delta BETWEEN -1 AND 1),
  /** Confidence that the recommendation caused the delta in [0,1]. */
  attribution_confidence NUMERIC(4,3) CHECK (
    attribution_confidence IS NULL OR attribution_confidence BETWEEN 0 AND 1
  ),
  /** Flourishing axis the delta applies to (one of the 9). */
  flourishing_axis      TEXT CHECK (flourishing_axis IS NULL OR outcome.is_flourishing_axis(flourishing_axis)),
  /** Time between recommendation completion and goal change (days). */
  lag_days              NUMERIC(6,2),
  attributed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata              JSONB NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_al_user_rec ON outcome.attribution_links(user_id, recommendation_id);
CREATE INDEX IF NOT EXISTS idx_al_goal      ON outcome.attribution_links(goal_id) WHERE goal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_al_axis      ON outcome.attribution_links(flourishing_axis) WHERE flourishing_axis IS NOT NULL;

-- ============================================================================
-- 4. outcome.goal_progress_snapshots
-- ============================================================================
CREATE TABLE IF NOT EXISTS outcome.goal_progress_snapshots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  goal_id         UUID NOT NULL,
  progress_kind   TEXT NOT NULL CHECK (outcome.is_progress_kind(progress_kind)),
  /** Progress percentage in [0,1]. */
  progress_pct    NUMERIC(4,3) NOT NULL CHECK (progress_pct BETWEEN 0 AND 1),
  /** Optional milestone name. */
  milestone       TEXT,
  /** Optional structured payload (e.g. amount saved, lbs lost). */
  measurement     JSONB NOT NULL DEFAULT '{}',
  /** Recommendation that triggered the snapshot (if known). */
  recommendation_id UUID,
  metadata        JSONB NOT NULL DEFAULT '{}',
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_gps_user_goal_time
  ON outcome.goal_progress_snapshots(user_id, goal_id, recorded_at DESC);

-- ============================================================================
-- 5. outcome.life_progress_snapshots
--    Per-user trajectory across the 9 flourishing axes.
-- ============================================================================
CREATE TABLE IF NOT EXISTS outcome.life_progress_snapshots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tenant_id       UUID,
  window_days     INT NOT NULL DEFAULT 30,
  /** Per-axis score in [-1, 1]. */
  health          NUMERIC(4,3),
  safety          NUMERIC(4,3),
  relationships   NUMERIC(4,3),
  education       NUMERIC(4,3),
  career          NUMERIC(4,3),
  financial       NUMERIC(4,3),
  resilience      NUMERIC(4,3),
  responsibility  NUMERIC(4,3),
  future_opportunity NUMERIC(4,3),
  /** Composite overall in [-1, 1]. */
  overall         NUMERIC(4,3),
  /** Trend direction over the previous snapshot ('up' / 'flat' / 'down'). */
  trend           TEXT CHECK (trend IS NULL OR trend IN ('up','flat','down')),
  metadata        JSONB NOT NULL DEFAULT '{}',
  computed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lps_user_time
  ON outcome.life_progress_snapshots(user_id, computed_at DESC);

-- ============================================================================
-- 6. outcome.tenant_reports
-- ============================================================================
CREATE TABLE IF NOT EXISTS outcome.tenant_reports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  window_days     INT NOT NULL DEFAULT 30,
  /** Anonymous aggregate metrics — no per-user identifiers. */
  active_users          INT NOT NULL DEFAULT 0,
  recommendations_total INT NOT NULL DEFAULT 0,
  acceptance_rate       NUMERIC(4,3),
  completion_rate       NUMERIC(4,3),
  avg_effectiveness     NUMERIC(4,3),
  avg_dqi               NUMERIC(4,3),
  avg_life_progress     NUMERIC(4,3),
  safety_compliance_rate NUMERIC(4,3),
  metadata              JSONB NOT NULL DEFAULT '{}',
  computed_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, window_days, computed_at)
);
CREATE INDEX IF NOT EXISTS idx_tr_tenant_time
  ON outcome.tenant_reports(tenant_id, computed_at DESC);

-- ============================================================================
-- RLS
-- ============================================================================
ALTER TABLE outcome.recommendation_effectiveness ENABLE ROW LEVEL SECURITY;
ALTER TABLE outcome.decision_quality_index       ENABLE ROW LEVEL SECURITY;
ALTER TABLE outcome.attribution_links            ENABLE ROW LEVEL SECURITY;
ALTER TABLE outcome.goal_progress_snapshots      ENABLE ROW LEVEL SECURITY;
ALTER TABLE outcome.life_progress_snapshots      ENABLE ROW LEVEL SECURITY;
ALTER TABLE outcome.tenant_reports               ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS re_owner ON outcome.recommendation_effectiveness;
CREATE POLICY re_owner ON outcome.recommendation_effectiveness
  FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS re_service ON outcome.recommendation_effectiveness;
CREATE POLICY re_service ON outcome.recommendation_effectiveness
  FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS dqi_owner ON outcome.decision_quality_index;
CREATE POLICY dqi_owner ON outcome.decision_quality_index
  FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS dqi_service ON outcome.decision_quality_index;
CREATE POLICY dqi_service ON outcome.decision_quality_index
  FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS al_owner ON outcome.attribution_links;
CREATE POLICY al_owner ON outcome.attribution_links
  FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS al_service ON outcome.attribution_links;
CREATE POLICY al_service ON outcome.attribution_links
  FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS gps_owner ON outcome.goal_progress_snapshots;
CREATE POLICY gps_owner ON outcome.goal_progress_snapshots
  FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS gps_service ON outcome.goal_progress_snapshots;
CREATE POLICY gps_service ON outcome.goal_progress_snapshots
  FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS lps_owner ON outcome.life_progress_snapshots;
CREATE POLICY lps_owner ON outcome.life_progress_snapshots
  FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS lps_service ON outcome.life_progress_snapshots;
CREATE POLICY lps_service ON outcome.life_progress_snapshots
  FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

-- Tenant reports are aggregated; tenant members read via the
-- platform.is_tenant_member SECURITY DEFINER helper (Sprint P).
DROP POLICY IF EXISTS tr_member ON outcome.tenant_reports;
CREATE POLICY tr_member ON outcome.tenant_reports
  FOR SELECT USING (platform.is_tenant_member(tenant_id, auth.uid(), 'viewer'));
DROP POLICY IF EXISTS tr_service ON outcome.tenant_reports;
CREATE POLICY tr_service ON outcome.tenant_reports
  FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

GRANT SELECT ON outcome.recommendation_effectiveness TO authenticated;
GRANT SELECT ON outcome.decision_quality_index       TO authenticated;
GRANT SELECT ON outcome.attribution_links            TO authenticated;
GRANT SELECT ON outcome.goal_progress_snapshots      TO authenticated;
GRANT SELECT ON outcome.life_progress_snapshots      TO authenticated;
GRANT SELECT ON outcome.tenant_reports               TO authenticated;

-- Public views (SDK reads these).
CREATE OR REPLACE VIEW public.outcome_recommendation_effectiveness AS
  SELECT * FROM outcome.recommendation_effectiveness;
CREATE OR REPLACE VIEW public.outcome_decision_quality_index AS
  SELECT * FROM outcome.decision_quality_index;
CREATE OR REPLACE VIEW public.outcome_attribution_links AS
  SELECT * FROM outcome.attribution_links;
CREATE OR REPLACE VIEW public.outcome_goal_progress_snapshots AS
  SELECT * FROM outcome.goal_progress_snapshots;
CREATE OR REPLACE VIEW public.outcome_life_progress_snapshots AS
  SELECT * FROM outcome.life_progress_snapshots;
CREATE OR REPLACE VIEW public.outcome_tenant_reports AS
  SELECT * FROM outcome.tenant_reports;

GRANT SELECT ON public.outcome_recommendation_effectiveness TO authenticated;
GRANT SELECT ON public.outcome_decision_quality_index       TO authenticated;
GRANT SELECT ON public.outcome_attribution_links            TO authenticated;
GRANT SELECT ON public.outcome_goal_progress_snapshots      TO authenticated;
GRANT SELECT ON public.outcome_life_progress_snapshots      TO authenticated;
GRANT SELECT ON public.outcome_tenant_reports               TO authenticated;

-- ============================================================================
-- Self-test
-- ============================================================================
DO $$
DECLARE
  expected TEXT[] := ARRAY[
    'recommendation_effectiveness','decision_quality_index',
    'attribution_links','goal_progress_snapshots',
    'life_progress_snapshots','tenant_reports'
  ];
  t TEXT;
BEGIN
  FOREACH t IN ARRAY expected LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname='outcome' AND c.relname=t AND c.relkind='r'
    ) THEN
      RAISE EXCEPTION '102 self-test: outcome.% missing', t;
    END IF;
  END LOOP;
END $$;
