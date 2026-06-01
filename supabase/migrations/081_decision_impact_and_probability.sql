-- ==========================================================================
-- 081: Decision Impact + Probability Distribution Engine
--
-- Seven tables in the existing decision_intelligence schema (079/080).
-- All user-scoped, strict RLS, sync-triggered into the existing
-- trigger_decision_intel_sync() so projections flow to the personal
-- Qdrant + Neo4j sinks automatically.
--
-- The probability surface is intentionally distributional — every
-- estimate carries quantiles (p10/p25/most_likely/p75/p90) plus
-- worst_case/best_case bounds plus a `confidence`. Single-point
-- predictions are forbidden by design.
-- ==========================================================================

CREATE OR REPLACE FUNCTION decision_intelligence.is_time_horizon(p TEXT) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE AS $$
  SELECT p IN ('immediate','3_month','1_year','3_year','5_year','10_year','20_year')
$$;

CREATE OR REPLACE FUNCTION decision_intelligence.is_catchup_status(p TEXT) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE AS $$
  SELECT p IN ('on_track','ahead','behind','at_risk')
$$;


-- ###########################################################################
-- 1. goal_probability_distributions — one row per (goal, time_horizon) at
--    a moment in time. UPSERT-keyed.
-- ###########################################################################
CREATE TABLE IF NOT EXISTS decision_intelligence.goal_probability_distributions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  goal_id         UUID NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  scenario_id     UUID,
  decision_id     UUID REFERENCES decision_intelligence.decision_journals(id) ON DELETE SET NULL,
  time_horizon    TEXT NOT NULL CHECK (decision_intelligence.is_time_horizon(time_horizon)),
  worst_case      NUMERIC(4,3) NOT NULL CHECK (worst_case BETWEEN 0 AND 1),
  p10             NUMERIC(4,3) NOT NULL CHECK (p10        BETWEEN 0 AND 1),
  p25             NUMERIC(4,3) NOT NULL CHECK (p25        BETWEEN 0 AND 1),
  most_likely     NUMERIC(4,3) NOT NULL CHECK (most_likely BETWEEN 0 AND 1),
  p75             NUMERIC(4,3) NOT NULL CHECK (p75        BETWEEN 0 AND 1),
  p90             NUMERIC(4,3) NOT NULL CHECK (p90        BETWEEN 0 AND 1),
  best_case       NUMERIC(4,3) NOT NULL CHECK (best_case  BETWEEN 0 AND 1),
  confidence      NUMERIC(4,3) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  assumptions     JSONB NOT NULL DEFAULT '[]',
  variance_factors JSONB NOT NULL DEFAULT '[]',
  computed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT gpd_ordering CHECK (
    worst_case <= p10 AND p10 <= p25 AND p25 <= most_likely
    AND most_likely <= p75 AND p75 <= p90 AND p90 <= best_case
  ),
  CONSTRAINT gpd_unique UNIQUE (user_id, goal_id, time_horizon, scenario_id, decision_id)
);
CREATE INDEX IF NOT EXISTS idx_gpd_user_goal ON decision_intelligence.goal_probability_distributions(user_id, goal_id, time_horizon);


-- ###########################################################################
-- 2. goal_probability_snapshots — time-series log (no UPSERT key).
-- ###########################################################################
CREATE TABLE IF NOT EXISTS decision_intelligence.goal_probability_snapshots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  goal_id         UUID NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  scenario_id     UUID,
  decision_id     UUID REFERENCES decision_intelligence.decision_journals(id) ON DELETE SET NULL,
  distribution_id UUID REFERENCES decision_intelligence.goal_probability_distributions(id) ON DELETE SET NULL,
  time_horizon    TEXT NOT NULL CHECK (decision_intelligence.is_time_horizon(time_horizon)),
  most_likely     NUMERIC(4,3) NOT NULL CHECK (most_likely BETWEEN 0 AND 1),
  range_width     NUMERIC(4,3) NOT NULL CHECK (range_width BETWEEN 0 AND 1),  -- best_case - worst_case
  confidence      NUMERIC(4,3) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  snapshot_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_gpsnap_user_goal ON decision_intelligence.goal_probability_snapshots(user_id, goal_id, snapshot_at DESC);


