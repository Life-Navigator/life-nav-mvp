-- ==========================================================================
-- 080 RLS verification — every new table in decision_intelligence
-- isolates User A from User B's rows, blocks A-as-B INSERTs, and
-- (where applicable) lets all authenticated users read the global
-- pathway_effectiveness rows.
--
-- Usage:
--   psql "$DATABASE_URL" -f scripts/validation/verify_080_decision_intelligence_rls.sql
--
-- ROLLBACKs at the end — no fixture data is left behind.
-- ==========================================================================
BEGIN;

DO $$
BEGIN
  INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at)
  VALUES
    ('00000000-0000-0000-0000-0000000a1080', 'rls-a-080@lifenav.test',
     crypt('x', gen_salt('bf')), NOW(), NOW()),
    ('00000000-0000-0000-0000-0000000b2080', 'rls-b-080@lifenav.test',
     crypt('x', gen_salt('bf')), NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;
END $$;

INSERT INTO public.profiles (id, email) VALUES
  ('00000000-0000-0000-0000-0000000a1080', 'rls-a-080@lifenav.test'),
  ('00000000-0000-0000-0000-0000000b2080', 'rls-b-080@lifenav.test')
ON CONFLICT (id) DO NOTHING;

-- A goal each for the two users so we can hang progress + events off it.
INSERT INTO public.goals (id, user_id, title, domain, category, priority)
VALUES
  ('00000000-0000-0000-0000-00000080aaa1', '00000000-0000-0000-0000-0000000a1080',
   'FI-A', 'financial', 'wealth', 'essential'),
  ('00000000-0000-0000-0000-00000080bbb1', '00000000-0000-0000-0000-0000000b2080',
   'FI-B', 'financial', 'wealth', 'essential')
ON CONFLICT (id) DO NOTHING;

-- Seed one row per user per table (service-role superuser bypasses RLS).
INSERT INTO decision_intelligence.goal_progress_snapshots
  (user_id, goal_id, score, confidence, source) VALUES
  ('00000000-0000-0000-0000-0000000a1080', '00000000-0000-0000-0000-00000080aaa1', 0.35, 0.7, 'engine'),
  ('00000000-0000-0000-0000-0000000b2080', '00000000-0000-0000-0000-00000080bbb1', 0.40, 0.7, 'engine');

INSERT INTO decision_intelligence.goal_progress_events
  (user_id, goal_id, event_type, delta) VALUES
  ('00000000-0000-0000-0000-0000000a1080', '00000000-0000-0000-0000-00000080aaa1', 'outcome_observed', 0.05),
  ('00000000-0000-0000-0000-0000000b2080', '00000000-0000-0000-0000-00000080bbb1', 'outcome_observed', 0.05);

INSERT INTO decision_intelligence.goal_progress_scores
  (user_id, goal_id, period, period_start, score, delta, events_count) VALUES
  ('00000000-0000-0000-0000-0000000a1080', '00000000-0000-0000-0000-00000080aaa1', 'monthly', '2026-05-01', 0.40, 0.05, 1),
  ('00000000-0000-0000-0000-0000000b2080', '00000000-0000-0000-0000-00000080bbb1', 'monthly', '2026-05-01', 0.45, 0.05, 1);

INSERT INTO decision_intelligence.goal_progress_predictions
  (user_id, goal_id, target_date, predicted_score, confidence) VALUES
  ('00000000-0000-0000-0000-0000000a1080', '00000000-0000-0000-0000-00000080aaa1', '2027-05-01', 0.70, 0.6),
  ('00000000-0000-0000-0000-0000000b2080', '00000000-0000-0000-0000-00000080bbb1', '2027-05-01', 0.70, 0.6);

INSERT INTO decision_intelligence.cross_domain_impacts
  (user_id, source_domain, target_domain, label, strength, confidence) VALUES
  ('00000000-0000-0000-0000-0000000a1080', 'health', 'career', 'CONTRIBUTED_TO', 0.6, 0.7),
  ('00000000-0000-0000-0000-0000000b2080', 'career', 'financial', 'INFLUENCED',    0.7, 0.8);

INSERT INTO decision_intelligence.prediction_calibration
  (user_id, predicted_at, predicted_confidence, actual_correct, bucket) VALUES
  ('00000000-0000-0000-0000-0000000a1080', NOW(), 0.80, TRUE,  '0.8-0.9'),
  ('00000000-0000-0000-0000-0000000b2080', NOW(), 0.80, FALSE, '0.8-0.9');

INSERT INTO decision_intelligence.recommendation_accuracy
  (user_id, action_id, predicted_strength, predicted_confidence, observed_outcome_quality, accuracy_score) VALUES
  ('00000000-0000-0000-0000-0000000a1080', 'act_1_req_a', 0.7, 0.7, 0.6, 0.8),
  ('00000000-0000-0000-0000-0000000b2080', 'act_1_req_b', 0.6, 0.6, 0.4, 0.7);

INSERT INTO decision_intelligence.advisor_accuracy
  (user_id, advisor_run_id, total_actions, completed_actions, brier_score, calibration_error, confidence_accuracy_gap) VALUES
  ('00000000-0000-0000-0000-0000000a1080', '00000000-0000-0000-0000-00000080aac1', 5, 3, 0.10, 0.06, 0.05),
  ('00000000-0000-0000-0000-0000000b2080', '00000000-0000-0000-0000-00000080bbc1', 5, 2, 0.12, 0.08, 0.06);

INSERT INTO decision_intelligence.recommendation_quality_metrics
  (user_id, period, period_start, recommendation_type, domain, total, accepted, completed, success_rate, completion_rate) VALUES
  ('00000000-0000-0000-0000-0000000a1080', 'monthly', '2026-05-01', 'all', 'all', 10, 8, 5, 0.625, 0.5),
  ('00000000-0000-0000-0000-0000000b2080', 'monthly', '2026-05-01', 'all', 'all', 10, 8, 4, 0.50,  0.4);

-- Personal + global pathway effectiveness rows.
INSERT INTO decision_intelligence.goal_pathway_effectiveness
  (user_id, root_goal_concept, pathway_signature, pathway_label, pathway_edges, sample_size, success_count, success_rate) VALUES
  ('00000000-0000-0000-0000-0000000a1080', 'Financial Independence', 'sig-personal-a', 'Personal A pathway', '[]'::jsonb, 5, 3, 0.6),
  ('00000000-0000-0000-0000-0000000b2080', 'Financial Independence', 'sig-personal-b', 'Personal B pathway', '[]'::jsonb, 5, 2, 0.4),
  (NULL,                                    'Financial Independence', 'sig-global',     'Cohort pathway',     '[]'::jsonb, 42, 30, 0.71);

CREATE TEMP TABLE _rls_results (
  name TEXT, expected INT, observed INT, passed BOOLEAN
) ON COMMIT DROP;

-- ----------------------------------------------------------------------
-- User A's view: must see only their own user-scoped rows + the global
-- pathway_effectiveness row.
-- ----------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000a1080","role":"authenticated"}';

DO $$
DECLARE t TEXT; v_a INT; v_b INT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'goal_progress_snapshots','goal_progress_events','goal_progress_scores','goal_progress_predictions',
    'cross_domain_impacts','prediction_calibration','recommendation_accuracy','advisor_accuracy',
    'recommendation_quality_metrics'
  ]
  LOOP
    EXECUTE format('SELECT COUNT(*) FROM decision_intelligence.%I WHERE user_id = $1', t)
       INTO v_b USING '00000000-0000-0000-0000-0000000b2080';
    INSERT INTO _rls_results VALUES (
      format('%s: A reading B blocked', t),
      0, v_b, v_b = 0
    );
    EXECUTE format('SELECT COUNT(*) FROM decision_intelligence.%I WHERE user_id = $1', t)
       INTO v_a USING '00000000-0000-0000-0000-0000000a1080';
    INSERT INTO _rls_results VALUES (
      format('%s: A reading A allowed', t),
      1, v_a, v_a = 1
    );
  END LOOP;
