-- ==========================================================================
-- 084: Advisor Conversation Intelligence
--
-- Builds on top of:
--   * goal_discovery_turns (068) — per-turn raw audit
--   * recommendation_audit_trail (082) — engine input/output snapshot
--   * advisor-conversation-agent.ts (Sprint A) — base agent contract
--
-- Adds three tables in decision_intelligence:
--
--   * discovery_sessions      — session-level state + driver convergence
--                                + dominant driver + completion status
--   * assumption_challenges   — Socratic challenges issued + user
--                                response, used by the
--                                AdvisorConversationAgent's challenge
--                                primitive
--   * conversation_traces     — per-turn structured audit (intent,
--                                turn_kind, explainer kind, drivers
--                                detected at this turn, llm_call
--                                bookkeeping)
--
-- All three: strict owner-only RLS, public read-views, sync into the
-- existing trigger_decision_intel_sync().
-- ==========================================================================


-- -------------------------------------------------------------------------
-- Enums
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION decision_intelligence.is_discovery_domain(p TEXT) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE AS $$
  SELECT p IN ('financial','career','health','education','estate','general')
$$;

CREATE OR REPLACE FUNCTION decision_intelligence.is_discovery_status(p TEXT) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE AS $$
  SELECT p IN ('active','paused','completed','abandoned')
$$;

CREATE OR REPLACE FUNCTION decision_intelligence.is_dominant_driver(p TEXT) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE AS $$
  SELECT p IS NULL OR p IN ('financial_security','image','performance')
$$;

CREATE OR REPLACE FUNCTION decision_intelligence.is_challenge_response(p TEXT) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE AS $$
  SELECT p IN ('pending','acknowledged','pushed_back','changed_mind','ignored')
$$;

CREATE OR REPLACE FUNCTION decision_intelligence.is_explainer_kind(p TEXT) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE AS $$
  SELECT p IN ('tradeoff','simulation','probability','assumption_challenge','followup','recommendation')
$$;