-- ###########################################################################
-- 3. goal_decision_impacts — per-decision, per-goal, per-horizon impact
-- ###########################################################################
CREATE TABLE IF NOT EXISTS decision_intelligence.goal_decision_impacts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  goal_id             UUID NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  decision_id         UUID REFERENCES decision_intelligence.decision_journals(id) ON DELETE CASCADE,
  decision_label      TEXT NOT NULL,
  time_horizon        TEXT NOT NULL CHECK (decision_intelligence.is_time_horizon(time_horizon)),
  probability_delta   NUMERIC(5,4) NOT NULL CHECK (probability_delta BETWEEN -1 AND 1),
  timeline_delta_months NUMERIC(6,2),                       -- accelerate (-) or delay (+)
  risk_delta          NUMERIC(5,4) CHECK (risk_delta IS NULL OR risk_delta BETWEEN -1 AND 1),
  related_goal_effects JSONB NOT NULL DEFAULT '[]',         -- [{goal_id, delta}]
  blocked_goal_effects JSONB NOT NULL DEFAULT '[]',
  is_structural       BOOLEAN NOT NULL DEFAULT FALSE,
  structural_variable TEXT,                                 -- income/education/health/debt_structure/family/business/career/legal
  confidence          NUMERIC(4,3) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  reason              TEXT,
  metadata            JSONB NOT NULL DEFAULT '{}',
  computed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT gdi_unique UNIQUE (user_id, goal_id, decision_id, decision_label, time_horizon)
);
CREATE INDEX IF NOT EXISTS idx_gdi_user_goal ON decision_intelligence.goal_decision_impacts(user_id, goal_id);
CREATE INDEX IF NOT EXISTS idx_gdi_user_decision ON decision_intelligence.goal_decision_impacts(user_id, decision_id);


-- ###########################################################################
-- 4. goal_pathway_probabilities — per (goal, pathway_signature, horizon)
-- ###########################################################################
CREATE TABLE IF NOT EXISTS decision_intelligence.goal_pathway_probabilities (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  goal_id             UUID NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  scenario_id         UUID,
  pathway_signature   TEXT NOT NULL,
  pathway_label       TEXT,
  time_horizon        TEXT NOT NULL CHECK (decision_intelligence.is_time_horizon(time_horizon)),
  most_likely         NUMERIC(4,3) NOT NULL CHECK (most_likely BETWEEN 0 AND 1),
  worst_case          NUMERIC(4,3) NOT NULL CHECK (worst_case BETWEEN 0 AND 1),
  best_case           NUMERIC(4,3) NOT NULL CHECK (best_case  BETWEEN 0 AND 1),
  confidence          NUMERIC(4,3) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  evidence            JSONB NOT NULL DEFAULT '[]',
  computed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata            JSONB NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT gpp_unique UNIQUE (user_id, goal_id, pathway_signature, time_horizon, scenario_id)
);
CREATE INDEX IF NOT EXISTS idx_gpp_user_goal ON decision_intelligence.goal_pathway_probabilities(user_id, goal_id);


-- ###########################################################################
-- 5. goal_future_states — projected best/most-likely/worst trajectory pts
-- ###########################################################################
CREATE TABLE IF NOT EXISTS decision_intelligence.goal_future_states (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  goal_id         UUID NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  scenario_id     UUID,
  time_horizon    TEXT NOT NULL CHECK (decision_intelligence.is_time_horizon(time_horizon)),
  path_kind       TEXT NOT NULL CHECK (path_kind IN ('worst','most_likely','best')),
  projected_score NUMERIC(4,3) NOT NULL CHECK (projected_score BETWEEN 0 AND 1),
  projected_at    DATE NOT NULL,                            -- the date this state is projected to obtain
  drivers         JSONB NOT NULL DEFAULT '[]',              -- [{factor, contribution}]
  confidence      NUMERIC(4,3) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT gfs_unique UNIQUE (user_id, goal_id, time_horizon, path_kind, scenario_id)
);
CREATE INDEX IF NOT EXISTS idx_gfs_user_goal ON decision_intelligence.goal_future_states(user_id, goal_id);


-- ###########################################################################
-- 6. decision_marginal_impacts — ranking output
-- ###########################################################################
CREATE TABLE IF NOT EXISTS decision_intelligence.decision_marginal_impacts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  goal_id             UUID REFERENCES public.goals(id) ON DELETE SET NULL,
  decision_id         UUID REFERENCES decision_intelligence.decision_journals(id) ON DELETE SET NULL,
  rank                INT NOT NULL CHECK (rank > 0),
  decision_label      TEXT NOT NULL,
  target_goal_concept TEXT,
  domain              TEXT NOT NULL,
  marginal_impact     NUMERIC(5,4) NOT NULL CHECK (marginal_impact BETWEEN -1 AND 1),
  time_horizon        TEXT NOT NULL CHECK (decision_intelligence.is_time_horizon(time_horizon)),
  confidence          NUMERIC(4,3) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  reason              TEXT,
  tradeoffs           JSONB NOT NULL DEFAULT '[]',
  computed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata            JSONB NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dmi_user_rank ON decision_intelligence.decision_marginal_impacts(user_id, rank);
