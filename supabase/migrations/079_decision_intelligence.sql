-- ==========================================================================
-- 079: Decision Intelligence + Outcome Learning
--
-- Creates the Decision Journal layer so LifeNavigator can:
--   * record the *reasoning* behind each decision (not just the
--     decision itself) — recommendation + assumptions + expected
--     outcome + expected timeline + system confidence at the time
--   * track the actual outcome and how it compared
--   * close the loop with periodic retrospectives
--   * record per-recommendation acceptance/rejection/modification
--   * derive observational learning signals about the user (preferred
--     style, follow-through, risk behavior, decision tendencies,
--     procrastination indicators, motivation triggers)
--
-- All tables live in the new `decision_intelligence` schema. Strict
-- owner-only RLS on every table, with a service_role escape hatch for
-- worker / cron jobs that maintain `learning_signals`.
--
-- Ethics: the `learning_signals` table is OBSERVATIONAL by contract.
-- Any consumer that uses it to manipulate the user (withhold info,
-- exploit timing, dark patterns) is in violation. The TypeScript
-- application layer ships a `no_manipulation_guard` that enforces an
-- explicit whitelist of allowed signal-driven behaviors.
-- ==========================================================================


CREATE SCHEMA IF NOT EXISTS decision_intelligence;
GRANT USAGE ON SCHEMA decision_intelligence TO authenticated, service_role;


-- -------------------------------------------------------------------------
-- Shared enums (CHECK predicates so we can extend without ALTER TYPE)
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION decision_intelligence.is_decision_type(p TEXT) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE AS $$
  SELECT p IN (
    'financial','career','education','health','lifestyle',
    'relationship','estate','entrepreneurship','other'
  )
$$;

CREATE OR REPLACE FUNCTION decision_intelligence.is_journal_status(p TEXT) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE AS $$
  SELECT p IN ('pending','made','rescinded','superseded')
$$;

CREATE OR REPLACE FUNCTION decision_intelligence.is_acceptance_status(p TEXT) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE AS $$
  SELECT p IN ('accepted','rejected','modified','deferred','completed','abandoned')
$$;

CREATE OR REPLACE FUNCTION decision_intelligence.is_review_period(p TEXT) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE AS $$
  SELECT p IN ('7_day','30_day','90_day','180_day','1_year','final')
$$;

CREATE OR REPLACE FUNCTION decision_intelligence.is_review_verdict(p TEXT) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE AS $$
  SELECT p IN ('much_better_than_expected','better_than_expected','as_expected',
               'worse_than_expected','much_worse_than_expected','no_signal_yet')
$$;

CREATE OR REPLACE FUNCTION decision_intelligence.is_signal_kind(p TEXT) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE AS $$
  SELECT p IN (
    'preferred_communication_style',
    'follow_through_pattern',
    'risk_behavior',
    'decision_tendency',
    'procrastination_indicator',
    'motivation_trigger',
    'outcome_quality_distribution'
  )
$$;


