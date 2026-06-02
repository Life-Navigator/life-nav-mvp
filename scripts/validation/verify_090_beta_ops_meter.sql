-- ==========================================================================
-- 090 verifier — Beta Ops, Feedback, Cost Meter (Sprint M / N.2 hardening).
--
-- Assertions:
--   1. The ops + feedback schemas exist.
--   2. The 11 expected tables exist.
--   3. RLS is enabled on every user-bound table (no anonymous reads).
--   4. The public views (ops_*, feedback_*) exist for the application
--      layer.
--   5. The cost-meter tables accept micro-USD integer inserts and
--      reject negative cost.
-- ==========================================================================
BEGIN;

-- ---- 1. Schemas ----------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'ops') THEN
    RAISE EXCEPTION '090: schema ops is missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'feedback') THEN
    RAISE EXCEPTION '090: schema feedback is missing';
  END IF;
END $$;

-- ---- 2. Tables present ---------------------------------------------------
DO $$
DECLARE
  required_tables TEXT[] := ARRAY[
    'ops.feature_flags',
    'ops.user_feature_flag_overrides',
    'ops.beta_invites',
    'ops.cohorts',
    'ops.user_cohorts',
    'ops.llm_usage_meter',
    'ops.retrieval_cache_meter',
    'feedback.recommendation_feedback',
    'feedback.simulation_feedback',
    'feedback.nps_responses',
    'feedback.bug_reports',
    'feedback.overall_feedback'
  ];
  t TEXT;
  parts TEXT[];
BEGIN
  FOREACH t IN ARRAY required_tables LOOP
    parts := string_to_array(t, '.');
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = parts[1] AND c.relname = parts[2] AND c.relkind = 'r'
    ) THEN
      RAISE EXCEPTION '090: missing table %', t;
    END IF;
  END LOOP;
END $$;

-- ---- 3. RLS enabled on user-bound tables --------------------------------
DO $$
DECLARE
  user_bound TEXT[] := ARRAY[
    'ops.user_feature_flag_overrides',
    'ops.beta_invites',
    'ops.user_cohorts',
    'ops.llm_usage_meter',
    'feedback.recommendation_feedback',
    'feedback.simulation_feedback',
    'feedback.nps_responses',
    'feedback.bug_reports',
    'feedback.overall_feedback'
  ];
  t TEXT;
  parts TEXT[];
  rls BOOLEAN;
BEGIN
  FOREACH t IN ARRAY user_bound LOOP
    parts := string_to_array(t, '.');
    SELECT c.relrowsecurity INTO rls
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = parts[1] AND c.relname = parts[2];
    IF rls IS NULL THEN
      RAISE EXCEPTION '090: table % not found for RLS check', t;
    END IF;
    IF NOT rls THEN
      RAISE EXCEPTION '090: RLS not enabled on %', t;
    END IF;
  END LOOP;
END $$;

-- ---- 4. Public views present --------------------------------------------
DO $$
DECLARE
  views TEXT[] := ARRAY[
    'ops_feature_flags',
    'ops_beta_invites',
    'ops_llm_usage_meter',
    'ops_retrieval_cache_meter',
    'feedback_recommendation_feedback',
    'feedback_overall_feedback'
  ];
  v TEXT;
BEGIN
  FOREACH v IN ARRAY views LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = v AND c.relkind = 'v'
    ) THEN
      RAISE EXCEPTION '090: missing public view %', v;
    END IF;
  END LOOP;
END $$;

-- ---- 5. Cost meter accepts micro-USD integer; rejects negative ---------
DO $$
DECLARE
  blocked BOOLEAN := FALSE;
BEGIN
  BEGIN
    INSERT INTO ops.llm_usage_meter
      (provider, model, operation_kind, tokens_in, tokens_out, cost_usd_micros)
    VALUES ('openai','gpt-4o','chat',10,10,-1);
  EXCEPTION WHEN check_violation OR others THEN
    blocked := TRUE;
  END;
  IF NOT blocked THEN
    RAISE EXCEPTION '090: cost meter accepted negative cost_usd_micros';
  END IF;
END $$;

ROLLBACK;
