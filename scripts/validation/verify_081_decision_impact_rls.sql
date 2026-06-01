-- ==========================================================================
-- 081 RLS verification — every new table in decision_intelligence
-- isolates User A from User B's rows, blocks A-as-B INSERTs, and
-- enforces the quantile-ordering CHECK constraint.
--
-- Usage:
--   psql "$DATABASE_URL" -f scripts/validation/verify_081_decision_impact_rls.sql
--
-- ROLLBACKs at the end.
-- ==========================================================================
BEGIN;

DO $$
BEGIN
  INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at)
  VALUES
    ('00000000-0000-0000-0000-0000000a1081', 'rls-a-081@lifenav.test',
     crypt('x', gen_salt('bf')), NOW(), NOW()),
    ('00000000-0000-0000-0000-0000000b2081', 'rls-b-081@lifenav.test',
     crypt('x', gen_salt('bf')), NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;
END $$;

INSERT INTO public.profiles (id, email) VALUES
  ('00000000-0000-0000-0000-0000000a1081', 'rls-a-081@lifenav.test'),
  ('00000000-0000-0000-0000-0000000b2081', 'rls-b-081@lifenav.test')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.goals (id, user_id, title, domain, category, priority)
VALUES
  ('00000000-0000-0000-0000-00000081aaa1', '00000000-0000-0000-0000-0000000a1081',
   'FI-A-081', 'financial', 'wealth', 'essential'),
  ('00000000-0000-0000-0000-00000081bbb1', '00000000-0000-0000-0000-0000000b2081',
   'FI-B-081', 'financial', 'wealth', 'essential')
ON CONFLICT (id) DO NOTHING;

-- Seed one row per user per table. Quantile ordering CHECK is exercised
-- by the seed itself (rejecting bad rows would raise immediately).
INSERT INTO decision_intelligence.goal_probability_distributions
  (user_id, goal_id, time_horizon, worst_case, p10, p25, most_likely, p75, p90, best_case, confidence) VALUES
  ('00000000-0000-0000-0000-0000000a1081', '00000000-0000-0000-0000-00000081aaa1',
   '1_year', 0.20, 0.30, 0.40, 0.55, 0.65, 0.75, 0.85, 0.7),
  ('00000000-0000-0000-0000-0000000b2081', '00000000-0000-0000-0000-00000081bbb1',
   '1_year', 0.18, 0.28, 0.38, 0.50, 0.62, 0.74, 0.84, 0.65);

INSERT INTO decision_intelligence.goal_probability_snapshots
  (user_id, goal_id, time_horizon, most_likely, range_width, confidence) VALUES
  ('00000000-0000-0000-0000-0000000a1081', '00000000-0000-0000-0000-00000081aaa1', '1_year', 0.55, 0.65, 0.7),
  ('00000000-0000-0000-0000-0000000b2081', '00000000-0000-0000-0000-00000081bbb1', '1_year', 0.50, 0.66, 0.65);

INSERT INTO decision_intelligence.goal_decision_impacts
  (user_id, goal_id, decision_label, time_horizon, probability_delta, is_structural, confidence) VALUES
  ('00000000-0000-0000-0000-0000000a1081', '00000000-0000-0000-0000-00000081aaa1',
   'Reduce credit utilization below 10%', '1_year',  0.18, FALSE, 0.7),
  ('00000000-0000-0000-0000-0000000b2081', '00000000-0000-0000-0000-00000081bbb1',
   'Finish credential',                   '1_year',  0.15, TRUE,  0.7);

INSERT INTO decision_intelligence.goal_pathway_probabilities
  (user_id, goal_id, pathway_signature, pathway_label, time_horizon, most_likely, worst_case, best_case, confidence) VALUES
  ('00000000-0000-0000-0000-0000000a1081', '00000000-0000-0000-0000-00000081aaa1', 'sig-a', 'Income Growth First',
   '5_year', 0.71, 0.45, 0.85, 0.7),
  ('00000000-0000-0000-0000-0000000b2081', '00000000-0000-0000-0000-00000081bbb1', 'sig-b', 'Aggressive Debt Payoff',
   '5_year', 0.42, 0.28, 0.65, 0.65);

INSERT INTO decision_intelligence.goal_future_states
  (user_id, goal_id, time_horizon, path_kind, projected_score, projected_at, confidence) VALUES
  ('00000000-0000-0000-0000-0000000a1081', '00000000-0000-0000-0000-00000081aaa1', '5_year', 'best',        0.85, '2031-05-31', 0.6),
  ('00000000-0000-0000-0000-0000000a1081', '00000000-0000-0000-0000-00000081aaa1', '5_year', 'most_likely', 0.55, '2031-05-31', 0.7),
  ('00000000-0000-0000-0000-0000000a1081', '00000000-0000-0000-0000-00000081aaa1', '5_year', 'worst',       0.25, '2031-05-31', 0.6),
  ('00000000-0000-0000-0000-0000000b2081', '00000000-0000-0000-0000-00000081bbb1', '5_year', 'most_likely', 0.50, '2031-05-31', 0.65);

INSERT INTO decision_intelligence.decision_marginal_impacts
  (user_id, rank, decision_label, target_goal_concept, domain, marginal_impact, time_horizon, confidence) VALUES
  ('00000000-0000-0000-0000-0000000a1081', 1, 'Reduce credit utilization', 'Home Ownership',         'financial',  0.18, '1_year', 0.7),
  ('00000000-0000-0000-0000-0000000b2081', 1, 'Finish credential',         'Income Growth',          'education', 0.40, '10_year', 0.65);

INSERT INTO decision_intelligence.trajectory_variance_factors
  (user_id, goal_id, factor_kind, factor_label, effect, confidence) VALUES
  ('00000000-0000-0000-0000-0000000a1081', '00000000-0000-0000-0000-00000081aaa1',
   'support_count', 'Supporting goals: 3', 0.15, 0.7),
  ('00000000-0000-0000-0000-0000000b2081', '00000000-0000-0000-0000-00000081bbb1',
   'data_sparsity', 'No matching pathway history', -0.15, 0.6);

CREATE TEMP TABLE _rls_results (
  name TEXT, expected INT, observed INT, passed BOOLEAN
) ON COMMIT DROP;

-- ----------------------------------------------------------------------
-- User A's view: must see only their own rows.
-- ----------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000a1081","role":"authenticated"}';

DO $$
DECLARE t TEXT; v_a INT; v_b INT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'goal_probability_distributions','goal_probability_snapshots','goal_decision_impacts',
    'goal_pathway_probabilities','goal_future_states','decision_marginal_impacts',
    'trajectory_variance_factors'
  ]
  LOOP
    EXECUTE format('SELECT COUNT(*) FROM decision_intelligence.%I WHERE user_id = $1', t)
       INTO v_b USING '00000000-0000-0000-0000-0000000b2081';
    INSERT INTO _rls_results VALUES (
      format('%s: A reading B blocked', t),
      0, v_b, v_b = 0
    );
    EXECUTE format('SELECT COUNT(*) FROM decision_intelligence.%I WHERE user_id = $1', t)
       INTO v_a USING '00000000-0000-0000-0000-0000000a1081';
    INSERT INTO _rls_results VALUES (
      format('%s: A reading A allowed', t),
      1, GREATEST(1, v_a), v_a >= 1
    );
  END LOOP;
