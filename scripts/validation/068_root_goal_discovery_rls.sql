-- ==========================================================================
-- Validation for migration 068 — root-goal discovery + estate + consent.
--
-- Verifies in one transactional script (ROLLBACK at end):
--   1. user_id isolation on goals (new discovery columns), goal_discovery_turns,
--      estate_planning_profile, estate_beneficiaries, core.user_integration_consents.
--   2. Cross-user INSERT blocked by RLS WITH CHECK.
--   3. core.record_integration_consent / revoke_integration_consent RPCs work,
--      stamp the security_audit_log, and respect auth.uid().
--   4. GraphRAG triggers enqueue jobs into graphrag.sync_queue when the new
--      tables are written.
--
-- Run:  psql "$DATABASE_URL" -f scripts/validation/068_root_goal_discovery_rls.sql
-- ==========================================================================

BEGIN;

DO $validate$
DECLARE
  user_a UUID := gen_random_uuid();
  user_b UUID := gen_random_uuid();
  goal_a UUID;
  caught BOOLEAN;
  audit_count INT;
  enqueued INT;
BEGIN
  RAISE NOTICE '--- Seeding users A=% B=% ---', user_a, user_b;

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

  -- Seed a goal with the new discovery columns.
  INSERT INTO public.goals
    (user_id, title, category, stated_goal, need_behind_need, root_goal,
     success_definition, consequence_of_inaction, urgency,
     financial_security_score, image_score, performance_score,
     dominant_driver, secondary_driver, root_goal_confidence_score,
     discovery_completed_at)
  VALUES
    (user_a, 'Financial independence', 'financial',
     'I want to be financially independent',
     'I want to leave my job and be present with my kids',
     'Provide for my family without trading my time for money',
     'Portfolio covers expenses indefinitely',
     'I keep grinding and miss the kids growing up',
     'high',
     0.95, 0.10, 0.30,
     'financial_security', 'performance', 0.85, NOW())
  RETURNING id INTO goal_a;

  INSERT INTO public.goal_discovery_turns
    (user_id, goal_id, session_id, turn_index, prompt_kind, prompt_text,
     user_answer, detected_drivers, inferred_root_goal, confidence_after_turn,
     agent_persona)
  VALUES
    (user_a, goal_a, gen_random_uuid(), 0, 'what_accomplish',
     'What are you trying to accomplish?',
     'I want financial independence',
     '{"financial_security":1.0,"image":0,"performance":0}'::jsonb,
     NULL, 0.4, 'financial_advisor');

  -- Estate profile + beneficiaries
  INSERT INTO public.estate_planning_profile
    (user_id, has_will, has_living_trust, has_financial_poa,
     has_healthcare_directive, has_minor_children, guardian_designated,
     guardian_name, owns_business, digital_asset_inventory_status)
  VALUES
    (user_a, TRUE, FALSE, TRUE, TRUE, TRUE, TRUE,
     'Sibling A', FALSE, 'partial');

  INSERT INTO public.estate_beneficiaries
    (user_id, beneficiary_name, relationship, asset_class, allocation_percent,
     is_contingent)
  VALUES
    (user_a, 'Spouse', 'spouse', 'will_residual', 100, FALSE),
    (user_a, 'Child 1', 'child', 'retirement_account', 50, FALSE);

  RAISE NOTICE 'ASSERT OK: seeded 068 tables for user A';

  -- --- 1. user A reads only their own rows --------------------------
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', user_a::text, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;

  IF (SELECT count(*) FROM public.goals
       WHERE root_goal IS NOT NULL) = 0 THEN
     RAISE EXCEPTION 'user A cannot see own discovered goal';
  END IF;
  IF (SELECT count(*) FROM public.goal_discovery_turns) = 0 THEN
     RAISE EXCEPTION 'user A cannot see own goal_discovery_turns';
  END IF;
  IF (SELECT count(*) FROM public.estate_planning_profile) = 0 THEN
     RAISE EXCEPTION 'user A cannot see own estate_planning_profile';
  END IF;
  IF (SELECT count(*) FROM public.estate_beneficiaries) = 0 THEN
     RAISE EXCEPTION 'user A cannot see own estate_beneficiaries';
  END IF;
  RAISE NOTICE 'ASSERT OK: user A reads from all 068 tables';

  -- Cross-user INSERT must be blocked.
  caught := FALSE;
  BEGIN
    INSERT INTO public.estate_beneficiaries
      (user_id, beneficiary_name) VALUES (user_b, 'sneak');
  EXCEPTION WHEN insufficient_privilege OR check_violation OR others THEN
    caught := TRUE;
  END;
  IF NOT caught THEN
    RAISE EXCEPTION 'RLS leak: user A inserted estate_beneficiaries as user B';
  END IF;
  RAISE NOTICE 'ASSERT OK: cross-user INSERT blocked by WITH CHECK';

  -- --- 2. Integration consent RPC round-trip ------------------------
  -- record_integration_consent inserts a row and audit log.
  PERFORM core.record_integration_consent(
    'plaid', 'transaction_sync',
    '{"products":["transactions","liabilities"]}'::jsonb,
    'v1', NULL, NULL, NULL);

  IF (SELECT count(*) FROM core.user_integration_consents
       WHERE integration = 'plaid' AND purpose = 'transaction_sync' AND granted = TRUE) = 0 THEN
     RAISE EXCEPTION 'record_integration_consent did not insert a row';
  END IF;

  -- The function should be visible to authenticated and write under the
  -- caller's user_id (not user_b).
  IF (SELECT count(*) FROM core.user_integration_consents WHERE user_id = user_a) = 0 THEN
     RAISE EXCEPTION 'integration consent not attributed to authenticated user';
  END IF;

  -- Revocation should mark granted=FALSE + set revoked_at.
  PERFORM core.revoke_integration_consent(
    'plaid', 'transaction_sync', NULL, NULL);
  IF (SELECT count(*) FROM core.user_integration_consents
       WHERE integration = 'plaid' AND purpose = 'transaction_sync'
         AND granted = FALSE AND revoked_at IS NOT NULL) = 0 THEN
     RAISE EXCEPTION 'revoke_integration_consent did not flip the row';
  END IF;
  RAISE NOTICE 'ASSERT OK: integration consent RPC round-trip works';

  -- --- 3. User B sees none of A's rows -----------------------------
  RESET ROLE;
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', user_b::text, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;

  IF (SELECT count(*) FROM public.goal_discovery_turns) > 0
  OR (SELECT count(*) FROM public.estate_planning_profile) > 0
  OR (SELECT count(*) FROM public.estate_beneficiaries) > 0
  OR (SELECT count(*) FROM core.user_integration_consents) > 0
  THEN RAISE EXCEPTION 'RLS leak: user B can see user A''s rows'; END IF;
  RAISE NOTICE 'ASSERT OK: user B sees zero of user A''s 068 rows';

  -- --- 4. GraphRAG triggers enqueued jobs --------------------------
  RESET ROLE;
  enqueued := (SELECT count(*) FROM graphrag.sync_queue
                WHERE user_id = user_a
                  AND entity_type IN ('goal_discovery_turn',
                                       'estate_profile',
                                       'estate_beneficiary'));
  IF enqueued = 0 THEN
    RAISE EXCEPTION 'expected GraphRAG sync_queue entries for new 068 tables, got 0';
  END IF;
  RAISE NOTICE 'ASSERT OK: GraphRAG triggers enqueued % jobs', enqueued;

  -- --- 5. Audit log has the consent events ------------------------
  audit_count := (SELECT count(*) FROM core.security_audit_log
                   WHERE user_id = user_a
                     AND action IN ('integration_consent_granted', 'integration_consent_revoked'));
  IF audit_count < 2 THEN
    RAISE EXCEPTION 'expected at least 2 consent audit log entries, got %', audit_count;
  END IF;
  RAISE NOTICE 'ASSERT OK: % consent audit-log events recorded', audit_count;

  RAISE NOTICE '=========================================';
  RAISE NOTICE 'ALL ASSERTIONS PASSED for migration 068';
  RAISE NOTICE '=========================================';
END
$validate$;

ROLLBACK;
