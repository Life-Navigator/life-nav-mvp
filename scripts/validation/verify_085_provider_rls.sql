-- ==========================================================================
-- 085 RLS verification — the critical Provider GraphRAG access tests.
--
-- Setup:
--   * Two providers (Prov-A and Prov-B), both verified
--   * Two patients (Pat-1 and Pat-2)
--   * Prov-A has an active engagement with Pat-1 (health scope)
--   * Prov-B has an active engagement with Pat-2 (health scope)
--
-- Critical assertions:
--   1. Prov-A can see Pat-1's data (engaged)
--   2. Prov-A CANNOT see Pat-2's data (NO engagement)
--   3. Prov-B can see Pat-2's data (engaged)
--   4. Prov-B CANNOT see Pat-1's data (NO engagement) — THE LEAK TEST
--   5. providers.has_access_to() returns the correct boolean for every
--      (provider, patient, domain) tuple
--   6. Revoking the engagement immediately blocks subsequent access
--   7. Scope-out-of-domain is blocked
--   8. Sensitivity-above-max is blocked
--
-- Usage:
--   psql "$DATABASE_URL" -f scripts/validation/verify_085_provider_rls.sql
-- ==========================================================================
BEGIN;

DO $$
BEGIN
  INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at)
  VALUES
    -- Providers
    ('00000000-0000-0000-0000-0000000aProvA', 'prov-a@lifenav.test', crypt('x', gen_salt('bf')), NOW(), NOW()),
    ('00000000-0000-0000-0000-0000000bProvB', 'prov-b@lifenav.test', crypt('x', gen_salt('bf')), NOW(), NOW()),
    -- Patients
    ('00000000-0000-0000-0000-0000000Pat0001', 'pat-1@lifenav.test', crypt('x', gen_salt('bf')), NOW(), NOW()),
    ('00000000-0000-0000-0000-0000000Pat0002', 'pat-2@lifenav.test', crypt('x', gen_salt('bf')), NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;
END $$;

INSERT INTO public.profiles (id, email) VALUES
  ('00000000-0000-0000-0000-0000000aProvA',  'prov-a@lifenav.test'),
  ('00000000-0000-0000-0000-0000000bProvB',  'prov-b@lifenav.test'),
  ('00000000-0000-0000-0000-0000000Pat0001', 'pat-1@lifenav.test'),
  ('00000000-0000-0000-0000-0000000Pat0002', 'pat-2@lifenav.test')
ON CONFLICT (id) DO NOTHING;

-- Provider profiles (verified).
INSERT INTO providers.provider_profiles
  (id, user_id, provider_type, legal_name, primary_domains, verified, verified_at) VALUES
  ('00000000-0000-0000-0000-000000ProvAprof',
   '00000000-0000-0000-0000-0000000aProvA',
   'physician', 'Prov A', ARRAY['health'], TRUE, NOW()),
  ('00000000-0000-0000-0000-000000ProvBprof',
   '00000000-0000-0000-0000-0000000bProvB',
   'coach', 'Prov B', ARRAY['health'], TRUE, NOW())
ON CONFLICT (id) DO NOTHING;

-- Engagements: A↔Pat1, B↔Pat2 (each scoped to health, accepted, active).
INSERT INTO providers.provider_engagements
  (id, provider_id, patient_user_id, status, allowed_domains, max_sensitivity, accepted_at) VALUES
  ('00000000-0000-0000-0000-00000EngageA01',
   '00000000-0000-0000-0000-000000ProvAprof',
   '00000000-0000-0000-0000-0000000Pat0001',
   'active', ARRAY['health'], 'medium', NOW()),
  ('00000000-0000-0000-0000-00000EngageB02',
   '00000000-0000-0000-0000-000000ProvBprof',
   '00000000-0000-0000-0000-0000000Pat0002',
   'active', ARRAY['health'], 'medium', NOW())
ON CONFLICT (id) DO NOTHING;

-- Patient goals (so the get_patient_summary RPC has something to return).
INSERT INTO public.goals
  (id, user_id, title, domain, category, priority) VALUES
  ('00000000-0000-0000-0000-00000GoalPat01', '00000000-0000-0000-0000-0000000Pat0001',
   'Improve VO2max', 'health', 'health', 'essential'),
  ('00000000-0000-0000-0000-00000GoalPat02', '00000000-0000-0000-0000-0000000Pat0002',
   'Improve VO2max', 'health', 'health', 'essential')
ON CONFLICT (id) DO NOTHING;

CREATE TEMP TABLE _rls_results (
  name TEXT, expected BOOLEAN, observed BOOLEAN, passed BOOLEAN
) ON COMMIT DROP;

-- ----------------------------------------------------------------------
-- has_access_to MATRIX
-- ----------------------------------------------------------------------
DO $$
DECLARE v BOOLEAN;
BEGIN
  -- 1. Prov-A → Pat-1 (engaged): TRUE
  v := providers.has_access_to('00000000-0000-0000-0000-0000000aProvA',
                                '00000000-0000-0000-0000-0000000Pat0001',
                                'health', 'low');
  INSERT INTO _rls_results VALUES ('matrix: A→Pat1 = TRUE', TRUE, v, v = TRUE);

  -- 2. Prov-A → Pat-2 (NOT engaged): FALSE   <<< THE LEAK CHECK
  v := providers.has_access_to('00000000-0000-0000-0000-0000000aProvA',
                                '00000000-0000-0000-0000-0000000Pat0002',
                                'health', 'low');
  INSERT INTO _rls_results VALUES ('matrix: A→Pat2 = FALSE (cross-patient leak blocked)', FALSE, v, v = FALSE);

  -- 3. Prov-B → Pat-2 (engaged): TRUE
  v := providers.has_access_to('00000000-0000-0000-0000-0000000bProvB',
                                '00000000-0000-0000-0000-0000000Pat0002',
                                'health', 'low');
  INSERT INTO _rls_results VALUES ('matrix: B→Pat2 = TRUE', TRUE, v, v = TRUE);

  -- 4. Prov-B → Pat-1 (NOT engaged): FALSE   <<< THE LEAK CHECK
  v := providers.has_access_to('00000000-0000-0000-0000-0000000bProvB',
                                '00000000-0000-0000-0000-0000000Pat0001',
                                'health', 'low');
  INSERT INTO _rls_results VALUES ('matrix: B→Pat1 = FALSE (cross-patient leak blocked)', FALSE, v, v = FALSE);

  -- 5. Prov-A → Pat-1 with out-of-scope domain (financial): FALSE
  v := providers.has_access_to('00000000-0000-0000-0000-0000000aProvA',
                                '00000000-0000-0000-0000-0000000Pat0001',
                                'financial', 'low');
  INSERT INTO _rls_results VALUES ('matrix: A→Pat1 financial = FALSE (out of scope)', FALSE, v, v = FALSE);

  -- 6. Prov-A → Pat-1 with sensitivity > max: FALSE
  v := providers.has_access_to('00000000-0000-0000-0000-0000000aProvA',
                                '00000000-0000-0000-0000-0000000Pat0001',
                                'health', 'high');
  INSERT INTO _rls_results VALUES ('matrix: A→Pat1 high-sensitivity = FALSE (exceeds max)', FALSE, v, v = FALSE);
END $$;

-- ----------------------------------------------------------------------
-- get_patient_summary returns rows for engaged patient, NOTHING for the other
-- ----------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000aProvA","role":"authenticated"}';

DO $$
DECLARE c1 INT; c2 INT;
BEGIN
  SELECT COUNT(*) INTO c1 FROM providers.get_patient_summary(
    '00000000-0000-0000-0000-0000000Pat0001', 'health');
  INSERT INTO _rls_results VALUES ('A reads Pat1 via RPC: rows > 0', TRUE, c1 > 0, c1 > 0);

  SELECT COUNT(*) INTO c2 FROM providers.get_patient_summary(
    '00000000-0000-0000-0000-0000000Pat0002', 'health');
  INSERT INTO _rls_results VALUES ('A reads Pat2 via RPC: rows = 0 (LEAK BLOCKED)', FALSE, c2 > 0, c2 = 0);
END $$;

RESET ROLE;

-- ----------------------------------------------------------------------
-- Revocation immediately blocks access
-- ----------------------------------------------------------------------
UPDATE providers.provider_engagements
   SET status = 'revoked', revoked_at = NOW()
 WHERE id = '00000000-0000-0000-0000-00000EngageA01';

DO $$
DECLARE v BOOLEAN;
BEGIN
  v := providers.has_access_to('00000000-0000-0000-0000-0000000aProvA',
                                '00000000-0000-0000-0000-0000000Pat0001',
                                'health', 'low');
  INSERT INTO _rls_results VALUES ('after revoke: A→Pat1 = FALSE', FALSE, v, v = FALSE);
END $$;

-- Restore for cleanup symmetry (we're rolling back anyway).
UPDATE providers.provider_engagements
   SET status = 'active', revoked_at = NULL
 WHERE id = '00000000-0000-0000-0000-00000EngageA01';

-- ----------------------------------------------------------------------
-- Report
-- ----------------------------------------------------------------------
SELECT name, expected, observed, passed
  FROM _rls_results
 ORDER BY name;

SELECT
  COUNT(*)                              AS total,
  COUNT(*) FILTER (WHERE passed)        AS pass,
  COUNT(*) FILTER (WHERE NOT passed)    AS fail,
  CASE WHEN COUNT(*) FILTER (WHERE NOT passed) = 0
       THEN 'ALL PASS' ELSE 'FAIL' END  AS summary
  FROM _rls_results;

ROLLBACK;
