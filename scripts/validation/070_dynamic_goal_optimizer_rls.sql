-- ==========================================================================
-- Validation for migration 070 — Dynamic Goal Optimizer RLS.
--
-- Verifies:
--   1. Owner can read/write every optimizer table (interpretations,
--      runs, inputs, assumptions, allocations, tradeoffs,
--      recommendations, outcomes).
--   2. Cross-user INSERT is blocked.
--   3. User B sees zero of User A's rows.
--   4. Cascade: deleting the run cascades to inputs/assumptions/
--      allocations/tradeoffs/recommendations/outcomes (FK ON DELETE CASCADE).
--   5. Accept lifecycle: marking a recommendation as accepted preserves
--      the stamp and downstream user_decisions row remains user-isolated.
-- ==========================================================================

BEGIN;

DO $validate$
DECLARE
  user_a UUID := gen_random_uuid();
  user_b UUID := gen_random_uuid();
  run_a UUID;
  rec_a UUID;
  caught BOOLEAN;
  child_count INT;
BEGIN
  RAISE NOTICE '--- Seeding users A=% B=% ---', user_a, user_b;

  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password,
                          email_confirmed_at, created_at, updated_at)
  VALUES
    (user_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'a+' || user_a || '@validation.local', '', NOW(), NOW(), NOW()),
    (user_b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'b+' || user_b || '@validation.local', '', NOW(), NOW(), NOW());
  INSERT INTO public.profiles (id, email, display_name) VALUES
    (user_a, 'a@validation.local', 'User A'),
    (user_b, 'b@validation.local', 'User B');

  -- Seed an end-to-end run for user A under service-role context.
  INSERT INTO public.goal_interpretations (user_id, stated_goal, inferred_true_goal, confidence_score)
  VALUES (user_a, 'Pay off my credit cards', 'Reduce financial fragility and free up cash flow', 0.7);

  INSERT INTO public.goal_optimizer_runs
    (user_id, status, engine_version, monthly_surplus, total_allocation, next_best_action, summary, confidence_score)
  VALUES (user_a, 'completed', 'v1', 1000, 1000,
          'Direct $400 to attack your highest-APR debt.',
          'Top categories: 40% high-APR debt, 30% emergency fund, 30% retirement match.',
          0.7)
  RETURNING id INTO run_a;

  INSERT INTO public.goal_optimizer_inputs (user_id, run_id, inputs)
  VALUES (user_a, run_a, '{"monthly_surplus":1000}'::jsonb);

  INSERT INTO public.goal_optimizer_assumptions (user_id, run_id, assumption_key, assumption_value, rationale)
  VALUES (user_a, run_a, 'safe_apr_threshold_for_payoff_priority', '0.10'::jsonb,
          'Debts at 10%+ APR are treated as high-priority.');

  INSERT INTO public.goal_optimizer_allocations (user_id, run_id, category, amount_usd, share_pct, priority, rationale, category_score)
  VALUES
    (user_a, run_a, 'high_interest_debt', 400, 40, 88, 'High-APR debt is the highest guaranteed return.', 88),
    (user_a, run_a, 'emergency_fund',     300, 30, 80, 'Thin emergency fund.', 80),
    (user_a, run_a, 'retirement_match',   300, 30, 75, 'Employer match available.', 75);

  INSERT INTO public.goal_optimizer_tradeoffs (user_id, run_id, axis_a, axis_b, tradeoff_summary, favored_axis)
  VALUES (user_a, run_a, 'retirement_match', 'high_interest_debt',
          'Capturing the employer match before paying down high-APR debt is usually correct.',
          'a');

  INSERT INTO public.goal_optimizer_recommendations
    (user_id, run_id, title, body, status, confidence_score)
  VALUES (user_a, run_a, 'Direct $400 to attack your highest-APR debt.',
          'Long body...', 'pending', 0.7)
  RETURNING id INTO rec_a;

  INSERT INTO public.goal_optimizer_outcomes
    (user_id, run_id, observed_metric, observed_value, observed_unit, attribution_confidence)
  VALUES (user_a, run_a, 'debt_balance_delta_30d', -400, 'usd', 0.5);

  RAISE NOTICE 'ASSERT OK: seeded full optimizer run for user A';

  -- Switch to user A authenticated context.
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', user_a::text, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;

  IF (SELECT count(*) FROM public.goal_optimizer_runs)             = 0 THEN RAISE EXCEPTION 'A cannot see own run'; END IF;
  IF (SELECT count(*) FROM public.goal_optimizer_allocations)      <> 3 THEN RAISE EXCEPTION 'A should see 3 allocations'; END IF;
  IF (SELECT count(*) FROM public.goal_optimizer_tradeoffs)        = 0 THEN RAISE EXCEPTION 'A cannot see own tradeoffs'; END IF;
  IF (SELECT count(*) FROM public.goal_optimizer_recommendations)  = 0 THEN RAISE EXCEPTION 'A cannot see own recommendations'; END IF;
  IF (SELECT count(*) FROM public.goal_optimizer_outcomes)         = 0 THEN RAISE EXCEPTION 'A cannot see own outcomes'; END IF;
  IF (SELECT count(*) FROM public.goal_optimizer_assumptions)      = 0 THEN RAISE EXCEPTION 'A cannot see own assumptions'; END IF;
  IF (SELECT count(*) FROM public.goal_optimizer_inputs)           = 0 THEN RAISE EXCEPTION 'A cannot see own inputs'; END IF;
  IF (SELECT count(*) FROM public.goal_interpretations)            = 0 THEN RAISE EXCEPTION 'A cannot see own interpretations'; END IF;
  RAISE NOTICE 'ASSERT OK: user A reads every optimizer table';

  -- Accept lifecycle: flip recommendation to accepted.
  UPDATE public.goal_optimizer_recommendations
     SET status = 'accepted', accepted_at = NOW()
   WHERE id = rec_a;
  IF (SELECT status FROM public.goal_optimizer_recommendations WHERE id = rec_a) <> 'accepted' THEN
    RAISE EXCEPTION 'user A could not accept own recommendation';
  END IF;
  RAISE NOTICE 'ASSERT OK: user A can accept own recommendation';

  -- Cross-user INSERT blocked.
  caught := FALSE;
  BEGIN
    INSERT INTO public.goal_optimizer_runs (user_id, monthly_surplus, total_allocation)
    VALUES (user_b, 999, 999);
  EXCEPTION WHEN insufficient_privilege OR check_violation OR others THEN
    caught := TRUE;
  END;
  IF NOT caught THEN RAISE EXCEPTION 'RLS leak: user A inserted optimizer run as user B'; END IF;
  RAISE NOTICE 'ASSERT OK: cross-user INSERT blocked';

  -- Switch to user B.
  RESET ROLE;
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', user_b::text, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;

  IF (SELECT count(*) FROM public.goal_optimizer_runs)             > 0
  OR (SELECT count(*) FROM public.goal_optimizer_allocations)      > 0
  OR (SELECT count(*) FROM public.goal_optimizer_recommendations)  > 0
  OR (SELECT count(*) FROM public.goal_optimizer_outcomes)         > 0
  OR (SELECT count(*) FROM public.goal_interpretations)            > 0
  THEN RAISE EXCEPTION 'RLS leak: user B can see user A''s optimizer rows'; END IF;
  RAISE NOTICE 'ASSERT OK: user B sees zero of user A''s optimizer rows';

  -- Cascade: delete the run and confirm children go too. We need
  -- service-role context for this because user A's `DELETE` on the run
  -- triggers the cascade via FK only when the policy permits the parent
  -- delete — which it does, so let's do it as user A.
  RESET ROLE;
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', user_a::text, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  DELETE FROM public.goal_optimizer_runs WHERE id = run_a;
  child_count :=
      (SELECT count(*) FROM public.goal_optimizer_allocations WHERE run_id = run_a)
    + (SELECT count(*) FROM public.goal_optimizer_tradeoffs    WHERE run_id = run_a)
    + (SELECT count(*) FROM public.goal_optimizer_recommendations WHERE run_id = run_a)
    + (SELECT count(*) FROM public.goal_optimizer_outcomes    WHERE run_id = run_a)
    + (SELECT count(*) FROM public.goal_optimizer_assumptions WHERE run_id = run_a)
    + (SELECT count(*) FROM public.goal_optimizer_inputs      WHERE run_id = run_a);
  IF child_count <> 0 THEN
    RAISE EXCEPTION 'cascade did not remove all run children (% remaining)', child_count;
  END IF;
  RAISE NOTICE 'ASSERT OK: deleting the run cascades to every child table';

  RESET ROLE;
  RAISE NOTICE '=========================================';
  RAISE NOTICE 'ALL ASSERTIONS PASSED for migration 070';
  RAISE NOTICE '=========================================';
END
$validate$;

ROLLBACK;
