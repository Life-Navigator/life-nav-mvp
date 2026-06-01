-- ==========================================================================
-- 080: Goal Progress + Cross-Domain Attribution + Confidence Calibration
--     + Recommendation Quality + Pathway Effectiveness
--
-- Closes the gap from Sprint B by adding the eleven tables that let
-- LifeNavigator answer:
--
--    Did this recommendation work?
--    How much did it move the root goal?
--    Which domains contributed?
--    How accurate was our confidence?
--    Which pathways historically perform best?
--
-- All tables live in the existing `decision_intelligence` schema (079).
-- Strict owner-only RLS; service_role escape hatch for cron jobs that
-- maintain calibration + quality + pathway aggregates.
--
-- Every user-scoped row carries `user_id` and is auto-routed through
-- `graphrag.enqueue_sync(...)` with access_scope='personal'.
-- Aggregate pathway effectiveness is centrally projectable via a
-- separate trigger that goes through enqueue_central_sync().
-- ==========================================================================


-- -------------------------------------------------------------------------
-- Shared enums
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION decision_intelligence.is_progress_event_type(p TEXT) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE AS $$
  SELECT p IN ('decision_made','outcome_observed','milestone_reached',
               'snapshot_taken','manual_adjustment','rollback')
$$;

CREATE OR REPLACE FUNCTION decision_intelligence.is_progress_period(p TEXT) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE AS $$
  SELECT p IN ('weekly','monthly','quarterly','annual')
$$;

CREATE OR REPLACE FUNCTION decision_intelligence.is_attribution_label(p TEXT) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE AS $$
  SELECT p IN ('CONTRIBUTED_TO','INFLUENCED','ACCELERATED',
               'DELAYED','BLOCKED','SUPPORTED')
$$;

CREATE OR REPLACE FUNCTION decision_intelligence.is_domain(p TEXT) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE AS $$
  SELECT p IN ('financial','career','education','health','insurance',
               'benefits','estate','entrepreneurship','family','cross_domain')
$$;


-- ###########################################################################
-- Phase 1 — Goal Progress Engine
-- ###########################################################################

-- 1. goal_progress_snapshots — point-in-time score per goal
CREATE TABLE IF NOT EXISTS decision_intelligence.goal_progress_snapshots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  goal_id         UUID NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  snapshot_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  score           NUMERIC(4,3) NOT NULL CHECK (score BETWEEN 0 AND 1),
  confidence      NUMERIC(3,2) CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 1),
  source          TEXT NOT NULL DEFAULT 'engine'
                  CHECK (source IN ('engine','self_report','computed','admin')),
  inputs          JSONB NOT NULL DEFAULT '{}',
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_gps_user_goal ON decision_intelligence.goal_progress_snapshots(user_id, goal_id, snapshot_at DESC);


-- 2. goal_progress_events — every event that nudged a goal
CREATE TABLE IF NOT EXISTS decision_intelligence.goal_progress_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  goal_id         UUID NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  event_type      TEXT NOT NULL CHECK (decision_intelligence.is_progress_event_type(event_type)),
  delta           NUMERIC(5,4) NOT NULL DEFAULT 0,           -- signed change to score (-1..1)
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Loose FKs — events can link to any source table.
  decision_id     UUID REFERENCES decision_intelligence.decision_journals(id) ON DELETE SET NULL,
  outcome_id      UUID REFERENCES decision_intelligence.decision_outcomes(id) ON DELETE SET NULL,
  snapshot_id     UUID REFERENCES decision_intelligence.goal_progress_snapshots(id) ON DELETE SET NULL,
  reason          TEXT,
  confidence      NUMERIC(3,2) CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 1),
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_gpe_user_goal ON decision_intelligence.goal_progress_events(user_id, goal_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_gpe_user_event ON decision_intelligence.goal_progress_events(user_id, event_type);


-- 3. goal_progress_scores — period-rollup with confidence
CREATE TABLE IF NOT EXISTS decision_intelligence.goal_progress_scores (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  goal_id         UUID NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  period          TEXT NOT NULL CHECK (decision_intelligence.is_progress_period(period)),
  period_start    DATE NOT NULL,
  period_end      DATE,
  score           NUMERIC(4,3) NOT NULL CHECK (score BETWEEN 0 AND 1),
  delta           NUMERIC(5,4) NOT NULL DEFAULT 0,
  confidence      NUMERIC(3,2) CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 1),
  events_count    INT NOT NULL DEFAULT 0 CHECK (events_count >= 0),
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT gpscore_unique UNIQUE (user_id, goal_id, period, period_start)
);
CREATE INDEX IF NOT EXISTS idx_gpscore_user ON decision_intelligence.goal_progress_scores(user_id, goal_id, period_start DESC);


