-- ==========================================================================
-- 090: Beta Operations + Feedback + Cost Meter
--
-- Sprint M adds the operational surface needed for a controlled closed
-- beta:
--
--   1. ops.feature_flags + ops.user_feature_flag_overrides
--   2. ops.beta_invites + ops.cohorts + ops.user_cohorts
--   3. feedback.recommendation_feedback / simulation_feedback /
--      nps_responses / bug_reports / overall_feedback
--   4. ops.llm_usage_meter + ops.retrieval_cache_meter
--
-- All tables RLS-protected. Feature flags are world-readable; user
-- overrides are owner-scoped. Feedback rows are owner-scoped.
-- LLM usage meter is service-role write + owner read of own rows.
-- ==========================================================================

CREATE SCHEMA IF NOT EXISTS ops;
CREATE SCHEMA IF NOT EXISTS feedback;
GRANT USAGE ON SCHEMA ops      TO authenticated, service_role;
GRANT USAGE ON SCHEMA feedback TO authenticated, service_role;


-- ###########################################################################
-- Enums
-- ###########################################################################

CREATE OR REPLACE FUNCTION ops.is_flag_kind(p TEXT) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE AS $$
  SELECT p IN ('boolean','percentage','cohort','allow_list','env')
$$;

CREATE OR REPLACE FUNCTION ops.is_invite_status(p TEXT) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE AS $$
  SELECT p IN ('pending','sent','accepted','expired','revoked')
$$;

CREATE OR REPLACE FUNCTION ops.is_cohort_slug(p TEXT) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE AS $$
  SELECT p IN ('veterans','families','professionals','arcana','employer_pilot','internal','press','default')
$$;

CREATE OR REPLACE FUNCTION feedback.is_rec_feedback(p TEXT) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE AS $$
  SELECT p IN ('helpful','not_helpful','confusing','incorrect','out_of_scope','privacy_concern','other')
$$;

CREATE OR REPLACE FUNCTION feedback.is_sim_feedback(p TEXT) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE AS $$
  SELECT p IN ('useful','not_useful','confusing','inaccurate','too_optimistic','too_pessimistic','other')
$$;

CREATE OR REPLACE FUNCTION feedback.is_bug_severity(p TEXT) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE AS $$
  SELECT p IN ('low','medium','high','critical')
$$;

CREATE OR REPLACE FUNCTION ops.is_llm_provider(p TEXT) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE AS $$
  SELECT p IN ('gemini','openai','anthropic','local','other')
$$;


-- ###########################################################################
-- 1. Feature flags
-- ###########################################################################

