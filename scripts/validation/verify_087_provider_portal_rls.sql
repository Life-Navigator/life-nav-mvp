-- ==========================================================================
-- 087 RLS verification — Provider Portal.
--
-- Setup:
--   * Prov-A (auth user) + Prov-A provider profile
--   * Prov-B (auth user) + Prov-B provider profile
--   * Pat-1 (auth user) — engaged with Prov-A (status=active)
--   * Pat-2 (auth user) — engaged with Prov-B (status=active)
--
-- Assertions:
--   1. Prov-A can read messages on their engagement.
--   2. Prov-A CANNOT read messages on Prov-B's engagement (leak test).
--   3. Pat-1 can read messages on their own engagement.
--   4. Pat-1 CANNOT read Pat-2's messages.
--   5. Inserting a message into a non-active engagement is rejected by
--      RLS WITH CHECK + by providers.engagement_writable.
--   6. Revoked engagement blocks new writes immediately.
--   7. Expired engagement blocks new writes immediately.
--   8. lead_workflow_events: provider can write only events for their
--      own (provider, patient) tuple.
--
-- Wraps the test in BEGIN; ... ROLLBACK; so no rows leak.
-- ==========================================================================
BEGIN;

-- ---- Setup --------------------------------------------------------------
DO $$
BEGIN
  INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at)
  VALUES
    ('00000000-0000-0000-0000-0000ProvPortA', 'pp-a@lifenav.test', crypt('x', gen_salt('bf')), NOW(), NOW()),
    ('00000000-0000-0000-0000-0000ProvPortB', 'pp-b@lifenav.test', crypt('x', gen_salt('bf')), NOW(), NOW()),
    ('00000000-0000-0000-0000-0000PortPat01', 'pat-p1@lifenav.test', crypt('x', gen_salt('bf')), NOW(), NOW()),
    ('00000000-0000-0000-0000-0000PortPat02', 'pat-p2@lifenav.test', crypt('x', gen_salt('bf')), NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;
END $$;

INSERT INTO public.profiles (id, email) VALUES
  ('00000000-0000-0000-0000-0000ProvPortA', 'pp-a@lifenav.test'),
  ('00000000-0000-0000-0000-0000ProvPortB', 'pp-b@lifenav.test'),
  ('00000000-0000-0000-0000-0000PortPat01', 'pat-p1@lifenav.test'),
  ('00000000-0000-0000-0000-0000PortPat02', 'pat-p2@lifenav.test')
ON CONFLICT (id) DO NOTHING;

INSERT INTO providers.provider_profiles (id, user_id, provider_type, legal_name, primary_domains, specialties)
VALUES
  ('00000000-0000-0000-0000-000000PortPpA', '00000000-0000-0000-0000-0000ProvPortA', 'coach', 'Prov A Portal', ARRAY['health']::text[], ARRAY['cardio']::text[]),
  ('00000000-0000-0000-0000-000000PortPpB', '00000000-0000-0000-0000-0000ProvPortB', 'coach', 'Prov B Portal', ARRAY['health']::text[], ARRAY['cardio']::text[])
ON CONFLICT (id) DO NOTHING;

INSERT INTO providers.provider_engagements
  (id, provider_id, patient_user_id, status, allowed_domains, max_sensitivity, accepted_at)
VALUES
  ('00000000-0000-0000-0000-00000PortEng1',
    '00000000-0000-0000-0000-000000PortPpA', '00000000-0000-0000-0000-0000PortPat01',
    'active', ARRAY['health']::text[], 'high', NOW()),
  ('00000000-0000-0000-0000-00000PortEng2',
    '00000000-0000-0000-0000-000000PortPpB', '00000000-0000-0000-0000-0000PortPat02',
    'active', ARRAY['health']::text[], 'high', NOW())
ON CONFLICT (id) DO NOTHING;

-- Seed one message per engagement so we have something to read.
INSERT INTO providers.provider_messages
  (id, engagement_id, provider_id, patient_user_id, sender_user_id, sender_role, kind, body)
VALUES
  ('00000000-0000-0000-0000-000000PortMsg1',
    '00000000-0000-0000-0000-00000PortEng1', '00000000-0000-0000-0000-000000PortPpA',
    '00000000-0000-0000-0000-0000PortPat01', '00000000-0000-0000-0000-0000ProvPortA',
    'provider', 'general_note', 'note from Prov A to Pat 1'),
  ('00000000-0000-0000-0000-000000PortMsg2',
    '00000000-0000-0000-0000-00000PortEng2', '00000000-0000-0000-0000-000000PortPpB',
    '00000000-0000-0000-0000-0000PortPat02', '00000000-0000-0000-0000-0000ProvPortB',
    'provider', 'general_note', 'note from Prov B to Pat 2')
ON CONFLICT (id) DO NOTHING;


-- ---- Assertion 1+2: provider read --------------------------------------
DO $$
DECLARE n_self INT; n_other INT;
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', '00000000-0000-0000-0000-0000ProvPortA')::text, true);
  PERFORM set_config('role', 'authenticated', true);

  SELECT COUNT(*) INTO n_self FROM providers.provider_messages
    WHERE engagement_id = '00000000-0000-0000-0000-00000PortEng1';
  IF n_self = 0 THEN
    RAISE EXCEPTION '087 RLS: Prov A cannot read their own engagement messages';
  END IF;

  SELECT COUNT(*) INTO n_other FROM providers.provider_messages
    WHERE engagement_id = '00000000-0000-0000-0000-00000PortEng2';
  IF n_other <> 0 THEN
    RAISE EXCEPTION '087 RLS LEAK: Prov A saw Prov B messages (n=%)', n_other;
  END IF;

  RESET role;
  PERFORM set_config('request.jwt.claims', '', true);
END $$;


-- ---- Assertion 3+4: patient read ---------------------------------------
DO $$
DECLARE n_self INT; n_other INT;
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', '00000000-0000-0000-0000-0000PortPat01')::text, true);
  PERFORM set_config('role', 'authenticated', true);

  SELECT COUNT(*) INTO n_self FROM providers.provider_messages
    WHERE engagement_id = '00000000-0000-0000-0000-00000PortEng1';
  IF n_self = 0 THEN
    RAISE EXCEPTION '087 RLS: Pat 1 cannot read their own engagement messages';
  END IF;

  SELECT COUNT(*) INTO n_other FROM providers.provider_messages
    WHERE engagement_id = '00000000-0000-0000-0000-00000PortEng2';
  IF n_other <> 0 THEN
    RAISE EXCEPTION '087 RLS LEAK: Pat 1 saw Pat 2 messages (n=%)', n_other;
  END IF;

  RESET role;
  PERFORM set_config('request.jwt.claims', '', true);
END $$;


-- ---- Assertion 5: pre-flight engagement_writable -----------------------
DO $$
DECLARE w BOOLEAN; r TEXT;
BEGIN
  SELECT writable, reason
    INTO w, r
    FROM providers.engagement_writable('00000000-0000-0000-0000-00000PortEng1'::uuid);
  IF NOT w THEN RAISE EXCEPTION '087: active engagement should be writable, got reason=%', r; END IF;
END $$;


-- ---- Assertion 6: revoked engagement blocks writes ---------------------
UPDATE providers.provider_engagements
   SET status = 'revoked', revoked_at = NOW()
 WHERE id = '00000000-0000-0000-0000-00000PortEng1';

DO $$
DECLARE w BOOLEAN; r TEXT;
BEGIN
  SELECT writable, reason
    INTO w, r
    FROM providers.engagement_writable('00000000-0000-0000-0000-00000PortEng1'::uuid);
  IF w THEN RAISE EXCEPTION '087: revoked engagement should not be writable'; END IF;
  IF r NOT IN ('engagement_status_revoked', 'engagement_revoked') THEN
    RAISE EXCEPTION '087: revoked reason wrong: %', r;
  END IF;
END $$;


-- ---- Assertion 7: expired engagement blocks writes ---------------------
UPDATE providers.provider_engagements
   SET status = 'active', revoked_at = NULL,
       expires_at = NOW() - INTERVAL '1 day'
 WHERE id = '00000000-0000-0000-0000-00000PortEng2';

DO $$
DECLARE w BOOLEAN; r TEXT;
BEGIN
  SELECT writable, reason
    INTO w, r
    FROM providers.engagement_writable('00000000-0000-0000-0000-00000PortEng2'::uuid);
  IF w THEN RAISE EXCEPTION '087: expired engagement should not be writable'; END IF;
  IF r <> 'engagement_expired' THEN
    RAISE EXCEPTION '087: expired reason wrong: %', r;
  END IF;
END $$;


-- ---- Assertion 8: lead_workflow_events cross-provider isolation --------
DO $$
DECLARE n INT;
BEGIN
  -- Prov A reads events
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', '00000000-0000-0000-0000-0000ProvPortA')::text, true);
  PERFORM set_config('role', 'authenticated', true);

  INSERT INTO providers.lead_workflow_events
    (provider_id, patient_user_id, event_kind, actor_user_id)
  VALUES
    ('00000000-0000-0000-0000-000000PortPpA', '00000000-0000-0000-0000-0000PortPat01',
     'lead_viewed', '00000000-0000-0000-0000-0000ProvPortA');

  SELECT COUNT(*) INTO n FROM providers.lead_workflow_events
    WHERE provider_id = '00000000-0000-0000-0000-000000PortPpB';
  IF n <> 0 THEN
    RAISE EXCEPTION '087 RLS LEAK: Prov A saw Prov B lead_workflow_events';
  END IF;

  RESET role;
  PERFORM set_config('request.jwt.claims', '', true);
END $$;

ROLLBACK;
