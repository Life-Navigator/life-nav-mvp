-- ==========================================================================
-- 082: XAI + Trust Layer
--
-- Five tables that make every recommendation, probability distribution,
-- and decision impact answerable to five deterministic questions:
--
--   * Why?
--   * Why is that important?
--   * What evidence supports this?
--   * What assumptions are you making?
--   * What would change the recommendation?
--
-- The LLM (Gemini) is NOT allowed to mediate the answer path. All
-- five questions are answered from these tables + the pure WhyChain /
-- EvidenceGraph / Counterfactual / Assumption services.
--
-- Schema lives in the existing decision_intelligence schema. Strict
-- owner-only RLS. Sync triggers extend the existing
-- trigger_decision_intel_sync().
-- ==========================================================================

CREATE OR REPLACE FUNCTION decision_intelligence.is_audit_target_kind(p TEXT) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE AS $$
  SELECT p IN (
    'recommendation_output','goal_decision_impact','goal_probability_distribution',
    'catch_up_plan','ahead_of_plan_plan','marginal_impact_ranking'
  )
$$;

CREATE OR REPLACE FUNCTION decision_intelligence.is_evidence_source_kind(p TEXT) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE AS $$
  SELECT p IN (
    'central_ontology','personal_history','pathway_effectiveness',
    'recommendation_quality','calibration_history','goal_progress_snapshot',
    'goal_hierarchy_edge','user_constraint','user_capability','user_motivation',
    'self_report','assumption'
  )
$$;

CREATE OR REPLACE FUNCTION decision_intelligence.is_assumption_severity(p TEXT) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE AS $$
  SELECT p IN ('informational','load_bearing','critical')
$$;

CREATE OR REPLACE FUNCTION decision_intelligence.is_counterfactual_outcome(p TEXT) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE AS $$
  SELECT p IN ('no_change','reranked','flipped','timeline_shifted','confidence_changed')
$$;


-- ###########################################################################
-- 1. recommendation_audit_trail — one row per recommendation generation
-- ###########################################################################
CREATE TABLE IF NOT EXISTS decision_intelligence.recommendation_audit_trail (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  advisor_run_id           UUID,
  target_kind              TEXT NOT NULL CHECK (decision_intelligence.is_audit_target_kind(target_kind)),
  target_id                UUID,                                       -- FK loosely to the relevant target table
  -- Frozen snapshot of every input the engines saw at compute time.
  input_snapshot           JSONB NOT NULL,
  engine_versions          JSONB NOT NULL DEFAULT '{}',                -- {"probability":"v1","impact":"v1",...}
  intermediate             JSONB NOT NULL DEFAULT '{}',                -- step-by-step numbers
  output_summary           JSONB NOT NULL,                             -- final structured output (without LLM phrasing)
  computed_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration_ms              INT,
  metadata                 JSONB NOT NULL DEFAULT '{}',
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT audit_unique UNIQUE (user_id, advisor_run_id, target_kind, target_id)
);
CREATE INDEX IF NOT EXISTS idx_audit_user_target ON decision_intelligence.recommendation_audit_trail(user_id, target_kind, target_id);
CREATE INDEX IF NOT EXISTS idx_audit_user_run    ON decision_intelligence.recommendation_audit_trail(user_id, advisor_run_id);


-- ###########################################################################
-- 2. why_chains — DAG of "claim → because" hops
-- ###########################################################################
CREATE TABLE IF NOT EXISTS decision_intelligence.why_chains (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  audit_id                 UUID REFERENCES decision_intelligence.recommendation_audit_trail(id) ON DELETE CASCADE,
  target_kind              TEXT NOT NULL CHECK (decision_intelligence.is_audit_target_kind(target_kind)),
  target_id                UUID,
  -- Each node: {claim, depth, grounded_in, confidence}.
  -- Each edge: {parent_node_id, child_node_id, label}.
  nodes                    JSONB NOT NULL DEFAULT '[]',
  edges                    JSONB NOT NULL DEFAULT '[]',
  /** Number of "because" hops captured at build time. The builder caps
   *  recursion at MAX_DEPTH = 5 by default. */
  max_depth                INT NOT NULL DEFAULT 5,
  computed_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata                 JSONB NOT NULL DEFAULT '{}',
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT why_unique UNIQUE (user_id, target_kind, target_id, computed_at)
);
CREATE INDEX IF NOT EXISTS idx_why_user_target ON decision_intelligence.why_chains(user_id, target_kind, target_id);


