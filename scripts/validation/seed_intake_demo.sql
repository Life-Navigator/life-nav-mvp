-- ==========================================================================
-- Seed: realistic intake data for a single demo user.
--
-- Use this against a *local development* Supabase only. It creates an
-- auth.users + profiles entry and populates every intake table with
-- plausible values so the UI hub renders meaningfully.
--
-- Run with:  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
--                 -f scripts/validation/seed_intake_demo.sql
--
-- Idempotent: if the demo user already exists, the script wipes their
-- intake data and re-seeds it.
-- ==========================================================================

\set demo_email 'demo+intake@lifenavigator.local'

BEGIN;

DO $seed$
DECLARE
  v_user UUID;
BEGIN
  SELECT id INTO v_user FROM auth.users WHERE email = :'demo_email';

  IF v_user IS NULL THEN
    v_user := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password,
                            email_confirmed_at, created_at, updated_at)
    VALUES (v_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
            :'demo_email', '', NOW(), NOW(), NOW());
    INSERT INTO public.profiles (id, email, display_name, marital_status, dependents_count)
    VALUES (v_user, :'demo_email', 'Demo Navigator', 'married', 2);
  ELSE
    -- Cascade-clear so we re-seed cleanly.
    DELETE FROM finance.debts                       WHERE user_id = v_user;
    DELETE FROM finance.user_financial_profile      WHERE user_id = v_user;
    DELETE FROM finance.financing_preferences       WHERE user_id = v_user;
    DELETE FROM health_meta.body_measurements       WHERE user_id = v_user;
    DELETE FROM health_meta.training_profile        WHERE user_id = v_user;
    DELETE FROM health_meta.injuries                WHERE user_id = v_user;
    DELETE FROM health_meta.mobility_limitations    WHERE user_id = v_user;
    DELETE FROM health_meta.daily_wellbeing         WHERE user_id = v_user;
    DELETE FROM health_meta.vitals_log              WHERE user_id = v_user;
    DELETE FROM health_meta.lab_results             WHERE user_id = v_user;
    DELETE FROM health_meta.lab_panels              WHERE user_id = v_user;
    DELETE FROM health_meta.medications             WHERE user_id = v_user;
    DELETE FROM health_meta.supplements             WHERE user_id = v_user;
    DELETE FROM health_meta.interventions           WHERE user_id = v_user;
    DELETE FROM health_meta.nutrition_profile       WHERE user_id = v_user;
    DELETE FROM health_meta.diet_log                WHERE user_id = v_user;
    DELETE FROM public.insurance_documents          WHERE user_id = v_user;
    DELETE FROM public.insurance_extracted_facts    WHERE user_id = v_user;
    DELETE FROM public.insurance_plans              WHERE user_id = v_user;
    DELETE FROM public.education_intake             WHERE user_id = v_user;
    DELETE FROM public.education_credentials        WHERE user_id = v_user;
    DELETE FROM public.children_education_goals     WHERE user_id = v_user;
    DELETE FROM public.family_lifestyle_profile     WHERE user_id = v_user;
    DELETE FROM public.user_onboarding_sections     WHERE user_id = v_user;
    DELETE FROM public.user_actions                 WHERE user_id = v_user;
    DELETE FROM public.user_life_events             WHERE user_id = v_user;
    UPDATE public.profiles
       SET marital_status='married', dependents_count=2
     WHERE id = v_user;
  END IF;

  -- --------------------------- finance --------------------------------
  INSERT INTO finance.user_financial_profile
    (user_id, annual_income, income_stability, employment_type, household_size,
     spouse_annual_income, monthly_expenses, monthly_discretionary_income,
     emergency_fund_amount, emergency_fund_months,
     credit_score_range, credit_card_utilization,
     hsa_eligible, hsa_current_balance, fsa_eligible, fsa_election_amount,
     employer_match_percent, employer_match_limit_percent, has_pension,
     monthly_insurance_premiums,
     estimated_marginal_tax_bracket, estimated_effective_tax_rate,
     current_bank, current_brokerage, preferred_financial_institution)
  VALUES
    (v_user, 215000, 'stable', 'w2_full_time', 4,
     65000, 9000, 3500,
     45000, 5,
     '740_799', 18.0,
     TRUE, 8400, FALSE, NULL,
     50, 6, FALSE,
     1200,
     0.32, 0.24,
     'Ally', 'Fidelity', 'Vanguard');

  INSERT INTO finance.financing_preferences
    (user_id, liquidity_preference, liquidity_target_months,
     debt_pay_weight, invest_weight, save_weight, notes)
  VALUES (v_user, 'moderate', 6, 0.25, 0.55, 0.20,
          'Bias toward investing once debt utilization is <10%.');

  INSERT INTO finance.debts (user_id, debt_name, debt_type, current_balance, interest_rate, minimum_payment, payoff_strategy)
  VALUES
    (v_user, 'Sapphire Reserve',       'credit_card',  4500,  0.2299, 120, 'avalanche'),
    (v_user, 'Federal student loan',   'student_loan', 22000, 0.0699, 280, 'snowball'),
    (v_user, 'Tax debt 2023',          'tax_debt',     3200,  0.0800,  90, 'minimum_only');

  -- --------------------------- health ---------------------------------
  INSERT INTO health_meta.training_profile
    (user_id, activity_level, years_training, preferred_modalities,
     sessions_per_week_target, session_duration_minutes_target,
     walking_tolerance_minutes, running_tolerance_minutes,
     swimming_access, gym_access, available_equipment)
  VALUES (v_user, 'very_active', 12,
          ARRAY['strength','run','yoga'],
          5, 60, 60, 40,
          TRUE, TRUE,
          ARRAY['barbell','dumbbells','rower','kettlebells']);

  INSERT INTO health_meta.body_measurements
    (user_id, height_cm, weight_kg, target_weight_kg, waist_cm, neck_cm, chest_cm,
     shoulders_cm, hips_cm)
  VALUES (v_user, 183, 92, 86, 88, 41, 110, 130, 99);

  INSERT INTO health_meta.daily_wellbeing
    (user_id, observed_on, sleep_hours, sleep_quality, energy_score, recovery_score,
     stress_score, mood_score, focus_score)
  VALUES (v_user, CURRENT_DATE, 7.0, 7, 7, 6, 4, 7, 7);

  INSERT INTO health_meta.injuries (user_id, body_region, side, severity, status, pain_score)
  VALUES
    (v_user, 'lower_back', 'na',    'moderate', 'managed', 3),
    (v_user, 'knee',       'right', 'mild',     'managed', 2);

  INSERT INTO health_meta.nutrition_profile
    (user_id, diet_type, daily_calorie_target, protein_target_g,
     carb_target_g, fat_target_g, fiber_target_g, water_target_ml,
     alcohol_drinks_per_week_target, caffeine_mg_per_day_target,
     food_allergies)
  VALUES (v_user, 'mediterranean', 2600, 180, 280, 90, 40, 3500, 3, 200,
          ARRAY['tree_nuts']);

  INSERT INTO health_meta.supplements (user_id, name, category, dose, unit, frequency)
  VALUES
    (v_user, 'Creatine monohydrate', 'mineral', '5', 'g',  'daily'),
    (v_user, 'Vitamin D3',           'vitamin', '2000','IU','daily'),
    (v_user, 'Magnesium glycinate',  'mineral', '400','mg','daily');

  -- --------------------------- insurance ------------------------------
  INSERT INTO public.insurance_plans
    (user_id, plan_type, carrier, plan_name, monthly_premium,
     annual_deductible, deductible_met_ytd, out_of_pocket_max, out_of_pocket_met_ytd,
     copay_primary_care, copay_specialist, copay_er, coinsurance_percent,
     hsa_eligible, network_type, source_of_coverage, is_primary)
  VALUES
    (v_user, 'medical', 'BlueCross', 'BCBS PPO 500',
     425, 1500, 600, 6000, 1100,
     25, 50, 350, 20,
     TRUE, 'ppo', 'employer', TRUE),
    (v_user, 'dental', 'Delta', 'Delta Dental PPO Plus',
     30, 50, 50, 1500, 250,
     NULL, NULL, NULL, 20,
     FALSE, 'ppo', 'employer', FALSE);

  -- --------------------------- career & education ---------------------
  -- career_profiles is UNIQUE(user_id); upsert from any value present.
  INSERT INTO public.career_profiles
    (user_id, current_title, current_company, industry,
     current_income, income_trajectory,
     promotion_target, target_income,
     time_for_upskilling_hours_per_week,
     job_change_willingness, entrepreneurial_interest,
     networking_capacity, relocation_willingness, skill_gaps)
  VALUES (v_user, 'Senior Engineer', 'Acme Corp', 'Software',
          215000, 'growing',
          'Staff Engineer', 280000,
          6,
          'passive', 'side_hustle',
          'moderate', 'regional_only',
          ARRAY['financial modeling','public speaking'])
  ON CONFLICT (user_id) DO UPDATE SET
    current_title = EXCLUDED.current_title,
    current_company = EXCLUDED.current_company,
    industry = EXCLUDED.industry,
    current_income = EXCLUDED.current_income;

  INSERT INTO public.education_intake
    (user_id, highest_completed_degree, current_program, current_institution,
     tuition_budget_total, willing_to_take_loans, expected_roi_preference,
     credential_urgency, time_available_for_study_hours_per_week,
     has_gi_bill, gi_bill_remaining_months, employer_tuition_reimbursement_annual,
     desired_schools, financing_options)
  VALUES (v_user, 'bachelor', 'OMSA', 'Georgia Tech',
          50000, FALSE, 'balanced',
          'within_2_years', 8,
          TRUE, 18, 5250,
          ARRAY['Stanford MS-CS','GA Tech OMSA'],
          ARRAY['gi_bill','employer_reimbursement','savings']);

  INSERT INTO public.education_credentials (user_id, credential_kind, name, issuer, status)
  VALUES
    (v_user, 'certification',     'AWS Solutions Architect Associate', 'AWS', 'active'),
    (v_user, 'target_credential', 'CFA Level I',                       'CFA Institute', 'target');

  -- --------------------------- family / lifestyle ---------------------
  INSERT INTO public.family_lifestyle_profile
    (user_id, has_elder_care_responsibilities, caregiving_hours_per_week,
     family_financial_obligations_monthly, willing_to_relocate,
     must_stay_near_family, travel_frequency_target, travel_budget_annual,
     lifestyle_goals, household_priorities)
  VALUES (v_user, TRUE, 6, 800, 'regional',
          TRUE, 'frequent', 8000,
          'More family time, fewer travel weeks for work.',
          ARRAY['family_time','health','financial_security','community']);

  INSERT INTO public.children_education_goals
    (user_id, child_birth_year, target_institution_type,
     estimated_total_cost, savings_vehicle, current_savings, monthly_contribution,
     funding_source)
  VALUES
    (v_user, 2018, 'public_in_state', 120000, '529', 18000, 300,
     ARRAY['parents','grandparents']),
    (v_user, 2020, 'public_in_state', 120000, '529', 9000,  250,
     ARRAY['parents','grandparents']);

  -- --------------------------- user_actions / life_events -------------
  INSERT INTO public.user_actions (user_id, domain, action_type, action_title, taken_at)
  VALUES
    (v_user, 'financial', 'opened_account',        'Opened Ally HYSA',        NOW() - INTERVAL '14 days'),
    (v_user, 'career',    'submitted_application', 'Applied to Google L5',    NOW() - INTERVAL '6 days'),
    (v_user, 'health',    'scheduled_appointment', 'Booked annual physical',  NOW() - INTERVAL '2 days');

  INSERT INTO public.user_life_events
    (user_id, event_type, event_title, occurred_at, impact_level, is_anticipated)
  VALUES
    (v_user, 'marriage',  'Got married',     CURRENT_DATE - 1800, 'major',  FALSE),
    (v_user, 'birth',     'First child',     CURRENT_DATE - 2200, 'major',  FALSE),
    (v_user, 'birth',     'Second child',    CURRENT_DATE - 1400, 'major',  FALSE),
    (v_user, 'promotion', 'Promoted to L5',  CURRENT_DATE - 90,   'high',   FALSE);

  -- --------------------------- onboarding sections --------------------
  INSERT INTO public.user_onboarding_sections (user_id, section, status, completed_at)
  VALUES
    (v_user, 'core_life_vision',         'completed', NOW()),
    (v_user, 'financial',                'completed', NOW()),
    (v_user, 'career',                   'completed', NOW()),
    (v_user, 'education',                'completed', NOW()),
    (v_user, 'health_wellness',          'completed', NOW()),
    (v_user, 'insurance_benefits',       'completed', NOW()),
    (v_user, 'family_lifestyle',         'completed', NOW()),
    (v_user, 'risk_decision_preferences','in_progress', NULL),
    (v_user, 'commitment_capacity',      'not_started', NULL),
    (v_user, 'final_review',             'not_started', NULL);

  RAISE NOTICE 'Seeded demo intake for user_id = %', v_user;
END
$seed$;

COMMIT;