-- -------------------------------------------------------------------------
-- 1. decision_journals — the master decision record
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS decision_intelligence.decision_journals (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- What is being decided.
  title                    TEXT NOT NULL,
  description              TEXT,
  decision_type            TEXT NOT NULL CHECK (decision_intelligence.is_decision_type(decision_type)),

  -- Provenance — where did this decision come from?
  source                   TEXT NOT NULL DEFAULT 'user'
                           CHECK (source IN ('user','advisor','scenario_lab','optimizer','external')),
  source_run_id            UUID,                              -- e.g. goal_optimizer_runs.id, life_scenario_versions.id
  related_goal_id          UUID REFERENCES public.goals(id) ON DELETE SET NULL,
  related_root_goal_id     UUID REFERENCES public.goals(id) ON DELETE SET NULL,

  -- Lifecycle.
  status                   TEXT NOT NULL DEFAULT 'pending'
                           CHECK (decision_intelligence.is_journal_status(status)),
  made_at                  TIMESTAMPTZ,                       -- when the user committed
  rescinded_at             TIMESTAMPTZ,
  superseded_by            UUID REFERENCES decision_intelligence.decision_journals(id) ON DELETE SET NULL,

  -- Reasoning capture at the time the decision was journaled.
  recommendation_summary   TEXT,                              -- what the system suggested
  reasoning                TEXT,                              -- in plain language
  assumptions              JSONB NOT NULL DEFAULT '[]'::jsonb, -- array of strings
  system_confidence_at_decision NUMERIC(3,2)
                           CHECK (system_confidence_at_decision IS NULL
                                  OR system_confidence_at_decision BETWEEN 0 AND 1),

  -- Metadata.
  metadata                 JSONB NOT NULL DEFAULT '{}',
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dj_user            ON decision_intelligence.decision_journals(user_id);
CREATE INDEX IF NOT EXISTS idx_dj_user_status     ON decision_intelligence.decision_journals(user_id, status);
CREATE INDEX IF NOT EXISTS idx_dj_user_made_at    ON decision_intelligence.decision_journals(user_id, made_at DESC);
CREATE INDEX IF NOT EXISTS idx_dj_root_goal       ON decision_intelligence.decision_journals(related_root_goal_id);


-- -------------------------------------------------------------------------
-- 2. decision_expectations — what we expect to happen and by when
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS decision_intelligence.decision_expectations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  journal_id      UUID NOT NULL REFERENCES decision_intelligence.decision_journals(id) ON DELETE CASCADE,

  -- One row per measurable expectation. dimension is a free TEXT so
  -- we can express anything: 'net_worth_delta', 'time_to_goal_months',
  -- 'income_growth_pct', 'health_metric: VO2max', 'months_to_completion'.
  dimension       TEXT NOT NULL,
  expected_value  NUMERIC,                                    -- numeric target where applicable
  expected_text   TEXT,                                       -- qualitative target where numeric isn't
  expected_unit   TEXT,                                       -- 'usd','months','%','bpm', ...
  expected_by     TIMESTAMPTZ,                                -- by-when timestamp
  confidence      NUMERIC(3,2) CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 1),
  rationale       TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT dexp_value_or_text CHECK (expected_value IS NOT NULL OR expected_text IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_dexp_journal ON decision_intelligence.decision_expectations(journal_id);
CREATE INDEX IF NOT EXISTS idx_dexp_user    ON decision_intelligence.decision_expectations(user_id);


-- -------------------------------------------------------------------------
-- 3. decision_outcomes — what actually happened
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS decision_intelligence.decision_outcomes (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  journal_id         UUID NOT NULL REFERENCES decision_intelligence.decision_journals(id) ON DELETE CASCADE,
  expectation_id     UUID REFERENCES decision_intelligence.decision_expectations(id) ON DELETE SET NULL,

  dimension          TEXT NOT NULL,
  observed_value     NUMERIC,
  observed_text      TEXT,
  observed_unit      TEXT,
  observed_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Computed deltas (signed). Populated by the application layer.
  delta_value        NUMERIC,                                  -- observed - expected (when numeric)
  delta_pct          NUMERIC,                                  -- (observed - expected) / abs(expected)
  accuracy_score     NUMERIC(3,2)
                     CHECK (accuracy_score IS NULL OR accuracy_score BETWEEN 0 AND 1),

  source             TEXT NOT NULL DEFAULT 'self_report'
                     CHECK (source IN ('self_report','computed','integration','admin')),
  notes              TEXT,
  metadata           JSONB NOT NULL DEFAULT '{}',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT dout_value_or_text CHECK (observed_value IS NOT NULL OR observed_text IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_dout_journal     ON decision_intelligence.decision_outcomes(journal_id);
CREATE INDEX IF NOT EXISTS idx_dout_expectation ON decision_intelligence.decision_outcomes(expectation_id);
CREATE INDEX IF NOT EXISTS idx_dout_user_obs    ON decision_intelligence.decision_outcomes(user_id, observed_at DESC);


-- -------------------------------------------------------------------------
-- 4. decision_reviews — periodic retrospective
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS decision_intelligence.decision_reviews (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  journal_id      UUID NOT NULL REFERENCES decision_intelligence.decision_journals(id) ON DELETE CASCADE,
  reviewed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  period          TEXT NOT NULL CHECK (decision_intelligence.is_review_period(period)),

  verdict         TEXT NOT NULL DEFAULT 'no_signal_yet'
                  CHECK (decision_intelligence.is_review_verdict(verdict)),
  lessons_learned TEXT,
  would_repeat    BOOLEAN,
  sentiment_score NUMERIC(3,2) CHECK (sentiment_score IS NULL OR sentiment_score BETWEEN -1 AND 1),
  next_check_at   TIMESTAMPTZ,

  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT drev_unique UNIQUE (journal_id, period)
);
CREATE INDEX IF NOT EXISTS idx_drev_journal ON decision_intelligence.decision_reviews(journal_id);
CREATE INDEX IF NOT EXISTS idx_drev_user    ON decision_intelligence.decision_reviews(user_id, reviewed_at DESC);


-- -------------------------------------------------------------------------
-- 5. recommendation_acceptance — per-action tracking
--
-- Each row corresponds to one recommended action (the `action_id`
-- strings emitted by AdvisorReasoningService.deriveActions).
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS decision_intelligence.recommendation_acceptance (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  advisor_run_id           UUID,                              -- correlate with the reasoning service run
  journal_id               UUID REFERENCES decision_intelligence.decision_journals(id) ON DELETE SET NULL,

  action_id                TEXT NOT NULL,                     -- e.g. 'act_1_req_xxxxxxxx'
  recommendation_summary   TEXT NOT NULL,
  expected_strength        NUMERIC(3,2)
                           CHECK (expected_strength IS NULL OR expected_strength BETWEEN 0 AND 1),
  domain                   TEXT,                              -- finance/career/...

  status                   TEXT NOT NULL DEFAULT 'deferred'
                           CHECK (decision_intelligence.is_acceptance_status(status)),
  modified_to              TEXT,                              -- description if status='modified'
  reason                   TEXT,                              -- why accepted/rejected/modified

  accepted_at              TIMESTAMPTZ,
  completed_at             TIMESTAMPTZ,
  abandoned_at             TIMESTAMPTZ,

  adherence_score          NUMERIC(3,2)
                           CHECK (adherence_score IS NULL OR adherence_score BETWEEN 0 AND 1),
  user_satisfaction        NUMERIC(3,2)
                           CHECK (user_satisfaction IS NULL OR user_satisfaction BETWEEN 0 AND 1),
  outcome_quality          NUMERIC(3,2)
                           CHECK (outcome_quality IS NULL OR outcome_quality BETWEEN 0 AND 1),

  metadata                 JSONB NOT NULL DEFAULT '{}',
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT racc_unique UNIQUE (user_id, advisor_run_id, action_id)
);
CREATE INDEX IF NOT EXISTS idx_racc_user_status  ON decision_intelligence.recommendation_acceptance(user_id, status);
CREATE INDEX IF NOT EXISTS idx_racc_user_run     ON decision_intelligence.recommendation_acceptance(user_id, advisor_run_id);
CREATE INDEX IF NOT EXISTS idx_racc_user_domain  ON decision_intelligence.recommendation_acceptance(user_id, domain);
CREATE INDEX IF NOT EXISTS idx_racc_user_accepted_at ON decision_intelligence.recommendation_acceptance(user_id, accepted_at DESC);


-- -------------------------------------------------------------------------
-- 6. learning_signals — derived, observational behavior signals
--
-- One row per (user, kind, key). `signal_value` is JSONB so each kind
-- can carry its own shape. `support_count` is the number of underlying
-- observations the signal was derived from — *never* present the
-- signal to the user as a fact when support_count is low.
--
-- This table is OBSERVATIONAL ONLY. The application-layer guard
-- (apps/web/src/lib/decision/personal-learning-profile.ts) enforces
-- the allowed-use whitelist; this schema simply stores aggregates.
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS decision_intelligence.learning_signals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  signal_kind     TEXT NOT NULL CHECK (decision_intelligence.is_signal_kind(signal_kind)),
  signal_key      TEXT NOT NULL,                              -- e.g. domain='finance', or 'overall'
  signal_value    JSONB NOT NULL,
  support_count   INT NOT NULL DEFAULT 0 CHECK (support_count >= 0),
  confidence      NUMERIC(3,2)
                  CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 1),
  computed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT lsig_unique UNIQUE (user_id, signal_kind, signal_key)
);
CREATE INDEX IF NOT EXISTS idx_lsig_user ON decision_intelligence.learning_signals(user_id);


-- -------------------------------------------------------------------------
-- 7. updated_at triggers
-- -------------------------------------------------------------------------
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['decision_journals','decision_expectations','decision_outcomes',
                            'decision_reviews','recommendation_acceptance','learning_signals']
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
-- 8. RLS — strict owner-only with service_role escape hatch
-- -------------------------------------------------------------------------
ALTER TABLE decision_intelligence.decision_journals        ENABLE ROW LEVEL SECURITY;
ALTER TABLE decision_intelligence.decision_expectations    ENABLE ROW LEVEL SECURITY;
ALTER TABLE decision_intelligence.decision_outcomes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE decision_intelligence.decision_reviews         ENABLE ROW LEVEL SECURITY;
ALTER TABLE decision_intelligence.recommendation_acceptance ENABLE ROW LEVEL SECURITY;
ALTER TABLE decision_intelligence.learning_signals         ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['decision_journals','decision_expectations','decision_outcomes',
                            'decision_reviews','recommendation_acceptance','learning_signals']
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
  ON decision_intelligence.decision_journals,
     decision_intelligence.decision_expectations,
     decision_intelligence.decision_outcomes,
     decision_intelligence.decision_reviews,
     decision_intelligence.recommendation_acceptance,
     decision_intelligence.learning_signals
  TO authenticated;


-- -------------------------------------------------------------------------
-- 9. Public views — let the standard Supabase client read aggregates
-- -------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.decision_journals AS
  SELECT * FROM decision_intelligence.decision_journals;

CREATE OR REPLACE VIEW public.decision_expectations AS
  SELECT * FROM decision_intelligence.decision_expectations;

CREATE OR REPLACE VIEW public.decision_outcomes AS
  SELECT * FROM decision_intelligence.decision_outcomes;

CREATE OR REPLACE VIEW public.decision_reviews AS
  SELECT * FROM decision_intelligence.decision_reviews;

CREATE OR REPLACE VIEW public.recommendation_acceptance AS
  SELECT * FROM decision_intelligence.recommendation_acceptance;

CREATE OR REPLACE VIEW public.learning_signals AS
  SELECT * FROM decision_intelligence.learning_signals;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.decision_journals,
     public.decision_expectations,
     public.decision_outcomes,
     public.decision_reviews,
     public.recommendation_acceptance,
     public.learning_signals
  TO authenticated;


-- -------------------------------------------------------------------------
-- 10. compute_learning_signals(user_id) — SECURITY DEFINER aggregator.
--
-- Pure observational. Computes seven signal families from the journal
-- + acceptance tables. Idempotent: UPSERT on (user, kind, key).
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION decision_intelligence.compute_learning_signals(p_user_id UUID)
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = decision_intelligence, public
AS $$
DECLARE
  v_inserted INT := 0;
BEGIN
  -- (a) follow_through_pattern: acceptance → completion rate per domain.
  INSERT INTO decision_intelligence.learning_signals
    (user_id, signal_kind, signal_key, signal_value, support_count, confidence)
  SELECT
    p_user_id,
    'follow_through_pattern',
    COALESCE(domain, 'overall'),
    jsonb_build_object(
      'accepted_count',  COUNT(*) FILTER (WHERE status = 'accepted'),
      'completed_count', COUNT(*) FILTER (WHERE status = 'completed'),
      'rejected_count',  COUNT(*) FILTER (WHERE status = 'rejected'),
      'abandoned_count', COUNT(*) FILTER (WHERE status = 'abandoned'),
      'completion_rate', CASE
        WHEN COUNT(*) FILTER (WHERE status IN ('accepted','completed','abandoned')) = 0 THEN 0
        ELSE COUNT(*) FILTER (WHERE status = 'completed')::NUMERIC
           / GREATEST(1, COUNT(*) FILTER (WHERE status IN ('accepted','completed','abandoned')))
        END
    ),
    COUNT(*)::INT,
    CASE WHEN COUNT(*) < 5 THEN 0.3
         WHEN COUNT(*) < 15 THEN 0.6
         ELSE 0.85 END
    FROM decision_intelligence.recommendation_acceptance
   WHERE user_id = p_user_id
   GROUP BY COALESCE(domain, 'overall')
  ON CONFLICT (user_id, signal_kind, signal_key) DO UPDATE
    SET signal_value = EXCLUDED.signal_value,
        support_count = EXCLUDED.support_count,
        confidence = EXCLUDED.confidence,
        computed_at = NOW();
  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  -- (b) decision_tendency: accepted vs rejected vs modified ratios.
  INSERT INTO decision_intelligence.learning_signals
    (user_id, signal_kind, signal_key, signal_value, support_count, confidence)
  SELECT
    p_user_id,
    'decision_tendency',
    'overall',
    jsonb_build_object(
      'accepts',   COUNT(*) FILTER (WHERE status = 'accepted'),
      'rejects',   COUNT(*) FILTER (WHERE status = 'rejected'),
      'modifies',  COUNT(*) FILTER (WHERE status = 'modified'),
      'defers',    COUNT(*) FILTER (WHERE status = 'deferred'),
      'accept_rate', CASE WHEN COUNT(*) = 0 THEN 0
                          ELSE COUNT(*) FILTER (WHERE status = 'accepted')::NUMERIC / COUNT(*)
                     END
    ),
    COUNT(*)::INT,
    CASE WHEN COUNT(*) < 5 THEN 0.3 WHEN COUNT(*) < 15 THEN 0.6 ELSE 0.85 END
    FROM decision_intelligence.recommendation_acceptance
   WHERE user_id = p_user_id
  ON CONFLICT (user_id, signal_kind, signal_key) DO UPDATE
    SET signal_value = EXCLUDED.signal_value,
        support_count = EXCLUDED.support_count,
        confidence = EXCLUDED.confidence,
        computed_at = NOW();

  -- (c) procrastination_indicator: median days from acceptance to completion or abandonment.
  INSERT INTO decision_intelligence.learning_signals
    (user_id, signal_kind, signal_key, signal_value, support_count, confidence)
  SELECT
    p_user_id,
    'procrastination_indicator',
    'overall',
    jsonb_build_object(
      'median_days_accept_to_complete', percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (completed_at - accepted_at)) / 86400)
        FILTER (WHERE status = 'completed' AND accepted_at IS NOT NULL AND completed_at IS NOT NULL),
      'abandon_count_after_30d', COUNT(*) FILTER (
        WHERE status = 'abandoned'
          AND accepted_at IS NOT NULL AND abandoned_at IS NOT NULL
          AND abandoned_at - accepted_at > INTERVAL '30 days'
      )
    ),
    COUNT(*) FILTER (WHERE status IN ('completed','abandoned') AND accepted_at IS NOT NULL),
    0.6
    FROM decision_intelligence.recommendation_acceptance
   WHERE user_id = p_user_id
  ON CONFLICT (user_id, signal_kind, signal_key) DO UPDATE
    SET signal_value = EXCLUDED.signal_value,
        support_count = EXCLUDED.support_count,
        confidence = EXCLUDED.confidence,
        computed_at = NOW();

  -- (d) outcome_quality_distribution: mean accuracy + delta direction.
  INSERT INTO decision_intelligence.learning_signals
    (user_id, signal_kind, signal_key, signal_value, support_count, confidence)
  SELECT
    p_user_id,
    'outcome_quality_distribution',
    'overall',
    jsonb_build_object(
      'mean_accuracy', AVG(accuracy_score) FILTER (WHERE accuracy_score IS NOT NULL),
      'count_better',  COUNT(*) FILTER (WHERE delta_value > 0),
      'count_as_expected', COUNT(*) FILTER (WHERE delta_value = 0),
      'count_worse',   COUNT(*) FILTER (WHERE delta_value < 0)
    ),
    COUNT(*)::INT,
    CASE WHEN COUNT(*) < 5 THEN 0.3 WHEN COUNT(*) < 15 THEN 0.6 ELSE 0.85 END
    FROM decision_intelligence.decision_outcomes
   WHERE user_id = p_user_id
  ON CONFLICT (user_id, signal_kind, signal_key) DO UPDATE
    SET signal_value = EXCLUDED.signal_value,
        support_count = EXCLUDED.support_count,
        confidence = EXCLUDED.confidence,
        computed_at = NOW();

  -- (e) risk_behavior: high-risk decisions accepted vs declined per domain.
  --     We approximate "high risk" as expected_strength < 0.5 + domain risk tolerance proxy.
  INSERT INTO decision_intelligence.learning_signals
    (user_id, signal_kind, signal_key, signal_value, support_count, confidence)
  SELECT
    p_user_id,
    'risk_behavior',
    COALESCE(domain, 'overall'),
    jsonb_build_object(
      'high_risk_accepts',
        COUNT(*) FILTER (WHERE status = 'accepted' AND expected_strength < 0.5),
      'high_risk_rejects',
        COUNT(*) FILTER (WHERE status = 'rejected' AND expected_strength < 0.5),
      'low_risk_accepts',
        COUNT(*) FILTER (WHERE status = 'accepted' AND expected_strength >= 0.5),
      'low_risk_rejects',
        COUNT(*) FILTER (WHERE status = 'rejected' AND expected_strength >= 0.5)
    ),
    COUNT(*)::INT,
    CASE WHEN COUNT(*) < 5 THEN 0.3 WHEN COUNT(*) < 15 THEN 0.6 ELSE 0.85 END
    FROM decision_intelligence.recommendation_acceptance
   WHERE user_id = p_user_id
   GROUP BY COALESCE(domain, 'overall')
  ON CONFLICT (user_id, signal_kind, signal_key) DO UPDATE
    SET signal_value = EXCLUDED.signal_value,
        support_count = EXCLUDED.support_count,
        confidence = EXCLUDED.confidence,
        computed_at = NOW();

  -- (f) motivation_trigger: counts of why-strings on accepts.
  INSERT INTO decision_intelligence.learning_signals
    (user_id, signal_kind, signal_key, signal_value, support_count, confidence)
  SELECT
    p_user_id,
    'motivation_trigger',
    'top_reasons_accepted',
    jsonb_agg(jsonb_build_object('reason', reason_value, 'count', cnt) ORDER BY cnt DESC),
    SUM(cnt)::INT,
    CASE WHEN SUM(cnt) < 5 THEN 0.3 WHEN SUM(cnt) < 15 THEN 0.6 ELSE 0.8 END
    FROM (
      SELECT reason AS reason_value, COUNT(*) AS cnt
        FROM decision_intelligence.recommendation_acceptance
       WHERE user_id = p_user_id
         AND status = 'accepted'
         AND reason IS NOT NULL
         AND length(trim(reason)) > 0
       GROUP BY reason
       ORDER BY COUNT(*) DESC
       LIMIT 10
    ) s
  ON CONFLICT (user_id, signal_kind, signal_key) DO UPDATE
    SET signal_value = EXCLUDED.signal_value,
        support_count = EXCLUDED.support_count,
        confidence = EXCLUDED.confidence,
        computed_at = NOW();

  -- (g) preferred_communication_style: average length of acceptance reasons.
  --     A weak proxy — long reasons => prefers detail; short => prefers brevity.
  INSERT INTO decision_intelligence.learning_signals
    (user_id, signal_kind, signal_key, signal_value, support_count, confidence)
  SELECT
    p_user_id,
    'preferred_communication_style',
    'overall',
    jsonb_build_object(
      'mean_reason_length', AVG(length(reason)) FILTER (WHERE reason IS NOT NULL),
      'mean_lessons_length', (
        SELECT AVG(length(lessons_learned))
          FROM decision_intelligence.decision_reviews
         WHERE user_id = p_user_id AND lessons_learned IS NOT NULL
      ),
      'style_proxy', CASE
        WHEN AVG(length(reason)) FILTER (WHERE reason IS NOT NULL) > 120 THEN 'detailed'
        WHEN AVG(length(reason)) FILTER (WHERE reason IS NOT NULL) >= 30 THEN 'balanced'
        ELSE 'brief' END
    ),
    COUNT(*)::INT,
    0.4
    FROM decision_intelligence.recommendation_acceptance
   WHERE user_id = p_user_id
  ON CONFLICT (user_id, signal_kind, signal_key) DO UPDATE
    SET signal_value = EXCLUDED.signal_value,
        support_count = EXCLUDED.support_count,
        confidence = EXCLUDED.confidence,
        computed_at = NOW();

  RETURN (SELECT COUNT(*)::INT FROM decision_intelligence.learning_signals WHERE user_id = p_user_id);
END $$;

GRANT EXECUTE ON FUNCTION decision_intelligence.compute_learning_signals(UUID) TO authenticated, service_role;


-- -------------------------------------------------------------------------
-- 11. Self-test: assert all six tables exist and RLS is enabled.
-- -------------------------------------------------------------------------
DO $$
DECLARE
  t TEXT;
  v_rls BOOLEAN;
BEGIN
  FOREACH t IN ARRAY ARRAY['decision_journals','decision_expectations','decision_outcomes',
                            'decision_reviews','recommendation_acceptance','learning_signals']
  LOOP
    SELECT relrowsecurity INTO v_rls
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'decision_intelligence' AND c.relname = t;
    IF v_rls IS NULL THEN
      RAISE EXCEPTION '079 self-test: missing table decision_intelligence.%', t;
    END IF;
    IF NOT v_rls THEN
      RAISE EXCEPTION '079 self-test: RLS not enabled on decision_intelligence.%', t;
    END IF;
  END LOOP;
END $$;
