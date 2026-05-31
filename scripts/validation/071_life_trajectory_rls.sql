-- ==========================================================================
-- Validation for migration 071 — Life Trajectory Simulation RLS + cascade.
-- ==========================================================================

BEGIN;

DO $validate$
DECLARE
  user_a UUID := gen_random_uuid();
  user_b UUID := gen_random_uuid();
  scenario_a UUID;
  version_a UUID;
  version_a2 UUID;
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

  -- Seed a full scenario for user A under service-role context.
  INSERT INTO public.life_scenarios (user_id, title, domain, status, source)
  VALUES (user_a, 'Test scenario', 'multi', 'draft', 'user')
  RETURNING id INTO scenario_a;

  INSERT INTO public.life_scenario_versions
    (user_id, scenario_id, version_index, label, horizon_years, status)
  VALUES (user_a, scenario_a, 0, 'current_behavior', 5, 'completed')
  RETURNING id INTO version_a;
  INSERT INTO public.life_scenario_versions
    (user_id, scenario_id, version_index, label, horizon_years, status)
  VALUES (user_a, scenario_a, 1, 'balanced', 5, 'completed')
  RETURNING id INTO version_a2;

  INSERT INTO public.life_scenario_assumptions (user_id, scenario_version_id, assumption_key, assumption_value)
  VALUES (user_a, version_a, 'expected_real_return_pct', '0.06'::jsonb);

  INSERT INTO public.life_scenario_decisions
    (user_id, scenario_version_id, decision_type, description, at_month, amount)
  VALUES (user_a, version_a, 'invest_taxable', 'baseline auto contribution', 1, 500);

  INSERT INTO public.life_scenario_outputs
    (user_id, scenario_version_id, final_net_worth, final_debt, final_annual_income,
     retirement_ready, emergency_fund_months_final, health_cost_exposure_final,
     recommended, rationale, risks, upside_factors, confidence_score)
  VALUES (user_a, version_a, 150000, 5000, 130000, FALSE, 4.2, 6000,
          FALSE, 'baseline projection', '[]'::jsonb, '[]'::jsonb, 0.5);

  -- A few sample metric rows.
  INSERT INTO public.life_scenario_metrics (user_id, scenario_version_id, at_month, metric_key, metric_value)
  VALUES
    (user_a, version_a, 0,  'net_worth', 35000),
    (user_a, version_a, 12, 'net_worth', 55000),
    (user_a, version_a, 36, 'net_worth', 100000),
    (user_a, version_a, 60, 'net_worth', 150000);

  INSERT INTO public.life_scenario_events
    (user_id, scenario_version_id, at_month, event_type, description, impact)
  VALUES (user_a, version_a, 6, 'income_uplift', 'cert completion', '{"annual_income_added":5000}'::jsonb);

  INSERT INTO public.life_scenario_comparisons
    (user_id, scenario_id, version_a_id, version_b_id, comparison_summary, favored_version_id, diffs)
  VALUES (user_a, scenario_a, version_a, version_a2,
          'B vs A: net worth +$50k delta', version_a2, '{}'::jsonb);

  INSERT INTO public.life_trajectory_snapshots
    (user_id, net_worth, total_debt, emergency_months)
  VALUES (user_a, 150000, 5000, 4.2);

  RAISE NOTICE 'ASSERT OK: seeded a full scenario for user A';

  -- 1. user A authenticated read.
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', user_a::text, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;

  IF (SELECT count(*) FROM public.life_scenarios)                = 0 THEN RAISE EXCEPTION 'A cannot see own scenarios'; END IF;
  IF (SELECT count(*) FROM public.life_scenario_versions)         = 0 THEN RAISE EXCEPTION 'A cannot see own versions'; END IF;
  IF (SELECT count(*) FROM public.life_scenario_decisions)        = 0 THEN RAISE EXCEPTION 'A cannot see own decisions'; END IF;
  IF (SELECT count(*) FROM public.life_scenario_assumptions)      = 0 THEN RAISE EXCEPTION 'A cannot see own assumptions'; END IF;
  IF (SELECT count(*) FROM public.life_scenario_outputs)          = 0 THEN RAISE EXCEPTION 'A cannot see own outputs'; END IF;
  IF (SELECT count(*) FROM public.life_scenario_metrics)          = 0 THEN RAISE EXCEPTION 'A cannot see own metrics'; END IF;
  IF (SELECT count(*) FROM public.life_scenario_events)           = 0 THEN RAISE EXCEPTION 'A cannot see own events'; END IF;
  IF (SELECT count(*) FROM public.life_scenario_comparisons)      = 0 THEN RAISE EXCEPTION 'A cannot see own comparisons'; END IF;
  IF (SELECT count(*) FROM public.life_trajectory_snapshots)      = 0 THEN RAISE EXCEPTION 'A cannot see own snapshots'; END IF;
  RAISE NOTICE 'ASSERT OK: user A reads every trajectory table';

  -- 2. cross-user INSERT blocked.
  caught := FALSE;
  BEGIN
    INSERT INTO public.life_scenarios (user_id, title, domain, status)
    VALUES (user_b, 'sneak', 'multi', 'draft');
  EXCEPTION WHEN insufficient_privilege OR check_violation OR others THEN
    caught := TRUE;
  END;
  IF NOT caught THEN RAISE EXCEPTION 'RLS leak: user A inserted scenario as user B'; END IF;
  RAISE NOTICE 'ASSERT OK: cross-user INSERT blocked';

  -- 3. user B sees zero rows.
  RESET ROLE;
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', user_b::text, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;

  IF (SELECT count(*) FROM public.life_scenarios)                > 0
  OR (SELECT count(*) FROM public.life_scenario_versions)         > 0
  OR (SELECT count(*) FROM public.life_scenario_outputs)          > 0
  OR (SELECT count(*) FROM public.life_scenario_metrics)          > 0
  OR (SELECT count(*) FROM public.life_scenario_comparisons)      > 0
  OR (SELECT count(*) FROM public.life_trajectory_snapshots)      > 0
  THEN RAISE EXCEPTION 'RLS leak: user B sees user A''s scenario rows'; END IF;
  RAISE NOTICE 'ASSERT OK: user B sees zero of user A''s rows';

  -- 4. cascade: deleting the parent scenario removes versions + everything else.
  RESET ROLE;
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', user_a::text, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  DELETE FROM public.life_scenarios WHERE id = scenario_a;
  child_count :=
      (SELECT count(*) FROM public.life_scenario_versions      WHERE scenario_id = scenario_a)
    + (SELECT count(*) FROM public.life_scenario_outputs       WHERE scenario_version_id IN (version_a, version_a2))
    + (SELECT count(*) FROM public.life_scenario_metrics       WHERE scenario_version_id IN (version_a, version_a2))
    + (SELECT count(*) FROM public.life_scenario_decisions     WHERE scenario_version_id IN (version_a, version_a2))
    + (SELECT count(*) FROM public.life_scenario_assumptions   WHERE scenario_version_id IN (version_a, version_a2))
    + (SELECT count(*) FROM public.life_scenario_events        WHERE scenario_version_id IN (version_a, version_a2))
    + (SELECT count(*) FROM public.life_scenario_comparisons   WHERE scenario_id = scenario_a);
  IF child_count <> 0 THEN
    RAISE EXCEPTION 'cascade did not remove all scenario children (% remaining)', child_count;
  END IF;
  RAISE NOTICE 'ASSERT OK: deleting the scenario cascades to every child table';

  RESET ROLE;
  RAISE NOTICE '=========================================';
  RAISE NOTICE 'ALL ASSERTIONS PASSED for migration 071';
  RAISE NOTICE '=========================================';
END
$validate$;

ROLLBACK;