END $$;

-- goal_pathway_effectiveness: A sees own + global (≥ 2), never B's personal.
DO $$
DECLARE v_a INT; v_b INT; v_g INT;
BEGIN
  SELECT COUNT(*) INTO v_a FROM decision_intelligence.goal_pathway_effectiveness WHERE user_id = '00000000-0000-0000-0000-0000000a1080';
  SELECT COUNT(*) INTO v_b FROM decision_intelligence.goal_pathway_effectiveness WHERE user_id = '00000000-0000-0000-0000-0000000b2080';
  SELECT COUNT(*) INTO v_g FROM decision_intelligence.goal_pathway_effectiveness WHERE user_id IS NULL;
  INSERT INTO _rls_results VALUES ('goal_pathway_effectiveness: A sees own',         1, v_a, v_a = 1);
  INSERT INTO _rls_results VALUES ('goal_pathway_effectiveness: A cannot see B',     0, v_b, v_b = 0);
  INSERT INTO _rls_results VALUES ('goal_pathway_effectiveness: A sees globals',     1, v_g, v_g = 1);
END $$;

-- A tries to INSERT a goal_progress_snapshot as B.
DO $$
BEGIN
  BEGIN
    INSERT INTO decision_intelligence.goal_progress_snapshots
      (user_id, goal_id, score, source)
    VALUES ('00000000-0000-0000-0000-0000000b2080',
            '00000000-0000-0000-0000-00000080bbb1', 0.99, 'engine');
    INSERT INTO _rls_results VALUES ('A_writes_snapshot_as_B_blocked', 0, 1, FALSE);
  EXCEPTION WHEN insufficient_privilege OR check_violation OR others THEN
    INSERT INTO _rls_results VALUES ('A_writes_snapshot_as_B_blocked', 0, 0, TRUE);
  END;
END $$;

-- A tries to INSERT an outcome_attribution as B.
DO $$
BEGIN
  BEGIN
    INSERT INTO decision_intelligence.outcome_attributions
      (user_id, outcome_id, attribution_share, confidence)
    VALUES
      ('00000000-0000-0000-0000-0000000b2080', gen_random_uuid(), 0.5, 0.5);
    INSERT INTO _rls_results VALUES ('A_writes_attribution_as_B_blocked', 0, 1, FALSE);
  EXCEPTION WHEN insufficient_privilege OR check_violation OR others THEN
    INSERT INTO _rls_results VALUES ('A_writes_attribution_as_B_blocked', 0, 0, TRUE);
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
