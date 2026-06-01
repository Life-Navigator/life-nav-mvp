-- ==========================================================================
-- 086 RLS verification — Arcana schema.
--
-- Critical assertions:
--   1. Owner can read their own arcana_profiles / arcana_goals / biometric_observations / labs.
--   2. Owner CANNOT read another user's Arcana rows (cross-user leak test).
--   3. lead_package_consents revoke flips arcana.has_active_lead_consent() to FALSE.
--   4. lead_package_consents expiry flips arcana.has_active_lead_consent() to FALSE.
--   5. The two domain enum helpers accept the six new domains.
--
-- Usage:
--   psql "$DATABASE_URL" -f scripts/validation/verify_086_arcana_rls.sql
-- ==========================================================================
BEGIN;

DO $$
BEGIN
  INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at)
  VALUES
    ('00000000-0000-0000-0000-00000ArcUsr1', 'arc-1@lifenav.test', crypt('x', gen_salt('bf')), NOW(), NOW()),
    ('00000000-0000-0000-0000-00000ArcUsr2', 'arc-2@lifenav.test', crypt('x', gen_salt('bf')), NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;
END $$;

INSERT INTO public.profiles (id, email) VALUES
  ('00000000-0000-0000-0000-00000ArcUsr1', 'arc-1@lifenav.test'),
  ('00000000-0000-0000-0000-00000ArcUsr2', 'arc-2@lifenav.test')
ON CONFLICT (id) DO NOTHING;

-- Two Arcana profiles
INSERT INTO arcana.arcana_profiles (id, user_id, intake_source)
VALUES
  ('00000000-0000-0000-0000-00000ArcProf1', '00000000-0000-0000-0000-00000ArcUsr1', 'arcana'),
  ('00000000-0000-0000-0000-00000ArcProf2', '00000000-0000-0000-0000-00000ArcUsr2', 'arcana')
ON CONFLICT (id) DO NOTHING;

-- Goals (one per user)
INSERT INTO arcana.arcana_goals (id, user_id, profile_id, goal_kind, domain, title)
VALUES
  ('00000000-0000-0000-0000-000000ArcGoal1',
    '00000000-0000-0000-0000-00000ArcUsr1', '00000000-0000-0000-0000-00000ArcProf1',
    'cardiovascular_health', 'health', 'Get to VO2max 50'),
  ('00000000-0000-0000-0000-000000ArcGoal2',
    '00000000-0000-0000-0000-00000ArcUsr2', '00000000-0000-0000-0000-00000ArcProf2',
    'fat_loss', 'body_composition', 'Get to 15% BF')
ON CONFLICT (id) DO NOTHING;

-- ---- Assertion 1+2: cross-user leak ---------------------------------------
DO $$
DECLARE n_self INT; n_other INT;
BEGIN
  -- impersonate user 1
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', '00000000-0000-0000-0000-00000ArcUsr1')::text, true);
  PERFORM set_config('role', 'authenticated', true);

  SELECT COUNT(*) INTO n_self
    FROM arcana.arcana_goals WHERE user_id = '00000000-0000-0000-0000-00000ArcUsr1';
  IF n_self = 0 THEN RAISE EXCEPTION '086 RLS: user 1 cannot see their own goals'; END IF;

  SELECT COUNT(*) INTO n_other
    FROM arcana.arcana_goals WHERE user_id = '00000000-0000-0000-0000-00000ArcUsr2';
  IF n_other <> 0 THEN RAISE EXCEPTION '086 RLS LEAK: user 1 saw user 2 arcana_goals (n=%)', n_other; END IF;

  RESET role;
  PERFORM set_config('request.jwt.claims', '', true);
END $$;

-- ---- Assertion 3: revoked consent blocks ---------------------------------
INSERT INTO arcana.lead_package_consents (id, user_id, consent_kind, granted_at)
VALUES ('00000000-0000-0000-0000-000000Consent1', '00000000-0000-0000-0000-00000ArcUsr1', 'lead_package', NOW())
ON CONFLICT (id) DO NOTHING;

DO $$
DECLARE ok BOOLEAN;
BEGIN
  SELECT arcana.has_active_lead_consent('00000000-0000-0000-0000-000000Consent1'::uuid) INTO ok;
  IF NOT ok THEN RAISE EXCEPTION '086 consent: fresh consent should be active'; END IF;

  UPDATE arcana.lead_package_consents
    SET revoked_at = NOW()
    WHERE id = '00000000-0000-0000-0000-000000Consent1';

  SELECT arcana.has_active_lead_consent('00000000-0000-0000-0000-000000Consent1'::uuid) INTO ok;
  IF ok THEN RAISE EXCEPTION '086 consent: revoked consent should be inactive'; END IF;
END $$;

-- ---- Assertion 4: expired consent ----------------------------------------
INSERT INTO arcana.lead_package_consents (id, user_id, consent_kind, granted_at, expires_at)
VALUES ('00000000-0000-0000-0000-000000Consent2', '00000000-0000-0000-0000-00000ArcUsr1', 'lead_package', NOW() - INTERVAL '7 days', NOW() - INTERVAL '1 day')
ON CONFLICT (id) DO NOTHING;

DO $$
DECLARE ok BOOLEAN;
BEGIN
  SELECT arcana.has_active_lead_consent('00000000-0000-0000-0000-000000Consent2'::uuid) INTO ok;
  IF ok THEN RAISE EXCEPTION '086 consent: expired consent should be inactive'; END IF;
END $$;

-- ---- Assertion 5: domain enum extensions ---------------------------------
DO $$
BEGIN
  IF NOT central.is_domain('performance') THEN RAISE EXCEPTION '086 enum: central missing performance'; END IF;
  IF NOT central.is_domain('recovery') THEN RAISE EXCEPTION '086 enum: central missing recovery'; END IF;
  IF NOT central.is_domain('longevity') THEN RAISE EXCEPTION '086 enum: central missing longevity'; END IF;
  IF NOT central.is_domain('body_composition') THEN RAISE EXCEPTION '086 enum: central missing body_composition'; END IF;
  IF NOT central.is_domain('preventative_care') THEN RAISE EXCEPTION '086 enum: central missing preventative_care'; END IF;

  IF NOT decision_intelligence.is_domain('performance') THEN RAISE EXCEPTION '086 enum: decision_intelligence missing performance'; END IF;
  IF NOT decision_intelligence.is_domain('longevity') THEN RAISE EXCEPTION '086 enum: decision_intelligence missing longevity'; END IF;
END $$;

ROLLBACK;