-- -------------------------------------------------------------------------
-- 1. discovery_sessions — session-level state
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS decision_intelligence.discovery_sessions (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  goal_id                     UUID REFERENCES public.goals(id) ON DELETE SET NULL,
  domain                      TEXT NOT NULL CHECK (decision_intelligence.is_discovery_domain(domain)),
  status                      TEXT NOT NULL DEFAULT 'active'
                              CHECK (decision_intelligence.is_discovery_status(status)),
  started_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at                TIMESTAMPTZ,
  -- Need-Behind-Need drill-down state
  current_depth               INT NOT NULL DEFAULT 0 CHECK (current_depth >= 0),
  max_depth                   INT NOT NULL DEFAULT 3 CHECK (max_depth BETWEEN 1 AND 5),
  -- Driver scoring — Achieve Global framework: Financial Security / Image / Performance.
  financial_security_score    NUMERIC(3,2) CHECK (financial_security_score IS NULL OR financial_security_score BETWEEN 0 AND 1),
  image_score                 NUMERIC(3,2) CHECK (image_score IS NULL OR image_score BETWEEN 0 AND 1),
  performance_score           NUMERIC(3,2) CHECK (performance_score IS NULL OR performance_score BETWEEN 0 AND 1),
  dominant_driver             TEXT CHECK (decision_intelligence.is_dominant_driver(dominant_driver)),
  secondary_driver            TEXT CHECK (decision_intelligence.is_dominant_driver(secondary_driver)),
  driver_confidence           NUMERIC(3,2) CHECK (driver_confidence IS NULL OR driver_confidence BETWEEN 0 AND 1),
  -- Resolved root goal at session end (mirrored into goals.root_goal).
  inferred_root_goal          TEXT,
  inferred_root_goal_confidence NUMERIC(3,2) CHECK (inferred_root_goal_confidence IS NULL OR inferred_root_goal_confidence BETWEEN 0 AND 1),
  -- Session-level transcript handle (back to goal_discovery_turns).
  primary_session_token       UUID,                                  -- matches goal_discovery_turns.session_id
  metadata                    JSONB NOT NULL DEFAULT '{}',
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dsess_user_status ON decision_intelligence.discovery_sessions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_dsess_user_goal   ON decision_intelligence.discovery_sessions(user_id, goal_id);
CREATE INDEX IF NOT EXISTS idx_dsess_token       ON decision_intelligence.discovery_sessions(primary_session_token) WHERE primary_session_token IS NOT NULL;


-- -------------------------------------------------------------------------
-- 2. assumption_challenges — Socratic challenge surface
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS decision_intelligence.assumption_challenges (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  session_id                  UUID REFERENCES decision_intelligence.discovery_sessions(id) ON DELETE SET NULL,
  audit_id                    UUID REFERENCES decision_intelligence.recommendation_audit_trail(id) ON DELETE SET NULL,
  assumption_id               UUID REFERENCES decision_intelligence.recommendation_assumptions(id) ON DELETE SET NULL,
  assumption_text             TEXT NOT NULL,
  challenge_prompt            TEXT NOT NULL,
  challenge_kind              TEXT NOT NULL DEFAULT 'what_if'
                              CHECK (challenge_kind IN ('what_if','why_assume','counter_evidence','time_pressure','recency_bias')),
  user_response               TEXT,
  response_state              TEXT NOT NULL DEFAULT 'pending'
                              CHECK (decision_intelligence.is_challenge_response(response_state)),
  changed_outcome             BOOLEAN NOT NULL DEFAULT FALSE,
  issued_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at                TIMESTAMPTZ,
  metadata                    JSONB NOT NULL DEFAULT '{}',
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_chal_user_session ON decision_intelligence.assumption_challenges(user_id, session_id);
CREATE INDEX IF NOT EXISTS idx_chal_user_audit   ON decision_intelligence.assumption_challenges(user_id, audit_id);


-- -------------------------------------------------------------------------
-- 3. conversation_traces — per-turn structured audit
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS decision_intelligence.conversation_traces (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  session_id                  UUID REFERENCES decision_intelligence.discovery_sessions(id) ON DELETE SET NULL,
  audit_id                    UUID REFERENCES decision_intelligence.recommendation_audit_trail(id) ON DELETE SET NULL,
  turn_index                  INT NOT NULL CHECK (turn_index >= 0),
  user_message                TEXT,
  classified_intent           TEXT NOT NULL,
  turn_kind                   TEXT NOT NULL,
  explainer_kind              TEXT CHECK (explainer_kind IS NULL OR decision_intelligence.is_explainer_kind(explainer_kind)),
  used_llm                    BOOLEAN NOT NULL DEFAULT FALSE,
  llm_calls                   INT NOT NULL DEFAULT 0,
  llm_rejected_mutations      TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  detected_drivers            JSONB NOT NULL DEFAULT '{}',
  missing_info_count          INT NOT NULL DEFAULT 0,
  contradiction_count         INT NOT NULL DEFAULT 0,
  agent_payload               JSONB NOT NULL DEFAULT '{}',
  occurred_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata                    JSONB NOT NULL DEFAULT '{}',
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT trace_unique UNIQUE (user_id, session_id, turn_index)
);
CREATE INDEX IF NOT EXISTS idx_trace_user_session ON decision_intelligence.conversation_traces(user_id, session_id, turn_index);


-- -------------------------------------------------------------------------
-- Triggers — updated_at on all 3 tables
-- -------------------------------------------------------------------------
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['discovery_sessions','assumption_challenges','conversation_traces']
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS set_%I_updated_at ON decision_intelligence.%I; '
      'CREATE TRIGGER set_%I_updated_at BEFORE UPDATE ON decision_intelligence.%I '
      'FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();',
      t, t, t, t
    );
  END LOOP;
END $$;


-- -------------------------------------------------------------------------
-- RLS
-- -------------------------------------------------------------------------
ALTER TABLE decision_intelligence.discovery_sessions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE decision_intelligence.assumption_challenges    ENABLE ROW LEVEL SECURITY;
ALTER TABLE decision_intelligence.conversation_traces      ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['discovery_sessions','assumption_challenges','conversation_traces']
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
  ON decision_intelligence.discovery_sessions,
     decision_intelligence.assumption_challenges,
     decision_intelligence.conversation_traces
  TO authenticated;


-- -------------------------------------------------------------------------
-- Public read-views
-- -------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.discovery_sessions       AS SELECT * FROM decision_intelligence.discovery_sessions;
CREATE OR REPLACE VIEW public.assumption_challenges    AS SELECT * FROM decision_intelligence.assumption_challenges;
CREATE OR REPLACE VIEW public.conversation_traces      AS SELECT * FROM decision_intelligence.conversation_traces;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.discovery_sessions,
     public.assumption_challenges,
     public.conversation_traces
  TO authenticated;


-- -------------------------------------------------------------------------
-- GraphRAG sync — extend the existing trigger to cover the new tables.
-- -------------------------------------------------------------------------
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
    WHEN 'recommendation_audit_trail'      THEN 'recommendation_audit_trail'
    WHEN 'why_chains'                      THEN 'why_chain'
    WHEN 'evidence_links'                  THEN 'evidence_link'
    WHEN 'counterfactual_scenarios'        THEN 'counterfactual_scenario'
    WHEN 'recommendation_assumptions'      THEN 'recommendation_assumption'
    -- 084
    WHEN 'discovery_sessions'              THEN 'discovery_session'
    WHEN 'assumption_challenges'           THEN 'assumption_challenge'
    WHEN 'conversation_traces'             THEN 'conversation_trace'
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
  FOREACH t IN ARRAY ARRAY['discovery_sessions','assumption_challenges','conversation_traces']
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


-- -------------------------------------------------------------------------
-- Self-test
-- -------------------------------------------------------------------------
DO $$
DECLARE t TEXT; v_rls BOOLEAN;
BEGIN
  FOREACH t IN ARRAY ARRAY['discovery_sessions','assumption_challenges','conversation_traces']
  LOOP
    SELECT relrowsecurity INTO v_rls
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'decision_intelligence' AND c.relname = t;
    IF v_rls IS NULL THEN
      RAISE EXCEPTION '084 self-test: missing table decision_intelligence.%', t;
    END IF;
    IF NOT v_rls THEN
      RAISE EXCEPTION '084 self-test: RLS not enabled on decision_intelligence.%', t;
    END IF;
  END LOOP;
END $$;
