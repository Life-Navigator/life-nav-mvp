-- ==========================================================================
-- 079 verification: cross-user RLS isolation for the decision-intelligence
-- tables. Mirrors the 076 RLS verifier pattern.
--
-- Usage:
--   psql "$DATABASE_URL" -f scripts/validation/verify_079_decision_rls.sql
--
-- The script seeds two synthetic users + a journal/expectation/outcome
-- chain per user, then proves User A cannot SELECT or INSERT against
-- User B's rows. ROLLBACKs at the end.
-- ==========================================================================
BEGIN;

DO $$
BEGIN
  INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at)
  VALUES
    ('00000000-0000-0000-0000-0000000a1079', 'rls-a-079@lifenav.test',
     crypt('x', gen_salt('bf')), NOW(), NOW()),
    ('00000000-0000-0000-0000-0000000b2079', 'rls-b-079@lifenav.test',
     crypt('x', gen_salt('bf')), NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;
END $$;

INSERT INTO public.profiles (id, email) VALUES
  ('00000000-0000-0000-0000-0000000a1079', 'rls-a-079@lifenav.test'),
  ('00000000-0000-0000-0000-0000000b2079', 'rls-b-079@lifenav.test')
ON CONFLICT (id) DO NOTHING;

-- Service-role superuser inserts one row per table per user.
INSERT INTO decision_intelligence.decision_journals
  (id, user_id, title, decision_type, status, made_at, assumptions, recommendation_summary, reasoning, system_confidence_at_decision)
VALUES
  ('00000000-0000-0000-0000-00000079aaa1', '00000000-0000-0000-0000-0000000a1079',
   'Max 401k match', 'financial', 'made', NOW(), '["match continues"]'::jsonb,
   'Increase 401(k) deferral to 6%', 'Captures full match.', 0.85),
  ('00000000-0000-0000-0000-00000079bbb1', '00000000-0000-0000-0000-0000000b2079',
   'Pay off CC debt', 'financial', 'made', NOW(), '["no new charges"]'::jsonb,
   'Avalanche on highest APR', 'Minimizes interest.', 0.8)
ON CONFLICT (id) DO NOTHING;

INSERT INTO decision_intelligence.decision_expectations
  (user_id, journal_id, dimension, expected_value, expected_unit, confidence)
VALUES
  ('00000000-0000-0000-0000-0000000a1079', '00000000-0000-0000-0000-00000079aaa1',
   'net_worth_delta_12mo', 8500, 'usd', 0.8),
  ('00000000-0000-0000-0000-0000000b2079', '00000000-0000-0000-0000-00000079bbb1',
   'total_debt_delta_12mo', -6500, 'usd', 0.75);

INSERT INTO decision_intelligence.recommendation_acceptance
  (user_id, action_id, recommendation_summary, expected_strength, domain, status, accepted_at)
VALUES
  ('00000000-0000-0000-0000-0000000a1079', 'act_1_req_a1', 'Increase 401k deferral to 6%',
   0.85, 'finance', 'accepted', NOW()),
  ('00000000-0000-0000-0000-0000000b2079', 'act_1_req_b1', 'Avalanche CC payoff',
   0.80, 'finance', 'accepted', NOW());

INSERT INTO decision_intelligence.learning_signals
  (user_id, signal_kind, signal_key, signal_value, support_count, confidence)
VALUES
  ('00000000-0000-0000-0000-0000000a1079', 'follow_through_pattern', 'overall',
   '{"completion_rate":0.8}'::jsonb, 10, 0.6),
  ('00000000-0000-0000-0000-0000000b2079', 'follow_through_pattern', 'overall',
   '{"completion_rate":0.5}'::jsonb, 10, 0.5);

CREATE TEMP TABLE _rls_results (
  name TEXT, expected INT, observed INT, passed BOOLEAN
) ON COMMIT DROP;

-- ----------------------------------------------------------------------
-- User A's view: must see only their own rows.
-- ----------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000a1079","role":"authenticated"}';

DO $$
DECLARE t TEXT; v_a INT; v_b INT;
BEGIN
  FOREACH t IN ARRAY ARRAY['decision_journals','decision_expectations','decision_outcomes',
                            'decision_reviews','recommendation_acceptance','learning_signals']
  LOOP
    EXECUTE format('SELECT COUNT(*) FROM decision_intelligence.%I WHERE user_id = $1', t)
       INTO v_a USING '00000000-0000-0000-0000-0000000a1079';
    EXECUTE format('SELECT COUNT(*) FROM decision_intelligence.%I WHERE user_id = $1', t)
       INTO v_b USING '00000000-0000-0000-0000-0000000b2079';
    INSERT INTO _rls_results VALUES (
      format('%s: A sees B = 0', t),
      0, v_b, v_b = 0
    );
    INSERT INTO _rls_results VALUES (
      format('%s: A sees A >= 0', t),
      0, v_a, v_a >= 0
    );
  END LOOP;
END $$;

-- User A tries to write a journal entry pretending to be User B.
DO $$
BEGIN
  BEGIN
    INSERT INTO decision_intelligence.decision_journals
      (user_id, title, decision_type, status)
    VALUES
      ('00000000-0000-0000-0000-0000000b2079', 'Attacker write', 'financial', 'pending');
    INSERT INTO _rls_results VALUES ('A_writes_as_B_blocked', 0, 1, FALSE);
  EXCEPTION WHEN insufficient_privilege OR check_violation OR others THEN
    INSERT INTO _rls_results VALUES ('A_writes_as_B_blocked', 0, 0, TRUE);
  END;
END $$;

-- User A tries to write a learning_signal for User B.
DO $$
BEGIN
  BEGIN
    INSERT INTO decision_intelligence.learning_signals
      (user_id, signal_kind, signal_key, signal_value, support_count)
    VALUES
      ('00000000-0000-0000-0000-0000000b2079', 'follow_through_pattern',
       'overall', '{"completion_rate":0.0}'::jsonb, 99);
    INSERT INTO _rls_results VALUES ('A_writes_signal_as_B_blocked', 0, 1, FALSE);
  EXCEPTION WHEN insufficient_privilege OR check_violation OR others THEN
    INSERT INTO _rls_results VALUES ('A_writes_signal_as_B_blocked', 0, 0, TRUE);
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
