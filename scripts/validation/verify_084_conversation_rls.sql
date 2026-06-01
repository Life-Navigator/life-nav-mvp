-- ==========================================================================
-- 084 RLS verification — discovery_sessions, assumption_challenges,
-- conversation_traces isolate User A from User B's rows.
--
-- Usage:
--   psql "$DATABASE_URL" -f scripts/validation/verify_084_conversation_rls.sql
-- ==========================================================================
BEGIN;

DO $$
BEGIN
  INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at)
  VALUES
    ('00000000-0000-0000-0000-0000000a1084', 'rls-a-084@lifenav.test',
     crypt('x', gen_salt('bf')), NOW(), NOW()),
    ('00000000-0000-0000-0000-0000000b2084', 'rls-b-084@lifenav.test',
     crypt('x', gen_salt('bf')), NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;
END $$;

INSERT INTO public.profiles (id, email) VALUES
  ('00000000-0000-0000-0000-0000000a1084', 'rls-a-084@lifenav.test'),
  ('00000000-0000-0000-0000-0000000b2084', 'rls-b-084@lifenav.test')
ON CONFLICT (id) DO NOTHING;

-- Seed one row per user per table.
INSERT INTO decision_intelligence.discovery_sessions
  (user_id, domain, status, current_depth, max_depth) VALUES
  ('00000000-0000-0000-0000-0000000a1084', 'financial', 'active', 0, 3),
  ('00000000-0000-0000-0000-0000000b2084', 'career',    'active', 0, 3);

INSERT INTO decision_intelligence.assumption_challenges
  (user_id, assumption_text, challenge_prompt, challenge_kind, response_state) VALUES
  ('00000000-0000-0000-0000-0000000a1084', 'no pathway history', 'What evidence would change this?', 'counter_evidence', 'pending'),
  ('00000000-0000-0000-0000-0000000b2084', 'long horizon', 'What if a structural event happened?', 'what_if', 'pending');

INSERT INTO decision_intelligence.conversation_traces
  (user_id, turn_index, classified_intent, turn_kind, used_llm, llm_calls) VALUES
  ('00000000-0000-0000-0000-0000000a1084', 0, 'discover_root_goal', 'ask', FALSE, 0),
  ('00000000-0000-0000-0000-0000000b2084', 0, 'discover_root_goal', 'ask', FALSE, 0);

CREATE TEMP TABLE _rls_results (
  name TEXT, expected INT, observed INT, passed BOOLEAN
) ON COMMIT DROP;

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000a1084","role":"authenticated"}';

DO $$
DECLARE t TEXT; v_a INT; v_b INT;
BEGIN
  FOREACH t IN ARRAY ARRAY['discovery_sessions','assumption_challenges','conversation_traces']
  LOOP
    EXECUTE format('SELECT COUNT(*) FROM decision_intelligence.%I WHERE user_id = $1', t)
       INTO v_b USING '00000000-0000-0000-0000-0000000b2084';
    INSERT INTO _rls_results VALUES (
      format('%s: A reading B blocked', t),
      0, v_b, v_b = 0
    );
    EXECUTE format('SELECT COUNT(*) FROM decision_intelligence.%I WHERE user_id = $1', t)
       INTO v_a USING '00000000-0000-0000-0000-0000000a1084';
    INSERT INTO _rls_results VALUES (
      format('%s: A reading A allowed', t),
      1, v_a, v_a >= 1
    );
  END LOOP;
END $$;

-- A tries to write a session as B.
DO $$
BEGIN
  BEGIN
    INSERT INTO decision_intelligence.discovery_sessions
      (user_id, domain, status, current_depth, max_depth)
    VALUES ('00000000-0000-0000-0000-0000000b2084', 'estate', 'active', 0, 3);
    INSERT INTO _rls_results VALUES ('A_writes_session_as_B_blocked', 0, 1, FALSE);
  EXCEPTION WHEN insufficient_privilege OR check_violation OR others THEN
    INSERT INTO _rls_results VALUES ('A_writes_session_as_B_blocked', 0, 0, TRUE);
  END;
END $$;

-- A tries to write a challenge as B.
DO $$
BEGIN
  BEGIN
    INSERT INTO decision_intelligence.assumption_challenges
      (user_id, assumption_text, challenge_prompt, challenge_kind, response_state)
    VALUES ('00000000-0000-0000-0000-0000000b2084', 'attacker', 'attacker prompt', 'what_if', 'pending');
    INSERT INTO _rls_results VALUES ('A_writes_challenge_as_B_blocked', 0, 1, FALSE);
  EXCEPTION WHEN insufficient_privilege OR check_violation OR others THEN
    INSERT INTO _rls_results VALUES ('A_writes_challenge_as_B_blocked', 0, 0, TRUE);
  END;
END $$;

RESET ROLE;

SELECT * FROM _rls_results ORDER BY name;

SELECT
  COUNT(*)                              AS total,
  COUNT(*) FILTER (WHERE passed)        AS pass,
  COUNT(*) FILTER (WHERE NOT passed)    AS fail,
  CASE WHEN COUNT(*) FILTER (WHERE NOT passed) = 0 THEN 'ALL PASS' ELSE 'FAIL' END AS summary
  FROM _rls_results;

ROLLBACK;
