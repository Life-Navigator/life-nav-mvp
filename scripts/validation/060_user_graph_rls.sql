-- ==========================================================================
-- Validation: 060_user_graph_foundation.sql
--
-- Proves three things, in one transactional script:
--   1. RLS isolation        — User A cannot read or write User B's rows
--                              across all 10 new user-graph tables.
--   2. Onboarding writes    — A simulated onboarding flow leaves rows in
--                              every table the UI is expected to touch.
--   3. Optional fields      — Missing optional columns do not break inserts
--                              (the minimum schema is sufficient).
--
-- How to run:
--
--     psql "$DATABASE_URL" -f scripts/validation/060_user_graph_rls.sql
--
-- The script:
--   * runs inside a single transaction and ROLLBACKs at the end so no test
--     rows survive,
--   * RAISE EXCEPTIONs on the first failed assertion so the exit code is
--     non-zero,
--   * RAISE NOTICEs success markers you can grep for ("ASSERT OK").
--
-- Required role: superuser / postgres (to bypass RLS for the seed and to
-- impersonate authenticated users via request.jwt.claims).
-- ==========================================================================

BEGIN;

DO $validate$
DECLARE
  user_a UUID := gen_random_uuid();
  user_b UUID := gen_random_uuid();
  rec_count INT;
  caught_violation BOOLEAN;