CREATE INDEX IF NOT EXISTS idx_dmi_user_domain ON decision_intelligence.decision_marginal_impacts(user_id, domain);


-- ###########################################################################
-- 7. trajectory_variance_factors — the named factors widening or narrowing
--    the user's probability range for a goal.
-- ###########################################################################
CREATE TABLE IF NOT EXISTS decision_intelligence.trajectory_variance_factors (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  goal_id         UUID NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  scenario_id     UUID,
  factor_kind     TEXT NOT NULL CHECK (factor_kind IN (
    'horizon_length','support_count','historical_accuracy','recommendation_quality',
    'pathway_effectiveness','constraint_severity','risk_tolerance','external_dependency',
    'structural_decision_pending','data_sparsity'
  )),
  factor_label    TEXT NOT NULL,
  effect          NUMERIC(5,4) NOT NULL CHECK (effect BETWEEN -1 AND 1),  -- -widens, +narrows
  confidence      NUMERIC(4,3) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  evidence        JSONB NOT NULL DEFAULT '[]',
  computed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tvf_user_goal ON decision_intelligence.trajectory_variance_factors(user_id, goal_id);


-- ###########################################################################
-- Triggers — updated_at on all 7 tables
-- ###########################################################################
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'goal_probability_distributions','goal_probability_snapshots','goal_decision_impacts',
    'goal_pathway_probabilities','goal_future_states','decision_marginal_impacts',
    'trajectory_variance_factors'
  ]
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS set_%I_updated_at ON decision_intelligence.%I; '
      'CREATE TRIGGER set_%I_updated_at BEFORE UPDATE ON decision_intelligence.%I '
      'FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();',
      t, t, t, t
    );
  END LOOP;
END $$;


-- ###########################################################################
-- RLS
-- ###########################################################################
ALTER TABLE decision_intelligence.goal_probability_distributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE decision_intelligence.goal_probability_snapshots     ENABLE ROW LEVEL SECURITY;
ALTER TABLE decision_intelligence.goal_decision_impacts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE decision_intelligence.goal_pathway_probabilities     ENABLE ROW LEVEL SECURITY;
ALTER TABLE decision_intelligence.goal_future_states             ENABLE ROW LEVEL SECURITY;
ALTER TABLE decision_intelligence.decision_marginal_impacts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE decision_intelligence.trajectory_variance_factors    ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'goal_probability_distributions','goal_probability_snapshots','goal_decision_impacts',
    'goal_pathway_probabilities','goal_future_states','decision_marginal_impacts',
    'trajectory_variance_factors'
  ]
  LOOP
    EXECUTE format(
      'CREATE POLICY %I ON decision_intelligence.%I FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)',
      t || '_owner_all', t
    );
    EXECUTE format(
      'CREATE POLICY %I ON decision_intelligence.%I FOR ALL TO service_role USING (true) WITH CHECK (true)',
      t || '_service_role', t
    );
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON decision_intelligence.goal_probability_distributions,
     decision_intelligence.goal_probability_snapshots,
     decision_intelligence.goal_decision_impacts,
     decision_intelligence.goal_pathway_probabilities,
     decision_intelligence.goal_future_states,
     decision_intelligence.decision_marginal_impacts,
     decision_intelligence.trajectory_variance_factors
  TO authenticated;


-- ###########################################################################
-- Public read/write views
-- ###########################################################################
CREATE OR REPLACE VIEW public.goal_probability_distributions AS SELECT * FROM decision_intelligence.goal_probability_distributions;
CREATE OR REPLACE VIEW public.goal_probability_snapshots     AS SELECT * FROM decision_intelligence.goal_probability_snapshots;
CREATE OR REPLACE VIEW public.goal_decision_impacts          AS SELECT * FROM decision_intelligence.goal_decision_impacts;
CREATE OR REPLACE VIEW public.goal_pathway_probabilities     AS SELECT * FROM decision_intelligence.goal_pathway_probabilities;
CREATE OR REPLACE VIEW public.goal_future_states             AS SELECT * FROM decision_intelligence.goal_future_states;
CREATE OR REPLACE VIEW public.decision_marginal_impacts      AS SELECT * FROM decision_intelligence.decision_marginal_impacts;
CREATE OR REPLACE VIEW public.trajectory_variance_factors    AS SELECT * FROM decision_intelligence.trajectory_variance_factors;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.goal_probability_distributions,
     public.goal_probability_snapshots,
     public.goal_decision_impacts,
     public.goal_pathway_probabilities,
     public.goal_future_states,
     public.decision_marginal_impacts,
     public.trajectory_variance_factors
  TO authenticated;


