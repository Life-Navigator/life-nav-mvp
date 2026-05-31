-- ==========================================================================
-- Validation for migration 073 — wearable monitoring + alert engine RLS.
--
-- Steps (all inside a single transaction that ROLLBACKs at the end):
--   1. Temporarily flip public.is_health_enabled() to TRUE so we can
--      exercise the owner-context policies on the gated tables. The
--      ROLLBACK at the end restores the original function definition.
--   2. Seed two users (A, B).
--   3. Insert preferences / alert rules / alert events for user A under
--      service-role context.
--   4. Switch to user A's authenticated role and assert they can read
--      every owned row.
--   5. Assert a cross-user INSERT (user_id = user_b while authenticated
--      as A) is blocked by RLS WITH CHECK.
--   6. Switch to user B and assert they see zero of A's rows.
--   7. Verify the indexed access patterns (alerts list by status filter,
--      active rules) return rows.
-- ==========================================================================

BEGIN;

-- 1. Flip the health gate for the lifetime of this transaction.
CREATE OR REPLACE FUNCTION public.is_health_enabled()
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER
AS $$ SELECT true; $$;

DO $validate$
DECLARE
  user_a UUID := gen_random_uuid();
  user_b UUID := gen_random_uuid();
  rule_a UUID;
  caught BOOLEAN;
  pending_count INT;
  active_rule_count INT;
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
  VALUES (user_a, 'a+' || user_a || '@validation.local', 'User A'),
         (user_b, 'b+' || user_b || '@validation.local', 'User B');

  -- 2. Seed under service-role/postgres context.
  INSERT INTO health_meta.health_monitoring_preferences
    (user_id, alerts_enabled, min_severity_to_notify, share_alerts_with_physician)
  VALUES (user_a, TRUE, 'watch', FALSE);

  INSERT INTO health_meta.health_alert_rules
    (user_id, rule_key, is_active, thresholds, cooldown_minutes, severity)
  VALUES
    (user_a, 'rhr_up_sleep_down',       TRUE, '{}'::jsonb, 720, 'watch'),
    (user_a, 'bp_trend_worsening',      TRUE, '{}'::jsonb, 720, 'warn'),
    (user_a, 'weight_sudden_drop',      TRUE, '{}'::jsonb, 720, 'watch'),
    (user_a, 'recovery_score_collapse', TRUE, '{}'::jsonb, 720, 'watch'),
    (user_a, 'concerning_combo',        TRUE, '{}'::jsonb, 720, 'watch'),
    (user_a, 'lab_out_of_range',        TRUE, '{}'::jsonb, 720, 'urgent')
  RETURNING id INTO rule_a;  -- gets the last id; we just need one for FK

  INSERT INTO health_meta.health_alert_events
    (user_id, rule_id, rule_key, severity, observed_at,
     headline, body, recommended_next_step, trigger_metrics)
  VALUES
    (user_a, rule_a, 'lab_out_of_range', 'urgent', NOW(),
     'A recent lab result is flagged as critical',
     'One of your recent lab results is flagged as critical by your lab.',
     'Please contact your physician promptly to review this result.',
     '{"flagged_count":1}'::jsonb);

  RAISE NOTICE 'ASSERT OK: seeded preferences, rules, and one event for user A';

  -- 3. Switch to user A context.
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', user_a::text, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;

  -- A sees their own rows.
  IF (SELECT count(*) FROM health_meta.health_monitoring_preferences) = 0 THEN
     RAISE EXCEPTION 'user A cannot see own preferences row';
  END IF;
  active_rule_count := (SELECT count(*) FROM health_meta.health_alert_rules
                         WHERE is_active = TRUE);
  IF active_rule_count <> 6 THEN
     RAISE EXCEPTION 'expected 6 active rules for user A, saw %', active_rule_count;
  END IF;
  pending_count := (SELECT count(*) FROM health_meta.health_alert_events
                     WHERE acknowledged_at IS NULL AND dismissed_at IS NULL);
  IF pending_count <> 1 THEN
     RAISE EXCEPTION 'expected 1 pending event for user A, saw %', pending_count;
  END IF;
  RAISE NOTICE 'ASSERT OK: user A reads own preferences, rules, and pending events';

  -- A acknowledges the event.
  UPDATE health_meta.health_alert_events
     SET acknowledged_at = NOW()
   WHERE rule_key = 'lab_out_of_range';
  IF (SELECT count(*) FROM health_meta.health_alert_events
       WHERE acknowledged_at IS NOT NULL) <> 1 THEN
     RAISE EXCEPTION 'user A could not acknowledge own event';
  END IF;
  RAISE NOTICE 'ASSERT OK: user A acknowledged own event';

  -- Cross-user INSERT blocked.
  caught := FALSE;
  BEGIN
    INSERT INTO health_meta.health_alert_events
      (user_id, rule_key, severity, observed_at,
       headline, body, recommended_next_step, trigger_metrics)
    VALUES (user_b, 'lab_out_of_range', 'watch', NOW(),
            'sneak', 'sneak', 'sneak', '{}'::jsonb);
  EXCEPTION WHEN insufficient_privilege OR check_violation OR others THEN
    caught := TRUE;
  END;
  IF NOT caught THEN
    RAISE EXCEPTION 'RLS leak: user A inserted alert event as user B';
  END IF;
  RAISE NOTICE 'ASSERT OK: cross-user INSERT blocked';

  -- 4. Switch to user B.
  RESET ROLE;
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', user_b::text, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;

  IF (SELECT count(*) FROM health_meta.health_monitoring_preferences) > 0
  OR (SELECT count(*) FROM health_meta.health_alert_rules) > 0
  OR (SELECT count(*) FROM health_meta.health_alert_events) > 0
  THEN RAISE EXCEPTION 'RLS leak: user B can see user A''s rows'; END IF;
  RAISE NOTICE 'ASSERT OK: user B sees zero of user A''s rows';

  -- 5. User B can write their own minimum-field preferences (proves the
  --    feature is usable when health gate is on).
  INSERT INTO health_meta.health_monitoring_preferences (user_id)
  VALUES (user_b);
  IF (SELECT count(*) FROM health_meta.health_monitoring_preferences) <> 1 THEN
    RAISE EXCEPTION 'user B could not insert own minimum-fields preferences';
  END IF;
  RAISE NOTICE 'ASSERT OK: user B min-fields insert works';

  RESET ROLE;
  RAISE NOTICE '=========================================';
  RAISE NOTICE 'ALL ASSERTIONS PASSED for migration 073';
  RAISE NOTICE '=========================================';
END
$validate$;

ROLLBACK;