-- 4. goal_progress_predictions — forecast + later validation
CREATE TABLE IF NOT EXISTS decision_intelligence.goal_progress_predictions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  goal_id               UUID NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  predicted_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  target_date           DATE NOT NULL,
  predicted_score       NUMERIC(4,3) NOT NULL CHECK (predicted_score BETWEEN 0 AND 1),
  confidence            NUMERIC(3,2) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  model_version         TEXT NOT NULL DEFAULT 'progress_v1',
  inputs                JSONB NOT NULL DEFAULT '{}',
  -- Validation fields (populated after target_date passes)
  validated_at          TIMESTAMPTZ,
  validation_score      NUMERIC(4,3) CHECK (validation_score IS NULL OR validation_score BETWEEN 0 AND 1),
  validation_error      NUMERIC(5,4),
  metadata              JSONB NOT NULL DEFAULT '{}',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_gpp_user_goal ON decision_intelligence.goal_progress_predictions(user_id, goal_id, target_date);


-- ###########################################################################
-- Phase 2 — Cross-Domain Outcome Attribution
-- ###########################################################################

-- 5. cross_domain_impacts — observed impact between domains
CREATE TABLE IF NOT EXISTS decision_intelligence.cross_domain_impacts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source_domain   TEXT NOT NULL CHECK (decision_intelligence.is_domain(source_domain)),
  target_domain   TEXT NOT NULL CHECK (decision_intelligence.is_domain(target_domain)),
  label           TEXT NOT NULL CHECK (decision_intelligence.is_attribution_label(label)),
  strength        NUMERIC(3,2) NOT NULL CHECK (strength BETWEEN 0 AND 1),
  confidence      NUMERIC(3,2) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  evidence        JSONB NOT NULL DEFAULT '[]',
  observed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source_outcome_id   UUID REFERENCES decision_intelligence.decision_outcomes(id) ON DELETE SET NULL,
  source_goal_id      UUID REFERENCES public.goals(id) ON DELETE SET NULL,
  target_goal_id      UUID REFERENCES public.goals(id) ON DELETE SET NULL,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT cdi_no_self CHECK (source_domain <> target_domain OR source_goal_id IS DISTINCT FROM target_goal_id)
);
CREATE INDEX IF NOT EXISTS idx_cdi_user_source ON decision_intelligence.cross_domain_impacts(user_id, source_domain);
CREATE INDEX IF NOT EXISTS idx_cdi_user_target ON decision_intelligence.cross_domain_impacts(user_id, target_domain);