CREATE TABLE IF NOT EXISTS ops.feature_flags (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         TEXT NOT NULL UNIQUE,
  description  TEXT,
  flag_kind    TEXT NOT NULL DEFAULT 'boolean' CHECK (ops.is_flag_kind(flag_kind)),
  enabled      BOOLEAN NOT NULL DEFAULT FALSE,
  rollout_pct  NUMERIC(5,2) CHECK (rollout_pct IS NULL OR rollout_pct BETWEEN 0 AND 100),
  cohort_slug  TEXT CHECK (cohort_slug IS NULL OR ops.is_cohort_slug(cohort_slug)),
  allowed_user_ids UUID[] NOT NULL DEFAULT '{}',
  metadata     JSONB NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ops.user_feature_flag_overrides (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  flag_slug    TEXT NOT NULL REFERENCES ops.feature_flags(slug) ON DELETE CASCADE,
  enabled      BOOLEAN NOT NULL,
  reason       TEXT,
  expires_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_flag_unique UNIQUE (user_id, flag_slug)
);
CREATE INDEX IF NOT EXISTS idx_uffo_user ON ops.user_feature_flag_overrides(user_id);


-- ###########################################################################
-- 2. Beta invites + cohorts
-- ###########################################################################

CREATE TABLE IF NOT EXISTS ops.beta_invites (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email        TEXT NOT NULL,
  invite_code  TEXT NOT NULL UNIQUE,
  cohort_slug  TEXT NOT NULL DEFAULT 'default' CHECK (ops.is_cohort_slug(cohort_slug)),
  invited_by   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  invited_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at      TIMESTAMPTZ,
  accepted_at  TIMESTAMPTZ,
  accepted_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  expires_at   TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  revoked_at   TIMESTAMPTZ,
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (ops.is_invite_status(status)),
  metadata     JSONB NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bi_email ON ops.beta_invites(email);
CREATE INDEX IF NOT EXISTS idx_bi_status ON ops.beta_invites(status, expires_at);

CREATE TABLE IF NOT EXISTS ops.cohorts (
  slug         TEXT PRIMARY KEY CHECK (ops.is_cohort_slug(slug)),
  name         TEXT NOT NULL,
  description  TEXT,
  metadata     JSONB NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ops.user_cohorts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  cohort_slug TEXT NOT NULL REFERENCES ops.cohorts(slug) ON DELETE CASCADE,
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  left_at     TIMESTAMPTZ,
  metadata    JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_cohort_unique UNIQUE (user_id, cohort_slug)
);
CREATE INDEX IF NOT EXISTS idx_uc_user ON ops.user_cohorts(user_id, left_at);


-- ###########################################################################
-- 3. Feedback tables
-- ###########################################################################

CREATE TABLE IF NOT EXISTS feedback.recommendation_feedback (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recommendation_id    UUID,                                  -- soft-FK
  recommendation_table TEXT,                                  -- where the rec lives
  agent_kind           TEXT,                                  -- maps to governance.agent_registry
  agent_name           TEXT,
  governance_audit_id  UUID REFERENCES governance.decision_governance_audit(id) ON DELETE SET NULL,
  feedback_kind        TEXT NOT NULL CHECK (feedback.is_rec_feedback(feedback_kind)),
  comment              TEXT,
  metadata             JSONB NOT NULL DEFAULT '{}',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rf_user ON feedback.recommendation_feedback(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rf_rec  ON feedback.recommendation_feedback(recommendation_id);

CREATE TABLE IF NOT EXISTS feedback.simulation_feedback (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  simulation_id   UUID,                                       -- soft-FK to life_trajectory or similar
  feedback_kind   TEXT NOT NULL CHECK (feedback.is_sim_feedback(feedback_kind)),
  comment         TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sf_user ON feedback.simulation_feedback(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS feedback.nps_responses (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  score        INT NOT NULL CHECK (score BETWEEN 0 AND 10),
  comment      TEXT,
  prompt_slug  TEXT,                                          -- which prompt triggered the survey
  metadata     JSONB NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_nps_user ON feedback.nps_responses(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS feedback.bug_reports (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  severity     TEXT NOT NULL DEFAULT 'medium' CHECK (feedback.is_bug_severity(severity)),
  title        TEXT NOT NULL,
  body         TEXT NOT NULL,
  route_path   TEXT,
  user_agent   TEXT,
  app_version  TEXT,
  metadata     JSONB NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bug_user ON feedback.bug_reports(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS feedback.overall_feedback (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  comment      TEXT NOT NULL,
  metadata     JSONB NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_of_user ON feedback.overall_feedback(user_id, created_at DESC);


-- ###########################################################################
-- 4. Cost meter
-- ###########################################################################

CREATE TABLE IF NOT EXISTS ops.llm_usage_meter (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  provider          TEXT NOT NULL CHECK (ops.is_llm_provider(provider)),
  model             TEXT NOT NULL,
  operation_kind    TEXT NOT NULL,                            -- 'advisor.message', 'recommendation.draft', 'simulation', etc.
  tokens_in         INT  NOT NULL DEFAULT 0,
  tokens_out        INT  NOT NULL DEFAULT 0,
  latency_ms        INT,
  cost_usd_micros   BIGINT NOT NULL DEFAULT 0,                -- cost in millionths of a USD; integer math
  request_id        UUID,
  governance_audit_id UUID REFERENCES governance.decision_governance_audit(id) ON DELETE SET NULL,
  metadata          JSONB NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_llm_user ON ops.llm_usage_meter(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_llm_op   ON ops.llm_usage_meter(operation_kind, created_at DESC);

CREATE TABLE IF NOT EXISTS ops.retrieval_cache_meter (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_kind      TEXT NOT NULL,                              -- 'constitutional_principles', 'safety_rules', etc.
  hit             BOOLEAN NOT NULL,
  latency_ms      INT,
  retrieved_count INT,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rcm_kind ON ops.retrieval_cache_meter(cache_kind, created_at DESC);


-- ###########################################################################
-- Seeds — cohorts + bootstrap feature flags
-- ###########################################################################

INSERT INTO ops.cohorts (slug, name, description) VALUES
  ('default',        'Default',         'General-purpose beta cohort'),
  ('veterans',       'Veterans',        'US veteran-focused cohort'),
  ('families',       'Families',        'Families with dependents cohort'),
  ('professionals',  'Professionals',   'High-earner professional cohort'),
  ('arcana',         'Arcana',          'Arcana Health + Performance cohort'),
  ('employer_pilot', 'Employer Pilot',  'Employer-sponsored pilot cohort'),
  ('internal',       'Internal',        'Team + dogfooding'),
  ('press',          'Press',           'Press/media demo cohort')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO ops.feature_flags (slug, description, flag_kind, enabled, rollout_pct) VALUES
  ('arcana.enabled',                 'Master switch for the Arcana surface',                  'boolean', TRUE,  100),
  ('arcana.lead_packages',           'Enable lead package generation',                        'boolean', TRUE,  100),
  ('arcana.wearable_oauth',          'Real OAuth flows for wearables (stub in beta)',         'boolean', FALSE, 0),
  ('provider_portal.enabled',        'Provider portal global enable',                         'boolean', TRUE,  100),
  ('simulations.life_trajectory',    'Life trajectory simulator',                             'boolean', TRUE,  100),
  ('advisor.conversation_intel',     'Advisor conversation intelligence + drill-down',        'boolean', TRUE,  100),
  ('governance.constitutional_live', 'Use the live constitutional retrieval (vs. fallback)',  'boolean', TRUE,  100),
  ('governance.crisis_escalation',   'Prepend crisis escalation framing when level≥HIGH',     'boolean', TRUE,  100),
  ('beta.feedback_widget',           'Show the in-app feedback widget',                       'boolean', TRUE,  100),
  ('beta.nps_prompt',                'Prompt users for NPS after 7 sessions',                 'boolean', TRUE,  10),
  ('observability.sentry',           'Send errors to Sentry (no-op if not configured)',       'boolean', TRUE,  100),
  ('observability.otel',             'Emit OpenTelemetry spans (no-op if not configured)',    'boolean', TRUE,  100),
  ('integrations.plaid',             'Plaid account sync',                                     'boolean', TRUE,  100),
  ('integrations.gemini',            'Gemini model usage',                                     'boolean', TRUE,  100)
ON CONFLICT (slug) DO NOTHING;


-- ###########################################################################
-- updated_at triggers
-- ###########################################################################
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'feature_flags','user_feature_flag_overrides','beta_invites','cohorts','user_cohorts'
  ] LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS set_%I_updated_at ON ops.%I; '
      'CREATE TRIGGER set_%I_updated_at BEFORE UPDATE ON ops.%I '
      'FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();',
      t, t, t, t
    );
  END LOOP;

  FOREACH t IN ARRAY ARRAY[
    'recommendation_feedback','simulation_feedback','bug_reports'
  ] LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS set_%I_updated_at ON feedback.%I; '
      'CREATE TRIGGER set_%I_updated_at BEFORE UPDATE ON feedback.%I '
      'FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();',
      t, t, t, t
    );
  END LOOP;
END $$;


-- ###########################################################################
-- RLS
-- ###########################################################################

ALTER TABLE ops.feature_flags                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.user_feature_flag_overrides   ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.beta_invites                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.cohorts                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.user_cohorts                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.llm_usage_meter               ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops.retrieval_cache_meter         ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback.recommendation_feedback  ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback.simulation_feedback      ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback.nps_responses            ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback.bug_reports              ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback.overall_feedback         ENABLE ROW LEVEL SECURITY;

-- Feature flags + cohorts: world-readable (so the UI can render)
DROP POLICY IF EXISTS ff_public_select ON ops.feature_flags;
CREATE POLICY ff_public_select ON ops.feature_flags FOR SELECT USING (true);
DROP POLICY IF EXISTS ff_service ON ops.feature_flags;
CREATE POLICY ff_service ON ops.feature_flags FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS c_public_select ON ops.cohorts;
CREATE POLICY c_public_select ON ops.cohorts FOR SELECT USING (true);
DROP POLICY IF EXISTS c_service ON ops.cohorts;
CREATE POLICY c_service ON ops.cohorts FOR ALL TO service_role USING (true) WITH CHECK (true);

-- User feature flag overrides: owner read; service write
DROP POLICY IF EXISTS uffo_owner_select ON ops.user_feature_flag_overrides;
CREATE POLICY uffo_owner_select ON ops.user_feature_flag_overrides
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS uffo_service ON ops.user_feature_flag_overrides;
CREATE POLICY uffo_service ON ops.user_feature_flag_overrides
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- User cohorts: owner read; service write
DROP POLICY IF EXISTS uc_owner_select ON ops.user_cohorts;
CREATE POLICY uc_owner_select ON ops.user_cohorts FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS uc_service ON ops.user_cohorts;
CREATE POLICY uc_service ON ops.user_cohorts FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Beta invites: invited recipient can read by email through service role lookups;
-- the authenticated user can read invites granted to them via the
-- service-role-only redemption endpoint. We restrict generic reads.
DROP POLICY IF EXISTS bi_owner_select ON ops.beta_invites;
CREATE POLICY bi_owner_select ON ops.beta_invites
  FOR SELECT USING (auth.uid() = accepted_by OR auth.uid() = invited_by);
DROP POLICY IF EXISTS bi_service ON ops.beta_invites;
CREATE POLICY bi_service ON ops.beta_invites FOR ALL TO service_role USING (true) WITH CHECK (true);

-- LLM usage meter: owner read; service write only
DROP POLICY IF EXISTS llm_owner_select ON ops.llm_usage_meter;
CREATE POLICY llm_owner_select ON ops.llm_usage_meter
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS llm_service ON ops.llm_usage_meter;
CREATE POLICY llm_service ON ops.llm_usage_meter FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Retrieval cache meter: service role only (it's pure ops telemetry)
DROP POLICY IF EXISTS rcm_service ON ops.retrieval_cache_meter;
CREATE POLICY rcm_service ON ops.retrieval_cache_meter FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Feedback: owner can insert + read own
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'recommendation_feedback','simulation_feedback','nps_responses','bug_reports','overall_feedback'
  ] LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON feedback.%I; '
      'CREATE POLICY %I ON feedback.%I FOR SELECT USING (auth.uid() = user_id);',
      t || '_owner_select', t, t || '_owner_select', t
    );
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON feedback.%I; '
      'CREATE POLICY %I ON feedback.%I FOR INSERT WITH CHECK (auth.uid() = user_id);',
      t || '_owner_insert', t, t || '_owner_insert', t
    );
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON feedback.%I; '
      'CREATE POLICY %I ON feedback.%I FOR ALL TO service_role USING (true) WITH CHECK (true);',
      t || '_service', t, t || '_service', t
    );
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA ops      TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA feedback TO authenticated;


-- ###########################################################################
-- Public views
-- ###########################################################################
CREATE OR REPLACE VIEW public.ops_feature_flags                AS SELECT * FROM ops.feature_flags;
CREATE OR REPLACE VIEW public.ops_user_feature_flag_overrides  AS SELECT * FROM ops.user_feature_flag_overrides;
CREATE OR REPLACE VIEW public.ops_cohorts                      AS SELECT * FROM ops.cohorts;
CREATE OR REPLACE VIEW public.ops_user_cohorts                 AS SELECT * FROM ops.user_cohorts;
CREATE OR REPLACE VIEW public.ops_beta_invites                 AS SELECT * FROM ops.beta_invites;
CREATE OR REPLACE VIEW public.ops_llm_usage_meter              AS SELECT * FROM ops.llm_usage_meter;

CREATE OR REPLACE VIEW public.feedback_recommendation_feedback AS SELECT * FROM feedback.recommendation_feedback;
CREATE OR REPLACE VIEW public.feedback_simulation_feedback     AS SELECT * FROM feedback.simulation_feedback;
CREATE OR REPLACE VIEW public.feedback_nps_responses           AS SELECT * FROM feedback.nps_responses;
CREATE OR REPLACE VIEW public.feedback_bug_reports             AS SELECT * FROM feedback.bug_reports;
CREATE OR REPLACE VIEW public.feedback_overall_feedback        AS SELECT * FROM feedback.overall_feedback;

GRANT SELECT                ON public.ops_feature_flags                TO authenticated;
GRANT SELECT                ON public.ops_user_feature_flag_overrides  TO authenticated;
GRANT SELECT                ON public.ops_cohorts                      TO authenticated;
GRANT SELECT                ON public.ops_user_cohorts                 TO authenticated;
GRANT SELECT                ON public.ops_beta_invites                 TO authenticated;
GRANT SELECT                ON public.ops_llm_usage_meter              TO authenticated;
GRANT SELECT, INSERT        ON public.feedback_recommendation_feedback TO authenticated;
GRANT SELECT, INSERT        ON public.feedback_simulation_feedback     TO authenticated;
GRANT SELECT, INSERT        ON public.feedback_nps_responses           TO authenticated;
GRANT SELECT, INSERT        ON public.feedback_bug_reports             TO authenticated;
GRANT SELECT, INSERT        ON public.feedback_overall_feedback        TO authenticated;


-- ###########################################################################
-- Self-test
-- ###########################################################################
DO $$
DECLARE n INT; rls BOOLEAN;
BEGIN
  SELECT relrowsecurity INTO rls FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'feedback' AND c.relname = 'recommendation_feedback';
  IF NOT rls THEN RAISE EXCEPTION '090 self-test: RLS missing on recommendation_feedback'; END IF;

  SELECT COUNT(*) INTO n FROM ops.cohorts;
  IF n < 8 THEN RAISE EXCEPTION '090 self-test: cohorts under-seeded (n=%)', n; END IF;

  SELECT COUNT(*) INTO n FROM ops.feature_flags;
  IF n < 12 THEN RAISE EXCEPTION '090 self-test: feature_flags under-seeded (n=%)', n; END IF;
END $$;