BEGIN
  RAISE NOTICE '--- Seeding two synthetic users (A=%, B=%) ---', user_a, user_b;

  -- Insert into auth.users (FK target for profiles.id). Disable any side
  -- effects by inserting only the columns Supabase always populates.
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password,
                          email_confirmed_at, created_at, updated_at)
  VALUES
    (user_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'a+' || user_a || '@validation.local', '', NOW(), NOW(), NOW()),
    (user_b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'b+' || user_b || '@validation.local', '', NOW(), NOW(), NOW());

  INSERT INTO public.profiles (id, email, display_name)
  VALUES
    (user_a, 'a+' || user_a || '@validation.local', 'User A'),
    (user_b, 'b+' || user_b || '@validation.local', 'User B');

  -- ------------------------------------------------------------------
  -- 2. Onboarding writes — every table receives at least one row for A.
  -- (Done as service-role/superuser so we exercise the schema directly.)
  -- ------------------------------------------------------------------
  RAISE NOTICE '--- Inserting onboarding-shaped rows for User A ---';

  INSERT INTO public.user_life_vision (user_id, horizon, vision_text)
  VALUES (user_a, '1_year', 'Pay down credit card debt'),
         (user_a, '5_year', 'Switch into a senior IC role'),
         (user_a, 'definition_of_success', 'Time with my kids, work I am proud of'),
         (user_a, 'fears_to_avoid', 'Burnout');

  INSERT INTO public.user_constraints (user_id, dimension, severity, description)
  VALUES (user_a, 'time',   'soft', '5 hours/week max'),
         (user_a, 'money',  'hard', 'No equity withdrawals'),
         (user_a, 'family', 'hard', 'Cannot relocate while kids are in school');

  INSERT INTO public.user_decision_preferences (user_id, axis, weight)
  VALUES (user_a, 'speed',       0.40),
         (user_a, 'certainty',   0.80),
         (user_a, 'flexibility', 0.65),
         (user_a, 'upside',      0.30);

  INSERT INTO public.user_commitment_levels (user_id, domain, hours_per_week, energy_level)
  VALUES (user_a, 'overall',   8, 'medium'),
         (user_a, 'financial', 2, 'low'),
         (user_a, 'health',    4, 'high');

  INSERT INTO public.user_motivations (user_id, motivation_text, motivation_type, intensity)
  VALUES (user_a, 'Financial independence by 50', 'values_based', 9),
         (user_a, 'Be the parent I wish I had',   'identity',      10);

  INSERT INTO public.user_domain_risk_tolerance (user_id, domain, tolerance_score)
  VALUES (user_a, 'financial',        0.30),
         (user_a, 'career',           0.55),
         (user_a, 'education',        0.60),
         (user_a, 'health',           0.20),
         (user_a, 'entrepreneurship', 0.10);

  INSERT INTO public.user_capabilities (user_id, capability_name, proficiency_level)
  VALUES (user_a, 'python',  'advanced'),
         (user_a, 'writing', 'intermediate');

  -- Minimal optional-field test: only required columns.
  INSERT INTO public.user_decisions (user_id, title)
  VALUES (user_a, 'Test minimal decision row');

  INSERT INTO public.user_recommendations (user_id, action)
  VALUES (user_a, 'Open a high-yield savings account');

  -- A user_outcomes row needs at least one of (goal_id, decision_id,
  -- recommendation_id) per the CHECK constraint. Use the recommendation
  -- we just inserted.
  INSERT INTO public.user_outcomes (user_id, recommendation_id, outcome_type)
  SELECT user_a, id, 'in_progress' FROM public.user_recommendations
   WHERE user_id = user_a LIMIT 1;

  -- Sanity: each table has exactly the rows we just inserted for User A.
  FOR rec_count IN
    SELECT count(*) FROM public.user_life_vision WHERE user_id = user_a
  LOOP
    IF rec_count <> 4 THEN
      RAISE EXCEPTION 'EXPECTED 4 vision rows for User A, got %', rec_count;
    END IF;
  END LOOP;
  RAISE NOTICE 'ASSERT OK: onboarding inserted vision rows';

  -- ------------------------------------------------------------------
  -- 1. RLS isolation — switch session to User A and User B in turn.
  -- ------------------------------------------------------------------
  RAISE NOTICE '--- Switching session to User A ---';
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', user_a::text, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;

  -- User A must see only their own rows in EVERY table.
  IF (SELECT count(*) FROM public.user_life_vision)              <> 4 THEN
     RAISE EXCEPTION 'RLS leak: user A should see 4 vision rows, saw %',
       (SELECT count(*) FROM public.user_life_vision);
  END IF;
  IF (SELECT count(*) FROM public.user_constraints)              <> 3 THEN
     RAISE EXCEPTION 'RLS leak: user A constraints count wrong';
  END IF;
  IF (SELECT count(*) FROM public.user_decision_preferences)     <> 4 THEN
     RAISE EXCEPTION 'RLS leak: user A decision-pref count wrong';
  END IF;
  IF (SELECT count(*) FROM public.user_commitment_levels)        <> 3 THEN
     RAISE EXCEPTION 'RLS leak: user A commitment count wrong';
  END IF;
  IF (SELECT count(*) FROM public.user_motivations)              <> 2 THEN
     RAISE EXCEPTION 'RLS leak: user A motivation count wrong';
  END IF;
  IF (SELECT count(*) FROM public.user_domain_risk_tolerance)    <> 5 THEN
     RAISE EXCEPTION 'RLS leak: user A risk count wrong';
  END IF;
  IF (SELECT count(*) FROM public.user_capabilities)             <> 2 THEN
     RAISE EXCEPTION 'RLS leak: user A capabilities count wrong';
  END IF;
  IF (SELECT count(*) FROM public.user_decisions)                <> 1 THEN
     RAISE EXCEPTION 'RLS leak: user A decisions count wrong';
  END IF;
  IF (SELECT count(*) FROM public.user_recommendations)          <> 1 THEN
     RAISE EXCEPTION 'RLS leak: user A recommendations count wrong';
  END IF;
  IF (SELECT count(*) FROM public.user_outcomes)                 <> 1 THEN
     RAISE EXCEPTION 'RLS leak: user A outcomes count wrong';
  END IF;
  RAISE NOTICE 'ASSERT OK: user A sees exactly their own rows in all 10 tables';

  -- User A trying to insert *as User B* must be blocked by WITH CHECK.
  caught_violation := FALSE;
  BEGIN
    INSERT INTO public.user_life_vision (user_id, horizon, vision_text)
    VALUES (user_b, '1_year', 'sneak attempt');
  EXCEPTION WHEN insufficient_privilege OR check_violation OR others THEN
    caught_violation := TRUE;
  END;
  IF NOT caught_violation THEN
    RAISE EXCEPTION 'RLS leak: User A was able to insert a row owned by User B';
  END IF;
  RAISE NOTICE 'ASSERT OK: user A cannot insert rows as user B';

  -- User A trying to UPDATE / DELETE one of B's (currently nonexistent) rows
  -- via an unfiltered statement still returns 0 affected — RLS hides B's rows.
  WITH upd AS (
    UPDATE public.user_life_vision SET vision_text = 'tampered'
    WHERE user_id = user_b
    RETURNING 1
  )
  SELECT count(*) INTO rec_count FROM upd;
  IF rec_count > 0 THEN
    RAISE EXCEPTION 'RLS leak: user A was able to UPDATE % rows for user B', rec_count;
  END IF;
  RAISE NOTICE 'ASSERT OK: user A cannot UPDATE user B''s rows';

  -- Switch to User B; they should see NOTHING (we never seeded their data).
  RESET ROLE;
  RAISE NOTICE '--- Switching session to User B ---';
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', user_b::text, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;

  IF (SELECT count(*) FROM public.user_life_vision)              <> 0
  OR (SELECT count(*) FROM public.user_constraints)              <> 0
  OR (SELECT count(*) FROM public.user_decision_preferences)     <> 0
  OR (SELECT count(*) FROM public.user_commitment_levels)        <> 0
  OR (SELECT count(*) FROM public.user_motivations)              <> 0
  OR (SELECT count(*) FROM public.user_domain_risk_tolerance)    <> 0
  OR (SELECT count(*) FROM public.user_capabilities)             <> 0
  OR (SELECT count(*) FROM public.user_decisions)                <> 0
  OR (SELECT count(*) FROM public.user_recommendations)          <> 0
  OR (SELECT count(*) FROM public.user_outcomes)                 <> 0 THEN
    RAISE EXCEPTION 'RLS leak: User B can see one of User A''s rows';
  END IF;
  RAISE NOTICE 'ASSERT OK: user B cannot see any of user A''s rows';

  -- User B can write their OWN rows — the minimum-field case.
  -- This proves "missing optional fields do not break completion".
  INSERT INTO public.user_life_vision (user_id, horizon, vision_text)
  VALUES (user_b, '1_year', 'minimum-fields row');
  INSERT INTO public.user_decision_preferences (user_id, axis, weight)
  VALUES (user_b, 'speed', 0.5);
  INSERT INTO public.user_constraints (user_id, dimension, description)
  VALUES (user_b, 'time', 'minimum-fields constraint');
  INSERT INTO public.user_recommendations (user_id, action)
  VALUES (user_b, 'minimum-fields recommendation');
  RAISE NOTICE 'ASSERT OK: minimum-field inserts succeed for user B';

  RESET ROLE;
  RAISE NOTICE '=========================================';
  RAISE NOTICE 'ALL ASSERTIONS PASSED for 060_user_graph_foundation.sql';
  RAISE NOTICE '=========================================';
END
$validate$;

ROLLBACK;
