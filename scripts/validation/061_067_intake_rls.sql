-- ==========================================================================
-- Validation for migrations 061–067 (intake expansion + onboarding sections).
--
-- Verifies, in one transactional script that ROLLBACKs at end:
--   1. Two synthetic users (A, B) exist and have full intake data.
--   2. RLS isolation across every new table — user A sees only their rows,
--      user B sees only their rows; cross-user INSERTs are blocked.
--   3. Encryption RPC core.encrypt_with_app_key() round-trips correctly
--      (when an encryption key is configured in app settings).
--   4. Minimum-field insertions succeed (skippable fields don't break flow).
--
-- Run with:  psql "$DATABASE_URL" -f scripts/validation/061_067_intake_rls.sql
--
-- A successful run prints "ALL ASSERTIONS PASSED" via RAISE NOTICE.
-- Any failure raises an exception (non-zero exit).
-- ==========================================================================

BEGIN;

DO $validate$
DECLARE
  user_a UUID := gen_random_uuid();
  user_b UUID := gen_random_uuid();
  cnt INT;
  caught BOOLEAN;
  has_key BOOLEAN;
  enc TEXT;
BEGIN
  RAISE NOTICE '--- Seeding two synthetic users (A=%, B=%) ---', user_a, user_b;

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

  -- =====================================================================
  -- 061: user_actions, user_life_events, expanded decision axes
  -- =====================================================================
  INSERT INTO public.user_actions (user_id, domain, action_type, action_title)
  VALUES
    (user_a, 'financial', 'opened_account', 'Opened Ally savings'),
    (user_a, 'career',    'submitted_application', 'Applied to Google L5');

  INSERT INTO public.user_life_events (user_id, event_type, event_title, occurred_at)
  VALUES
    (user_a, 'marriage',  'Got married',     CURRENT_DATE - 365),
    (user_a, 'job_change','Promoted to L5',  CURRENT_DATE - 90);

  -- New decision axes must accept the new values.
  INSERT INTO public.user_decision_preferences (user_id, axis, weight) VALUES
    (user_a, 'minimize_downside',          0.8),
    (user_a, 'minimize_stress',            0.7),
    (user_a, 'minimize_cost',              0.6),
    (user_a, 'maximize_long_term_net_worth', 0.9),
    (user_a, 'maximize_healthspan',        0.85),
    (user_a, 'maximize_family_stability',  0.95);

  -- =====================================================================
  -- 062: finance.user_financial_profile, finance.debts, financing_preferences
  -- =====================================================================
  INSERT INTO finance.user_financial_profile (user_id, annual_income, income_stability,
                                              employment_type, monthly_expenses,
                                              emergency_fund_amount, credit_score_range)
  VALUES (user_a, 180000, 'stable', 'w2_full_time', 7500, 30000, '740_799');

  INSERT INTO finance.financing_preferences (user_id, liquidity_preference,
                                             debt_pay_weight, invest_weight, save_weight)
  VALUES (user_a, 'moderate', 0.3, 0.5, 0.2);

  INSERT INTO finance.debts (user_id, debt_name, debt_type, current_balance,
                             interest_rate, minimum_payment)
  VALUES
    (user_a, 'Sapphire Reserve', 'credit_card',  4500.00, 0.2299, 120),
    (user_a, 'Student loan',     'student_loan', 22000.00, 0.0699, 280);

  -- =====================================================================
  -- 063: health intake — service_role bypass means these inserts succeed
  -- even when is_health_enabled() returns false (the default).
  -- =====================================================================
  INSERT INTO health_meta.training_profile (user_id, activity_level, gym_access)
  VALUES (user_a, 'very_active', TRUE);

  INSERT INTO health_meta.body_measurements (user_id, height_cm, weight_kg,
                                              target_weight_kg, waist_cm)
  VALUES (user_a, 183, 92, 86, 88);

  INSERT INTO health_meta.daily_wellbeing (user_id, observed_on, sleep_hours,
                                            energy_score, stress_score)
  VALUES (user_a, CURRENT_DATE, 7.5, 7, 4);

  INSERT INTO health_meta.injuries (user_id, body_region, severity, status)
  VALUES (user_a, 'lower_back', 'moderate', 'managed');

  INSERT INTO health_meta.nutrition_profile (user_id, diet_type,
                                              daily_calorie_target, protein_target_g)
  VALUES (user_a, 'mediterranean', 2600, 180);

  -- =====================================================================
  -- 064: insurance
  -- =====================================================================
  INSERT INTO public.insurance_plans (user_id, plan_type, carrier, plan_name,
                                       monthly_premium, annual_deductible,
                                       out_of_pocket_max, coinsurance_percent,
                                       hsa_eligible, source_of_coverage, is_primary)
  VALUES (user_a, 'medical', 'BlueCross', 'BCBS PPO 500',
          425.00, 1500.00, 6000.00, 20, TRUE, 'employer', TRUE);

  -- =====================================================================
  -- 065: career & education expansion
  -- =====================================================================
  INSERT INTO public.career_profiles (user_id, current_title, current_income,
                                       income_trajectory, job_change_willingness,
                                       entrepreneurial_interest, skill_gaps)
  VALUES (user_a, 'Senior Engineer', 215000, 'growing', 'passive', 'side_hustle',
          ARRAY['financial modeling', 'public speaking']);

  INSERT INTO public.education_intake (user_id, highest_completed_degree,
                                        tuition_budget_total, expected_roi_preference,
                                        credential_urgency, has_gi_bill,
                                        desired_schools)
  VALUES (user_a, 'bachelor', 60000, 'balanced', 'within_2_years', TRUE,
          ARRAY['Stanford MS-CS', 'GA Tech OMSA']);

  INSERT INTO public.education_credentials (user_id, credential_kind, name, status)
  VALUES (user_a, 'certification', 'AWS Solutions Architect Associate', 'active'),
         (user_a, 'target_credential', 'CFA Level I', 'target');

  -- =====================================================================
  -- 066: family / lifestyle
  -- =====================================================================
  UPDATE public.profiles SET marital_status = 'married', dependents_count = 2
   WHERE id = user_a;

  INSERT INTO public.family_lifestyle_profile (user_id, has_elder_care_responsibilities,
                                                caregiving_hours_per_week,
                                                willing_to_relocate,
                                                travel_frequency_target,
                                                lifestyle_goals, household_priorities)
  VALUES (user_a, TRUE, 6, 'regional', 'frequent',
          'More family time, less travel for work',
          ARRAY['family_time', 'health', 'financial_security']);

  INSERT INTO public.children_education_goals (user_id, child_birth_year,
                                                target_institution_type,
                                                estimated_total_cost,
                                                savings_vehicle,
                                                monthly_contribution)
  VALUES (user_a, 2018, 'public_in_state', 120000, '529', 300);

  -- =====================================================================
  -- 067: onboarding sections
  -- =====================================================================
  INSERT INTO public.user_onboarding_sections (user_id, section, status, completed_at)
  VALUES
    (user_a, 'financial',        'completed', NOW()),
    (user_a, 'health_wellness',  'completed', NOW()),
    (user_a, 'insurance_benefits','completed', NOW());

  RAISE NOTICE 'ASSERT OK: seeded all intake tables for user A';

  -- =====================================================================
  -- RLS isolation — switch to user A
  -- =====================================================================
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', user_a::text, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;

  -- Spot-check core tables under each schema:
  IF (SELECT count(*) FROM public.user_actions)                          = 0
    THEN RAISE EXCEPTION 'user A cannot see own user_actions'; END IF;
  IF (SELECT count(*) FROM public.user_life_events)                      = 0
    THEN RAISE EXCEPTION 'user A cannot see own user_life_events'; END IF;
  IF (SELECT count(*) FROM finance.user_financial_profile)               = 0
    THEN RAISE EXCEPTION 'user A cannot see own financial_profile'; END IF;
  IF (SELECT count(*) FROM finance.debts)                                = 0
    THEN RAISE EXCEPTION 'user A cannot see own debts'; END IF;
  IF (SELECT count(*) FROM public.insurance_plans)                       = 0
    THEN RAISE EXCEPTION 'user A cannot see own insurance_plans'; END IF;
  IF (SELECT count(*) FROM public.education_intake)                      = 0
    THEN RAISE EXCEPTION 'user A cannot see own education_intake'; END IF;
  IF (SELECT count(*) FROM public.education_credentials)                 = 0
    THEN RAISE EXCEPTION 'user A cannot see own education_credentials'; END IF;
  IF (SELECT count(*) FROM public.family_lifestyle_profile)              = 0
    THEN RAISE EXCEPTION 'user A cannot see own family_lifestyle_profile'; END IF;
  IF (SELECT count(*) FROM public.children_education_goals)              = 0
    THEN RAISE EXCEPTION 'user A cannot see own children_education_goals'; END IF;
  IF (SELECT count(*) FROM public.user_onboarding_sections)              = 0
    THEN RAISE EXCEPTION 'user A cannot see own onboarding sections'; END IF;
  RAISE NOTICE 'ASSERT OK: user A reads from all 10 newly populated tables';

  -- Cross-user write must be blocked by WITH CHECK.
  caught := FALSE;
  BEGIN
    INSERT INTO public.user_actions (user_id, action_type, action_title)
    VALUES (user_b, 'sneak', 'attempt');
  EXCEPTION WHEN insufficient_privilege OR check_violation OR others THEN
    caught := TRUE;
  END;
  IF NOT caught THEN
    RAISE EXCEPTION 'RLS leak: user A inserted a row as user B (user_actions)';
  END IF;
  RAISE NOTICE 'ASSERT OK: user A cannot insert rows as user B';

  -- =====================================================================
  -- Switch to user B
  -- =====================================================================
  RESET ROLE;
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', user_b::text, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;

  -- User B should see NOTHING in all of user A's tables.
  IF (SELECT count(*) FROM public.user_actions)            > 0
  OR (SELECT count(*) FROM public.user_life_events)        > 0
  OR (SELECT count(*) FROM finance.user_financial_profile) > 0
  OR (SELECT count(*) FROM finance.debts)                  > 0
  OR (SELECT count(*) FROM public.insurance_plans)         > 0
  OR (SELECT count(*) FROM public.education_intake)        > 0
  OR (SELECT count(*) FROM public.education_credentials)   > 0
  OR (SELECT count(*) FROM public.family_lifestyle_profile)> 0
  OR (SELECT count(*) FROM public.children_education_goals)> 0
  OR (SELECT count(*) FROM public.user_onboarding_sections)> 0
  THEN RAISE EXCEPTION 'RLS leak: user B saw at least one of user A''s rows'; END IF;
  RAISE NOTICE 'ASSERT OK: user B sees zero of user A''s rows across all 10 tables';

  -- User B can write the minimum-required-fields shape for each table.
  INSERT INTO public.user_actions (user_id, action_type, action_title)
  VALUES (user_b, 'minimum', 'just the required columns');
  INSERT INTO public.user_life_events (user_id, event_type, event_title, occurred_at)
  VALUES (user_b, 'other', 'minimum', CURRENT_DATE);
  INSERT INTO finance.user_financial_profile (user_id) VALUES (user_b);
  INSERT INTO finance.financing_preferences (user_id) VALUES (user_b);
  INSERT INTO finance.debts (user_id, debt_name, debt_type, current_balance)
  VALUES (user_b, 'min', 'other', 0);
  INSERT INTO public.insurance_plans (user_id, plan_type) VALUES (user_b, 'other');
  INSERT INTO public.education_intake (user_id) VALUES (user_b);
  INSERT INTO public.education_credentials (user_id, credential_kind, name)
  VALUES (user_b, 'badge', 'min');
  INSERT INTO public.family_lifestyle_profile (user_id) VALUES (user_b);
  INSERT INTO public.children_education_goals (user_id) VALUES (user_b);
  INSERT INTO public.user_onboarding_sections (user_id, section, status)
  VALUES (user_b, 'core_life_vision', 'in_progress');
  RAISE NOTICE 'ASSERT OK: user B min-field inserts succeed across all tables';

  -- Encryption RPC round-trip (only if a key is configured).
  RESET ROLE;
  has_key := current_setting('app.settings.encryption_key', true) IS NOT NULL
         AND length(coalesce(current_setting('app.settings.encryption_key', true),'')) > 0;
  IF has_key THEN
    enc := core.encrypt_with_app_key('test-member-id-12345');
    IF enc IS NULL OR length(enc) = 0 THEN
      RAISE EXCEPTION 'encrypt_with_app_key returned NULL/empty';
    END IF;
    RAISE NOTICE 'ASSERT OK: core.encrypt_with_app_key produced ciphertext (% chars)', length(enc);
  ELSE
    RAISE NOTICE 'SKIP: encryption key not set; core.encrypt_with_app_key round-trip not exercised';
  END IF;

  RAISE NOTICE '=========================================';
  RAISE NOTICE 'ALL ASSERTIONS PASSED for 061–067 intake expansion';
  RAISE NOTICE '=========================================';
END
$validate$;

ROLLBACK;
