-- ==========================================================================
-- 082 RLS verification — every new XAI/trust table isolates User A from
-- User B's rows and blocks A-as-B INSERTs.
--
-- Usage:
--   psql "$DATABASE_URL" -f scripts/validation/verify_082_xai_rls.sql
--
-- ROLLBACKs at the end.
-- ==========================================================================
BEGIN;

DO $$
BEGIN
  INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at)
  VALUES
    ('00000000-0000-0000-0000-0000000a1082', 'rls-a-082@lifenav.test',
     crypt('x', gen_salt('bf')), NOW(), NOW()),
    ('00000000-0000-0000-0000-0000000b2082', 'rls-b-082@lifenav.test',
     crypt('x', gen_salt('bf')), NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;
END $$;

INSERT INTO public.profiles (id, email) VALUES
  ('00000000-0000-0000-0000-0000000a1082', 'rls-a-082@lifenav.test'),
  ('00000000-0000-0000-0000-0000000b2082', 'rls-b-082@lifenav.test')
ON CONFLICT (id) DO NOTHING;

-- Seed one row per user per table.
INSERT INTO decision_intelligence.recommendation_audit_trail
  (user_id, target_kind, input_snapshot, output_summary) VALUES
  ('00000000-0000-0000-0000-0000000a1082', 'recommendation_output',
   '{"current_progress":0.4}'::jsonb,
   '{"root_goal":{"inferred_true_goal":"FI-A"}}'::jsonb),
  ('00000000-0000-0000-0000-0000000b2082', 'recommendation_output',
   '{"current_progress":0.3}'::jsonb,
   '{"root_goal":{"inferred_true_goal":"FI-B"}}'::jsonb);

INSERT INTO decision_intelligence.why_chains
  (user_id, target_kind, nodes, edges, max_depth) VALUES
  ('00000000-0000-0000-0000-0000000a1082', 'recommendation_output', '[]'::jsonb, '[]'::jsonb, 5),
  ('00000000-0000-0000-0000-0000000b2082', 'recommendation_output', '[]'::jsonb, '[]'::jsonb, 5);

INSERT INTO decision_intelligence.evidence_links
  (user_id, target_kind, source_kind, source_label, confidence) VALUES
  ('00000000-0000-0000-0000-0000000a1082', 'recommendation_output', 'central_ontology', 'CFA Charter', 0.9),
  ('00000000-0000-0000-0000-0000000b2082', 'recommendation_output', 'central_ontology', 'PMP', 0.85);

INSERT INTO decision_intelligence.counterfactual_scenarios
  (user_id, target_kind, scenario_label, perturbation, expected_outcome, sensitivity) VALUES
  ('00000000-0000-0000-0000-0000000a1082', 'goal_decision_impact', 'base_magnitude doubled',
   '{"input_field":"base_magnitude","from":0.18,"to":0.36}'::jsonb, 'reranked', 0.6),
  ('00000000-0000-0000-0000-0000000b2082', 'goal_decision_impact', 'is_structural flipped',
   '{"input_field":"is_structural","from":false,"to":true}'::jsonb, 'flipped', 0.85);

INSERT INTO decision_intelligence.recommendation_assumptions
  (user_id, target_kind, assumption_text, severity, sensitivity, source_engine) VALUES
  ('00000000-0000-0000-0000-0000000a1082', 'recommendation_output',
   'Long-horizon estimates assume no structural life event.', 'critical', 0.85, 'reasoning'),
  ('00000000-0000-0000-0000-0000000b2082', 'recommendation_output',
   'Hard constraints currently bound the action space.', 'critical', 0.9, 'reasoning');

CREATE TEMP TABLE _rls_results (
  name TEXT, expected INT, observed INT, passed BOOLEAN
) ON COMMIT DROP;

-- ----------------------------------------------------------------------
-- User A perspective
-- ----------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000a1082","role":"authenticated"}';

DO $$
DECLARE t TEXT; v_a INT; v_b INT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'recommendation_audit_trail','why_chains','evidence_links',
    'counterfactual_scenarios','recommendation_assumptions'
  ]
  LOOP
    EXECUTE format('SELECT COUNT(*) FROM decision_intelligence.%I WHERE user_id = $1', t)
       INTO v_b USING '00000000-0000-0000-0000-0000000b2082';
    INSERT INTO _rls_results VALUES (
      format('%s: A reading B blocked', t),
      0, v_b, v_b = 0
    );
    EXECUTE format('SELECT COUNT(*) FROM decision_intelligence.%I WHERE user_id = $1', t)
       INTO v_a USING '00000000-0000-0000-0000-0000000a1082';
    INSERT INTO _rls_results VALUES (
      format('%s: A reading A allowed', t),
      1, v_a, v_a >= 1
    );
  END LOOP;
END $$;

-- A tries to INSERT a why_chain as B.
DO $$
BEGIN
  BEGIN
    INSERT INTO decision_intelligence.why_chains
      (user_id, target_kind, nodes, edges)
    VALUES ('00000000-0000-0000-0000-0000000b2082', 'recommendation_output', '[]'::jsonb, '[]'::jsonb);
    INSERT INTO _rls_results VALUES ('A_writes_why_chain_as_B_blocked', 0, 1, FALSE);
  EXCEPTION WHEN insufficient_privilege OR check_violation OR others THEN
    INSERT INTO _rls_results VALUES ('A_writes_why_chain_as_B_blocked', 0, 0, TRUE);
  END;
END $$;

-- A tries to INSERT a recommendation_assumption as B.
DO $$
BEGIN
  BEGIN
    INSERT INTO decision_intelligence.recommendation_assumptions
      (user_id, target_kind, assumption_text, severity, sensitivity, source_engine)
    VALUES ('00000000-0000-0000-0000-0000000b2082', 'recommendation_output',
            'Manipulative assumption', 'informational', 0.0, 'reasoning');
    INSERT INTO _rls_results VALUES ('A_writes_assumption_as_B_blocked', 0, 1, FALSE);
  EXCEPTION WHEN insufficient_privilege OR check_violation OR others THEN
    INSERT INTO _rls_results VALUES ('A_writes_assumption_as_B_blocked', 0, 0, TRUE);
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