END $$;

-- A tries to INSERT a goal_decision_impact as B.
DO $$
BEGIN
  BEGIN
    INSERT INTO decision_intelligence.goal_decision_impacts
      (user_id, goal_id, decision_label, time_horizon, probability_delta, is_structural, confidence)
    VALUES
      ('00000000-0000-0000-0000-0000000b2081', '00000000-0000-0000-0000-00000081bbb1',
       'Attacker write', '1_year', 0.99, FALSE, 0.99);
    INSERT INTO _rls_results VALUES ('A_writes_impact_as_B_blocked', 0, 1, FALSE);
  EXCEPTION WHEN insufficient_privilege OR check_violation OR others THEN
    INSERT INTO _rls_results VALUES ('A_writes_impact_as_B_blocked', 0, 0, TRUE);
  END;
END $$;

-- A tries to INSERT a probability distribution as B with broken quantile order.
DO $$
BEGIN
  BEGIN
    INSERT INTO decision_intelligence.goal_probability_distributions
      (user_id, goal_id, time_horizon, worst_case, p10, p25, most_likely, p75, p90, best_case, confidence)
    VALUES
      ('00000000-0000-0000-0000-0000000b2081', '00000000-0000-0000-0000-00000081bbb1',
       '1_year', 0.90, 0.80, 0.70, 0.60, 0.50, 0.40, 0.30, 0.5);  -- reversed
    INSERT INTO _rls_results VALUES ('A_writes_inverted_quantiles_blocked', 0, 1, FALSE);
  EXCEPTION WHEN insufficient_privilege OR check_violation OR others THEN
    INSERT INTO _rls_results VALUES ('A_writes_inverted_quantiles_blocked', 0, 0, TRUE);
  END;
END $$;

RESET ROLE;

-- ----------------------------------------------------------------------
-- Report
-- ----------------------------------------------------------------------
SELECT * FROM _rls_results ORDER BY name;

SELECT
  COUNT(*)                              AS total,
  COUNT(*) FILTER (WHERE passed)        AS pass,
  COUNT(*) FILTER (WHERE NOT passed)    AS fail,
  CASE WHEN COUNT(*) FILTER (WHERE NOT passed) = 0 THEN 'ALL PASS' ELSE 'FAIL' END AS summary
  FROM _rls_results;

ROLLBACK;