-- ###########################################################################
-- 3. evidence_links — explicit links from a target to its evidence sources
-- ###########################################################################
CREATE TABLE IF NOT EXISTS decision_intelligence.evidence_links (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  audit_id                 UUID REFERENCES decision_intelligence.recommendation_audit_trail(id) ON DELETE CASCADE,
  target_kind              TEXT NOT NULL CHECK (decision_intelligence.is_audit_target_kind(target_kind)),
  target_id                UUID,
  source_kind              TEXT NOT NULL CHECK (decision_intelligence.is_evidence_source_kind(source_kind)),
  source_id                UUID,                                       -- loose FK; depends on source_kind
  source_label             TEXT NOT NULL,
  citation_reference       TEXT,
  confidence               NUMERIC(4,3) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  weight                   NUMERIC(4,3) NOT NULL DEFAULT 1.0 CHECK (weight BETWEEN 0 AND 1),
  metadata                 JSONB NOT NULL DEFAULT '{}',
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ev_user_target ON decision_intelligence.evidence_links(user_id, target_kind, target_id);
CREATE INDEX IF NOT EXISTS idx_ev_user_source ON decision_intelligence.evidence_links(user_id, source_kind);


-- ###########################################################################
-- 4. counterfactual_scenarios — pre-computed "what would change this?"
-- ###########################################################################
CREATE TABLE IF NOT EXISTS decision_intelligence.counterfactual_scenarios (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  audit_id                 UUID REFERENCES decision_intelligence.recommendation_audit_trail(id) ON DELETE CASCADE,
  target_kind              TEXT NOT NULL CHECK (decision_intelligence.is_audit_target_kind(target_kind)),
  target_id                UUID,
  scenario_label           TEXT NOT NULL,
  perturbation             JSONB NOT NULL,                              -- {input_field, from, to, magnitude}
  expected_outcome         TEXT NOT NULL CHECK (decision_intelligence.is_counterfactual_outcome(expected_outcome)),
  new_top_recommendation   TEXT,
  new_confidence           NUMERIC(4,3) CHECK (new_confidence IS NULL OR new_confidence BETWEEN 0 AND 1),
  delta_summary            TEXT,
  sensitivity              NUMERIC(4,3) NOT NULL CHECK (sensitivity BETWEEN 0 AND 1),
  computed_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata                 JSONB NOT NULL DEFAULT '{}',
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cf_user_target ON decision_intelligence.counterfactual_scenarios(user_id, target_kind, target_id);


-- ###########################################################################
-- 5. recommendation_assumptions — indexed first-class assumption storage
-- ###########################################################################
CREATE TABLE IF NOT EXISTS decision_intelligence.recommendation_assumptions (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  audit_id                 UUID REFERENCES decision_intelligence.recommendation_audit_trail(id) ON DELETE CASCADE,
  target_kind              TEXT NOT NULL CHECK (decision_intelligence.is_audit_target_kind(target_kind)),
  target_id                UUID,
  assumption_text          TEXT NOT NULL,
  severity                 TEXT NOT NULL DEFAULT 'load_bearing'
                           CHECK (decision_intelligence.is_assumption_severity(severity)),
  sensitivity              NUMERIC(4,3) NOT NULL DEFAULT 0.5
                           CHECK (sensitivity BETWEEN 0 AND 1),       -- how much would output change if this flipped?
  source_engine            TEXT NOT NULL,                              -- 'probability'|'impact'|'catch_up'|'ahead'|'ranker'|'reasoning'
  source_field             TEXT,                                       -- which input drove the assumption
  evidence_link_id         UUID REFERENCES decision_intelligence.evidence_links(id) ON DELETE SET NULL,
  acknowledged_by_user     BOOLEAN NOT NULL DEFAULT FALSE,
  acknowledged_at          TIMESTAMPTZ,
  metadata                 JSONB NOT NULL DEFAULT '{}',
  computed_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_assump_user_target ON decision_intelligence.recommendation_assumptions(user_id, target_kind, target_id);
CREATE INDEX IF NOT EXISTS idx_assump_user_sev   ON decision_intelligence.recommendation_assumptions(user_id, severity);


-- ###########################################################################
-- Triggers — updated_at on all 5 tables
-- ###########################################################################
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'recommendation_audit_trail','why_chains','evidence_links',
    'counterfactual_scenarios','recommendation_assumptions'
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
ALTER TABLE decision_intelligence.recommendation_audit_trail  ENABLE ROW LEVEL SECURITY;
ALTER TABLE decision_intelligence.why_chains                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE decision_intelligence.evidence_links              ENABLE ROW LEVEL SECURITY;
ALTER TABLE decision_intelligence.counterfactual_scenarios    ENABLE ROW LEVEL SECURITY;
ALTER TABLE decision_intelligence.recommendation_assumptions  ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'recommendation_audit_trail','why_chains','evidence_links',
    'counterfactual_scenarios','recommendation_assumptions'
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
  ON decision_intelligence.recommendation_audit_trail,
     decision_intelligence.why_chains,
     decision_intelligence.evidence_links,
     decision_intelligence.counterfactual_scenarios,
     decision_intelligence.recommendation_assumptions
  TO authenticated;


-- ###########################################################################
-- Public read/write views
-- ###########################################################################
CREATE OR REPLACE VIEW public.recommendation_audit_trail  AS SELECT * FROM decision_intelligence.recommendation_audit_trail;
CREATE OR REPLACE VIEW public.why_chains                  AS SELECT * FROM decision_intelligence.why_chains;
CREATE OR REPLACE VIEW public.evidence_links              AS SELECT * FROM decision_intelligence.evidence_links;
CREATE OR REPLACE VIEW public.counterfactual_scenarios    AS SELECT * FROM decision_intelligence.counterfactual_scenarios;
CREATE OR REPLACE VIEW public.recommendation_assumptions  AS SELECT * FROM decision_intelligence.recommendation_assumptions;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.recommendation_audit_trail,
     public.why_chains,
     public.evidence_links,
     public.counterfactual_scenarios,
     public.recommendation_assumptions
  TO authenticated;


-- ###########################################################################
-- GraphRAG sync — extend the existing trigger to cover XAI tables.
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
    WHEN 'goal_probability_distributions'  THEN 'goal_probability_distribution'
    WHEN 'goal_probability_snapshots'      THEN 'goal_probability_snapshot'
    WHEN 'goal_decision_impacts'           THEN 'goal_decision_impact'
    WHEN 'goal_pathway_probabilities'      THEN 'goal_pathway_probability'
    WHEN 'goal_future_states'              THEN 'goal_future_state'
    WHEN 'decision_marginal_impacts'       THEN 'decision_marginal_impact'
    WHEN 'trajectory_variance_factors'     THEN 'trajectory_variance_factor'
    -- 082 entries
    WHEN 'recommendation_audit_trail'      THEN 'recommendation_audit_trail'
    WHEN 'why_chains'                      THEN 'why_chain'
    WHEN 'evidence_links'                  THEN 'evidence_link'
    WHEN 'counterfactual_scenarios'        THEN 'counterfactual_scenario'
    WHEN 'recommendation_assumptions'      THEN 'recommendation_assumption'
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
    'recommendation_audit_trail','why_chains','evidence_links',
    'counterfactual_scenarios','recommendation_assumptions'
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
    'recommendation_audit_trail','why_chains','evidence_links',
    'counterfactual_scenarios','recommendation_assumptions'
  ]
  LOOP
    SELECT relrowsecurity INTO v_rls
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'decision_intelligence' AND c.relname = t;
    IF v_rls IS NULL THEN
      RAISE EXCEPTION '082 self-test: missing table decision_intelligence.%', t;
    END IF;
    IF NOT v_rls THEN
      RAISE EXCEPTION '082 self-test: RLS not enabled on decision_intelligence.%', t;
    END IF;
  END LOOP;
END $$;
