-- ==========================================================================
-- 088 RLS verification — Decision Governance Layer.
--
-- Assertions:
--   1. A user can read their own decision_governance_audit rows.
--   2. A user CANNOT read another user's audit rows (cross-user leak).
--   3. policy_versions is world-readable (transparency).
--   4. agent_registry is world-readable.
--   5. agent_registry insert is service-role only (authenticated insert fails).
--   6. safety_messages is world-readable.
--   7. governance.agent_is_registered() correctly reports for active rows.
-- ==========================================================================
BEGIN;

DO $$
BEGIN
  INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at)
  VALUES
    ('00000000-0000-0000-0000-00000Gov0001', 'gov-1@lifenav.test', crypt('x', gen_salt('bf')), NOW(), NOW()),
    ('00000000-0000-0000-0000-00000Gov0002', 'gov-2@lifenav.test', crypt('x', gen_salt('bf')), NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;
END $$;

INSERT INTO public.profiles (id, email) VALUES
  ('00000000-0000-0000-0000-00000Gov0001', 'gov-1@lifenav.test'),
  ('00000000-0000-0000-0000-00000Gov0002', 'gov-2@lifenav.test')
ON CONFLICT (id) DO NOTHING;

-- Audit rows owned by user 1 + user 2 each
INSERT INTO governance.decision_governance_audit
  (id, user_id, subject_kind, subject_id, approved, severity, governance_version, policy_checks, violations)
VALUES
  ('00000000-0000-0000-0000-00000GovA001',
    '00000000-0000-0000-0000-00000Gov0001', 'recommendation',
    NULL, TRUE, 'none', '1.0.0', '[]'::jsonb, '[]'::jsonb),
  ('00000000-0000-0000-0000-00000GovA002',
    '00000000-0000-0000-0000-00000Gov0002', 'recommendation',
    NULL, FALSE, 'critical', '1.0.0', '[]'::jsonb,
    '[{"category":"unsafe_health","severity":"critical","rule_id":"x","reason":"y","principle":"no_harm"}]'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- ---- Assertion 1+2: cross-user leak test ---------------------------------
DO $$
DECLARE n_self INT; n_other INT;
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub','00000000-0000-0000-0000-00000Gov0001')::text, true);
  PERFORM set_config('role', 'authenticated', true);

  SELECT COUNT(*) INTO n_self FROM governance.decision_governance_audit
    WHERE id = '00000000-0000-0000-0000-00000GovA001';
  IF n_self = 0 THEN RAISE EXCEPTION '088 RLS: user 1 cannot read own audit row'; END IF;

  SELECT COUNT(*) INTO n_other FROM governance.decision_governance_audit
    WHERE id = '00000000-0000-0000-0000-00000GovA002';
  IF n_other <> 0 THEN RAISE EXCEPTION '088 RLS LEAK: user 1 saw user 2 audit row'; END IF;

  RESET role;
  PERFORM set_config('request.jwt.claims', '', true);
END $$;

-- ---- Assertion 3: policy_versions world-readable -------------------------
DO $$
DECLARE n INT;
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub','00000000-0000-0000-0000-00000Gov0001')::text, true);
  PERFORM set_config('role', 'authenticated', true);
  SELECT COUNT(*) INTO n FROM governance.policy_versions WHERE version = '1.0.0';
  IF n = 0 THEN RAISE EXCEPTION '088 RLS: policy_versions not readable by authenticated'; END IF;
  RESET role;
  PERFORM set_config('request.jwt.claims', '', true);
END $$;

-- ---- Assertion 4: agent_registry world-readable --------------------------
DO $$
DECLARE n INT;
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub','00000000-0000-0000-0000-00000Gov0001')::text, true);
  PERFORM set_config('role', 'authenticated', true);
  SELECT COUNT(*) INTO n FROM governance.agent_registry WHERE agent_name = 'advisor.core';
  IF n = 0 THEN RAISE EXCEPTION '088 RLS: agent_registry not readable by authenticated'; END IF;
  RESET role;
  PERFORM set_config('request.jwt.claims', '', true);
END $$;

-- ---- Assertion 5: authenticated cannot insert into agent_registry --------
DO $$
DECLARE inserted BOOLEAN := TRUE;
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub','00000000-0000-0000-0000-00000Gov0001')::text, true);
  PERFORM set_config('role', 'authenticated', true);
  BEGIN
    INSERT INTO governance.agent_registry (agent_kind, agent_name, active)
    VALUES ('partner', 'auth.tried.to.register', TRUE);
  EXCEPTION WHEN insufficient_privilege OR check_violation OR others THEN
    inserted := FALSE;
  END;
  IF inserted THEN
    -- Also acceptable: the policy stack denied silently and the row never
    -- materialized. Verify either way.
    PERFORM 1 FROM governance.agent_registry WHERE agent_name = 'auth.tried.to.register';
    IF FOUND THEN
      RAISE EXCEPTION '088 RLS: authenticated should not be able to insert agent_registry rows';
    END IF;
  END IF;
  RESET role;
  PERFORM set_config('request.jwt.claims', '', true);
END $$;

-- ---- Assertion 6: safety_messages world-readable -------------------------
DO $$
DECLARE n INT;
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub','00000000-0000-0000-0000-00000Gov0001')::text, true);
  PERFORM set_config('role', 'authenticated', true);
  SELECT COUNT(*) INTO n FROM governance.safety_messages WHERE category = 'self_harm';
  IF n = 0 THEN RAISE EXCEPTION '088 RLS: safety_messages not readable by authenticated'; END IF;
  RESET role;
  PERFORM set_config('request.jwt.claims', '', true);
END $$;

-- ---- Assertion 7: agent_is_registered() reports correctly ----------------
DO $$
DECLARE r BOOLEAN;
BEGIN
  SELECT governance.agent_is_registered('advisor', 'advisor.core') INTO r;
  IF NOT r THEN RAISE EXCEPTION '088: advisor.core should be registered'; END IF;

  SELECT governance.agent_is_registered('partner', 'nonexistent') INTO r;
  IF r THEN RAISE EXCEPTION '088: nonexistent agent should NOT be registered'; END IF;
END $$;

ROLLBACK;