-- 6. outcome_attributions — share of credit a decision gets for an outcome
CREATE TABLE IF NOT EXISTS decision_intelligence.outcome_attributions (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  outcome_id                  UUID NOT NULL REFERENCES decision_intelligence.decision_outcomes(id) ON DELETE CASCADE,
  attributed_to_decision_id   UUID REFERENCES decision_intelligence.decision_journals(id) ON DELETE SET NULL,
  attributed_to_action_id     TEXT,                            -- recommendation action id
  attributed_to_recommendation_summary TEXT,
  attribution_share           NUMERIC(4,3) NOT NULL CHECK (attribution_share BETWEEN 0 AND 1),
  confidence                  NUMERIC(3,2) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  reasoning                   TEXT,
  metadata                    JSONB NOT NULL DEFAULT '{}',
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_oa_user_outcome ON decision_intelligence.outcome_attributions(user_id, outcome_id);
CREATE INDEX IF NOT EXISTS idx_oa_user_decision ON decision_intelligence.outcome_attributions(user_id, attributed_to_decision_id);


-- ###########################################################################
-- Phase 3 — Confidence Calibration
-- ###########################################################################

-- 7. prediction_calibration — one row per (prediction, observation) pair
CREATE TABLE IF NOT EXISTS decision_intelligence.prediction_calibration (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  predicted_at        TIMESTAMPTZ NOT NULL,
  predicted_confidence NUMERIC(4,3) NOT NULL CHECK (predicted_confidence BETWEEN 0 AND 1),
  predicted_value     NUMERIC,                                -- expected numeric outcome (optional)
  actual_correct      BOOLEAN,                                -- did the prediction "land"?
  actual_value        NUMERIC,                                -- observed numeric outcome (optional)
  bucket              TEXT NOT NULL,                          -- '0.0-0.1','0.1-0.2',...
  source_run_id       UUID,                                   -- advisor_run_id correlation
  source_action_id    TEXT,
  source_decision_id  UUID REFERENCES decision_intelligence.decision_journals(id) ON DELETE SET NULL,
  source_outcome_id   UUID REFERENCES decision_intelligence.decision_outcomes(id) ON DELETE SET NULL,
  validated_at        TIMESTAMPTZ,
  metadata            JSONB NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pc_user_bucket ON decision_intelligence.prediction_calibration(user_id, bucket);
CREATE INDEX IF NOT EXISTS idx_pc_user_predicted ON decision_intelligence.prediction_calibration(user_id, predicted_at DESC);


-- 8. recommendation_accuracy — predicted vs observed strength per action
CREATE TABLE IF NOT EXISTS decision_intelligence.recommendation_accuracy (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  advisor_run_id          UUID,
  action_id               TEXT NOT NULL,
  predicted_strength      NUMERIC(4,3) CHECK (predicted_strength IS NULL OR predicted_strength BETWEEN 0 AND 1),
  predicted_confidence    NUMERIC(4,3) CHECK (predicted_confidence IS NULL OR predicted_confidence BETWEEN 0 AND 1),
  observed_outcome_quality NUMERIC(4,3) CHECK (observed_outcome_quality IS NULL OR observed_outcome_quality BETWEEN 0 AND 1),
  observed_strength       NUMERIC(4,3) CHECK (observed_strength IS NULL OR observed_strength BETWEEN 0 AND 1),
  accuracy_score          NUMERIC(4,3) CHECK (accuracy_score IS NULL OR accuracy_score BETWEEN 0 AND 1),
  computed_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata                JSONB NOT NULL DEFAULT '{}',
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT racc_recommendation_unique UNIQUE (user_id, advisor_run_id, action_id)
);
CREATE INDEX IF NOT EXISTS idx_recacc_user_run ON decision_intelligence.recommendation_accuracy(user_id, advisor_run_id);


-- 9. advisor_accuracy — per-advisor-run aggregate (Brier + calibration error)
CREATE TABLE IF NOT EXISTS decision_intelligence.advisor_accuracy (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  advisor_run_id              UUID NOT NULL,
  computed_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  total_actions               INT  NOT NULL DEFAULT 0,
  completed_actions           INT  NOT NULL DEFAULT 0,
  abandoned_actions           INT  NOT NULL DEFAULT 0,
  rejected_actions            INT  NOT NULL DEFAULT 0,
  mean_predicted_confidence   NUMERIC(4,3),
  mean_observed_outcome_quality NUMERIC(4,3),
  brier_score                 NUMERIC(5,4),                    -- 0 perfect, 1 worst
  calibration_error           NUMERIC(5,4),                    -- mean |conf-actual| across bins
  confidence_accuracy_gap     NUMERIC(5,4),                    -- mean_confidence - mean_outcome_quality
  metadata                    JSONB NOT NULL DEFAULT '{}',
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT aacc_unique UNIQUE (user_id, advisor_run_id)
);
CREATE INDEX IF NOT EXISTS idx_aacc_user ON decision_intelligence.advisor_accuracy(user_id, computed_at DESC);


-- ###########################################################################
-- Phase 4 — Recommendation Quality Engine
-- ###########################################################################

-- 10. recommendation_quality_metrics — periodic aggregate keyed by (period, type, domain, root_goal)
CREATE TABLE IF NOT EXISTS decision_intelligence.recommendation_quality_metrics (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  period              TEXT NOT NULL CHECK (decision_intelligence.is_progress_period(period)),
  period_start        DATE NOT NULL,
  recommendation_type TEXT NOT NULL DEFAULT 'all',
  domain              TEXT NOT NULL DEFAULT 'all',
  root_goal_id        UUID REFERENCES public.goals(id) ON DELETE SET NULL,
  advisor_run_id      UUID,
  total               INT NOT NULL DEFAULT 0,
  accepted            INT NOT NULL DEFAULT 0,
  rejected            INT NOT NULL DEFAULT 0,
  modified            INT NOT NULL DEFAULT 0,
  deferred            INT NOT NULL DEFAULT 0,
  completed           INT NOT NULL DEFAULT 0,
  abandoned           INT NOT NULL DEFAULT 0,
  success_rate        NUMERIC(4,3) CHECK (success_rate IS NULL OR success_rate BETWEEN 0 AND 1),
  completion_rate     NUMERIC(4,3) CHECK (completion_rate IS NULL OR completion_rate BETWEEN 0 AND 1),
  mean_outcome_quality NUMERIC(4,3) CHECK (mean_outcome_quality IS NULL OR mean_outcome_quality BETWEEN 0 AND 1),
  mean_user_satisfaction NUMERIC(4,3) CHECK (mean_user_satisfaction IS NULL OR mean_user_satisfaction BETWEEN 0 AND 1),
  computed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata            JSONB NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT rqm_unique UNIQUE (user_id, period, period_start, recommendation_type, domain, root_goal_id)
);
CREATE INDEX IF NOT EXISTS idx_rqm_user ON decision_intelligence.recommendation_quality_metrics(user_id, period_start DESC);


-- ###########################################################################
-- Phase 5 — Goal Pathway Effectiveness
-- ###########################################################################

-- 11. goal_pathway_effectiveness — per-user OR per-cohort (user_id nil = global)
CREATE TABLE IF NOT EXISTS decision_intelligence.goal_pathway_effectiveness (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID REFERENCES public.profiles(id) ON DELETE CASCADE,  -- NULL = global cohort
  root_goal_concept   TEXT NOT NULL,                          -- e.g. 'Financial Independence'
  pathway_signature   TEXT NOT NULL,                          -- hash of edge labels
  pathway_label       TEXT NOT NULL,                          -- human-readable
  pathway_edges       JSONB NOT NULL DEFAULT '[]',            -- [{label, target_canonical_name}, ...]
  sample_size         INT NOT NULL DEFAULT 0 CHECK (sample_size >= 0),
  success_count       INT NOT NULL DEFAULT 0 CHECK (success_count >= 0),
  success_rate        NUMERIC(4,3) CHECK (success_rate IS NULL OR success_rate BETWEEN 0 AND 1),
  completion_rate     NUMERIC(4,3) CHECK (completion_rate IS NULL OR completion_rate BETWEEN 0 AND 1),
  mean_duration_months NUMERIC(6,2),
  confidence          NUMERIC(3,2) CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 1),
  computed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata            JSONB NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT gpe_unique UNIQUE NULLS NOT DISTINCT (user_id, root_goal_concept, pathway_signature)
);
CREATE INDEX IF NOT EXISTS idx_gpe_root ON decision_intelligence.goal_pathway_effectiveness(root_goal_concept);
CREATE INDEX IF NOT EXISTS idx_gpe_user ON decision_intelligence.goal_pathway_effectiveness(user_id) WHERE user_id IS NOT NULL;


-- ###########################################################################
-- Triggers — updated_at on all 11 tables
-- ###########################################################################
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'goal_progress_snapshots','goal_progress_events','goal_progress_scores','goal_progress_predictions',
    'cross_domain_impacts','outcome_attributions',
    'prediction_calibration','recommendation_accuracy','advisor_accuracy',
    'recommendation_quality_metrics','goal_pathway_effectiveness'
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
-- RLS — strict owner-only with service_role escape hatch.
-- goal_pathway_effectiveness allows reading rows where user_id IS NULL
-- (global cohort) to all authenticated users — those aren't personal.
-- ###########################################################################
ALTER TABLE decision_intelligence.goal_progress_snapshots         ENABLE ROW LEVEL SECURITY;
ALTER TABLE decision_intelligence.goal_progress_events            ENABLE ROW LEVEL SECURITY;
ALTER TABLE decision_intelligence.goal_progress_scores            ENABLE ROW LEVEL SECURITY;
ALTER TABLE decision_intelligence.goal_progress_predictions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE decision_intelligence.cross_domain_impacts            ENABLE ROW LEVEL SECURITY;
ALTER TABLE decision_intelligence.outcome_attributions            ENABLE ROW LEVEL SECURITY;
ALTER TABLE decision_intelligence.prediction_calibration          ENABLE ROW LEVEL SECURITY;
ALTER TABLE decision_intelligence.recommendation_accuracy         ENABLE ROW LEVEL SECURITY;
ALTER TABLE decision_intelligence.advisor_accuracy                ENABLE ROW LEVEL SECURITY;
ALTER TABLE decision_intelligence.recommendation_quality_metrics  ENABLE ROW LEVEL SECURITY;
ALTER TABLE decision_intelligence.goal_pathway_effectiveness      ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'goal_progress_snapshots','goal_progress_events','goal_progress_scores','goal_progress_predictions',
    'cross_domain_impacts','outcome_attributions',
    'prediction_calibration','recommendation_accuracy','advisor_accuracy',
    'recommendation_quality_metrics'
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

-- goal_pathway_effectiveness: owner sees own rows + everyone sees globals.
CREATE POLICY goal_pathway_effectiveness_owner
  ON decision_intelligence.goal_pathway_effectiveness
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY goal_pathway_effectiveness_read_global
  ON decision_intelligence.goal_pathway_effectiveness
  FOR SELECT TO authenticated USING (user_id IS NULL);
CREATE POLICY goal_pathway_effectiveness_service
  ON decision_intelligence.goal_pathway_effectiveness
  FOR ALL TO service_role USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE
  ON decision_intelligence.goal_progress_snapshots,
     decision_intelligence.goal_progress_events,
     decision_intelligence.goal_progress_scores,
     decision_intelligence.goal_progress_predictions,
     decision_intelligence.cross_domain_impacts,
     decision_intelligence.outcome_attributions,
     decision_intelligence.prediction_calibration,
     decision_intelligence.recommendation_accuracy,
     decision_intelligence.advisor_accuracy,
     decision_intelligence.recommendation_quality_metrics,
     decision_intelligence.goal_pathway_effectiveness
  TO authenticated;


-- ###########################################################################
-- Public read-views (PostgREST exposes public only)
-- ###########################################################################
CREATE OR REPLACE VIEW public.goal_progress_snapshots         AS SELECT * FROM decision_intelligence.goal_progress_snapshots;
CREATE OR REPLACE VIEW public.goal_progress_events            AS SELECT * FROM decision_intelligence.goal_progress_events;
CREATE OR REPLACE VIEW public.goal_progress_scores            AS SELECT * FROM decision_intelligence.goal_progress_scores;
CREATE OR REPLACE VIEW public.goal_progress_predictions       AS SELECT * FROM decision_intelligence.goal_progress_predictions;
CREATE OR REPLACE VIEW public.cross_domain_impacts            AS SELECT * FROM decision_intelligence.cross_domain_impacts;
CREATE OR REPLACE VIEW public.outcome_attributions            AS SELECT * FROM decision_intelligence.outcome_attributions;
CREATE OR REPLACE VIEW public.prediction_calibration          AS SELECT * FROM decision_intelligence.prediction_calibration;
CREATE OR REPLACE VIEW public.recommendation_accuracy         AS SELECT * FROM decision_intelligence.recommendation_accuracy;
CREATE OR REPLACE VIEW public.advisor_accuracy                AS SELECT * FROM decision_intelligence.advisor_accuracy;
CREATE OR REPLACE VIEW public.recommendation_quality_metrics  AS SELECT * FROM decision_intelligence.recommendation_quality_metrics;
CREATE OR REPLACE VIEW public.goal_pathway_effectiveness      AS SELECT * FROM decision_intelligence.goal_pathway_effectiveness;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.goal_progress_snapshots,
     public.goal_progress_events,
     public.goal_progress_scores,
     public.goal_progress_predictions,
     public.cross_domain_impacts,
     public.outcome_attributions,
     public.prediction_calibration,
     public.recommendation_accuracy,
     public.advisor_accuracy,
     public.recommendation_quality_metrics,
     public.goal_pathway_effectiveness
  TO authenticated;


-- ###########################################################################
-- Phase 6 — GraphRAG Sync
--
-- Single trigger function that emits a row to graphrag.sync_queue per
-- table. entity_type encodes the source table; the Rust worker maps
-- each to a PascalCase Neo4j label and a Person → entity edge.
-- ###########################################################################
CREATE OR REPLACE FUNCTION decision_intelligence.trigger_decision_intel_sync()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_entity_type TEXT;
  v_payload     JSONB;
BEGIN
  v_entity_type := CASE TG_TABLE_NAME
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
  -- Strip user_id from payload — it's already on the queue row.
  v_payload := v_payload - 'user_id';

  -- Route central cohort effectiveness rows (user_id IS NULL) through
  -- the central queue; everything else stays personal.
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
    'goal_progress_snapshots','goal_progress_events','goal_progress_scores','goal_progress_predictions',
    'cross_domain_impacts','outcome_attributions',
    'prediction_calibration','recommendation_accuracy','advisor_accuracy',
    'recommendation_quality_metrics','goal_pathway_effectiveness'
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
DECLARE
  t TEXT;
  v_rls BOOLEAN;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'goal_progress_snapshots','goal_progress_events','goal_progress_scores','goal_progress_predictions',
    'cross_domain_impacts','outcome_attributions',
    'prediction_calibration','recommendation_accuracy','advisor_accuracy',
    'recommendation_quality_metrics','goal_pathway_effectiveness'
  ]
  LOOP
    SELECT relrowsecurity INTO v_rls
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'decision_intelligence' AND c.relname = t;
    IF v_rls IS NULL THEN
      RAISE EXCEPTION '080 self-test: missing table decision_intelligence.%', t;
    END IF;
    IF NOT v_rls THEN
      RAISE EXCEPTION '080 self-test: RLS not enabled on decision_intelligence.%', t;
    END IF;
  END LOOP;
END $$;