-- ###########################################################################
-- GraphRAG sync — extend the existing trigger function (080) to cover the
-- new tables. We add an OR-branch via DROP TRIGGER + new CREATE TRIGGER per
-- table that calls the same function; the function itself already routes
-- by TG_TABLE_NAME and we extend the case for the new tables.
-- ###########################################################################
CREATE OR REPLACE FUNCTION decision_intelligence.trigger_decision_intel_sync()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_entity_type TEXT;
  v_payload     JSONB;
BEGIN
  v_entity_type := CASE TG_TABLE_NAME
    -- 079/080 entries
    WHEN 'goal_progress_snapshots'         THEN 'goal_progress_snapshot'
    WHEN 'goal_progress_events'            THEN 'goal_progress_event'
    WHEN 'goal_progress_scores'            THEN 'goal_progress_score'
    WHEN 'goal_progress_predictions'       THEN 'goal_progress_prediction'
    WHEN 'cross_domain_impacts'            THEN 'cross_domain_impact'
    WHEN 'outcome_attributions'            THEN 'outcome_attribution'
    WHEN 'prediction_calibration'          THEN 'prediction_calibration'
    WHEN 'recommendation_accuracy'         THEN 'recommendation_accuracy'
    WHEN 'advisor_accuracy'                THEN 'advisor_accuracy'
    WHEN 'recommendation_quality_metrics'  THEN 'recommendation_quality_metric'
    WHEN 'goal_pathway_effectiveness'      THEN 'pathway_effectiveness'
    -- 081 entries
    WHEN 'goal_probability_distributions'  THEN 'goal_probability_distribution'
    WHEN 'goal_probability_snapshots'      THEN 'goal_probability_snapshot'
    WHEN 'goal_decision_impacts'           THEN 'goal_decision_impact'
    WHEN 'goal_pathway_probabilities'      THEN 'goal_pathway_probability'
    WHEN 'goal_future_states'              THEN 'goal_future_state'
    WHEN 'decision_marginal_impacts'       THEN 'decision_marginal_impact'
    WHEN 'trajectory_variance_factors'     THEN 'trajectory_variance_factor'
    ELSE 'decision_intel_unknown'
  END;

  IF TG_OP = 'DELETE' THEN
    PERFORM graphrag.enqueue_sync(
      COALESCE(OLD.user_id, '00000000-0000-0000-0000-000000000000'::uuid),
      v_entity_type, OLD.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'delete', '{}'::jsonb
    );
    RETURN OLD;
  END IF;

  v_payload := to_jsonb(NEW) - 'metadata' - 'created_at' - 'updated_at';
  v_payload := v_payload - 'user_id';

  -- 080: central cohort effectiveness; everything else stays personal.
  IF TG_TABLE_NAME = 'goal_pathway_effectiveness' AND NEW.user_id IS NULL THEN
    PERFORM graphrag.enqueue_central_sync(
      v_entity_type, NEW.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'upsert', v_payload
    );
  ELSE
    PERFORM graphrag.enqueue_sync(
      NEW.user_id, v_entity_type, NEW.id,
      TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, 'upsert', v_payload
    );
  END IF;
  RETURN NEW;
END $$;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'goal_probability_distributions','goal_probability_snapshots','goal_decision_impacts',
    'goal_pathway_probabilities','goal_future_states','decision_marginal_impacts',
    'trajectory_variance_factors'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trigger_graphrag_%I_sync ON decision_intelligence.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER trigger_graphrag_%I_sync '
      'AFTER INSERT OR UPDATE OR DELETE ON decision_intelligence.%I '
      'FOR EACH ROW EXECUTE FUNCTION decision_intelligence.trigger_decision_intel_sync()',
      t, t
    );
  END LOOP;
END $$;


-- ###########################################################################
-- Self-test
-- ###########################################################################
DO $$
DECLARE t TEXT; v_rls BOOLEAN;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'goal_probability_distributions','goal_probability_snapshots','goal_decision_impacts',
    'goal_pathway_probabilities','goal_future_states','decision_marginal_impacts',
    'trajectory_variance_factors'
  ]
  LOOP
    SELECT relrowsecurity INTO v_rls
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'decision_intelligence' AND c.relname = t;
    IF v_rls IS NULL THEN
      RAISE EXCEPTION '081 self-test: missing table decision_intelligence.%', t;
    END IF;
    IF NOT v_rls THEN
      RAISE EXCEPTION '081 self-test: RLS not enabled on decision_intelligence.%', t;
    END IF;
  END LOOP;
END $$;
