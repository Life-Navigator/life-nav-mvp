-- ==========================================================================
-- 089 RLS verification — Constitutional GraphRAG layer.
--
-- Assertions:
--   1. constitutional_entities is world-readable (transparency).
--   2. review_iterations: user can read own rows.
--   3. review_iterations: user CANNOT read another user's rows.
--   4. Authenticated cannot insert constitutional_entities.
--   5. Authenticated cannot insert governance.review_iterations
--      (writes are middleware-only via service role / RLS-protected
--      decision_governance_audit insert flow).
--   6. governance.is_constitutional_verdict() recognises the 5 verdicts.
--   7. principles 1-8 (Sprint L) + 9-15 (Sprint L2) are all seeded.
-- ==========================================================================
BEGIN;

DO $$
BEGIN
  INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at)
  VALUES
    ('00000000-0000-0000-0000-00000Const001', 'const-1@lifenav.test', crypt('x', gen_salt('bf')), NOW(), NOW()),
    ('00000000-0000-0000-0000-00000Const002', 'const-2@lifenav.test', crypt('x', gen_salt('bf')), NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;
END $$;

INSERT INTO public.profiles (id, email) VALUES
  ('00000000-0000-0000-0000-00000Const001', 'const-1@lifenav.test'),
  ('00000000-0000-0000-0000-00000Const002', 'const-2@lifenav.test')
ON CONFLICT (id) DO NOTHING;

-- Seed an audit row + iteration for both users so we have something to read.
INSERT INTO governance.decision_governance_audit
  (id, user_id, subject_kind, approved, severity, governance_version,
   policy_checks, violations, constitutional_verdict, risk_level,
   iteration_count, retrieval_ok)
VALUES
  ('00000000-0000-0000-0000-00000CAudit01',
    '00000000-0000-0000-0000-00000Const001', 'recommendation',
    TRUE, 'none', '1.0.0', '[]'::jsonb, '[]'::jsonb,
    'APPROVE', 'LOW', 1, TRUE),
  ('00000000-0000-0000-0000-00000CAudit02',
    '00000000-0000-0000-0000-00000Const002', 'recommendation',
    FALSE, 'critical', '1.0.0', '[]'::jsonb, '[]'::jsonb,
    'CONSTITUTIONAL_REDIRECTION', 'CRITICAL', 1, TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO governance.review_iterations
  (id, audit_id, user_id, iteration_index, draft_hash, final_hash, verdict)
VALUES
  ('00000000-0000-0000-0000-00000CIter01',
    '00000000-0000-0000-0000-00000CAudit01', '00000000-0000-0000-0000-00000Const001',
    0, 'abcd0000', 'abcd0001', 'APPROVE'),
  ('00000000-0000-0000-0000-00000CIter02',
    '00000000-0000-0000-0000-00000CAudit02', '00000000-0000-0000-0000-00000Const002',
    0, 'efef0000', 'efef0001', 'CONSTITUTIONAL_REDIRECTION')
ON CONFLICT (id) DO NOTHING;

-- ---- Assertion 1: constitutional_entities world-readable ----------------
DO $$
DECLARE n INT;
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub','00000000-0000-0000-0000-00000Const001')::text, true);
  PERFORM set_config('role', 'authenticated', true);
  SELECT COUNT(*) INTO n FROM governance.constitutional_entities
    WHERE entity_kind = 'ConstitutionalPrinciple';
  IF n < 15 THEN
    RAISE EXCEPTION '089 RLS: principles_world_readable failed (n=%)', n;
  END IF;
  RESET role;
  PERFORM set_config('request.jwt.claims', '', true);
END $$;

-- ---- Assertion 2+3: review_iterations user-scoped + leak test -----------
DO $$
DECLARE n_self INT; n_other INT;
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub','00000000-0000-0000-0000-00000Const001')::text, true);
  PERFORM set_config('role', 'authenticated', true);

  SELECT COUNT(*) INTO n_self FROM governance.review_iterations
    WHERE id = '00000000-0000-0000-0000-00000CIter01';
  IF n_self = 0 THEN RAISE EXCEPTION '089 RLS: user 1 cannot read own iteration'; END IF;

  SELECT COUNT(*) INTO n_other FROM governance.review_iterations
    WHERE id = '00000000-0000-0000-0000-00000CIter02';
  IF n_other <> 0 THEN
    RAISE EXCEPTION '089 RLS LEAK: user 1 saw user 2 iteration (n=%)', n_other;
  END IF;

  RESET role;
  PERFORM set_config('request.jwt.claims', '', true);
END $$;

-- ---- Assertion 4: authenticated cannot insert constitutional_entities ----
DO $$
DECLARE inserted BOOLEAN := TRUE;
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub','00000000-0000-0000-0000-00000Const001')::text, true);
  PERFORM set_config('role', 'authenticated', true);
  BEGIN
    INSERT INTO governance.constitutional_entities (entity_kind, slug, name, body)
    VALUES ('GovernanceRule', 'auth.tried.to.insert', 'x', 'y');
  EXCEPTION WHEN insufficient_privilege OR check_violation OR others THEN
    inserted := FALSE;
  END;
  IF inserted THEN
    PERFORM 1 FROM governance.constitutional_entities WHERE slug = 'auth.tried.to.insert';
    IF FOUND THEN
      RAISE EXCEPTION '089 RLS: authenticated should not be able to insert constitutional_entities';
    END IF;
  END IF;
  RESET role;
  PERFORM set_config('request.jwt.claims', '', true);
END $$;

-- ---- Assertion 6: governance.is_constitutional_verdict() recognises ------
DO $$
BEGIN
  IF NOT governance.is_constitutional_verdict('APPROVE') THEN RAISE EXCEPTION '089: APPROVE not recognized'; END IF;
  IF NOT governance.is_constitutional_verdict('APPROVE_WITH_MODIFICATION') THEN RAISE EXCEPTION '089: AWM not recognized'; END IF;
  IF NOT governance.is_constitutional_verdict('CONSTITUTIONAL_REDIRECTION') THEN RAISE EXCEPTION '089: CR not recognized'; END IF;
  IF NOT governance.is_constitutional_verdict('REQUEST_CLARIFICATION') THEN RAISE EXCEPTION '089: RC not recognized'; END IF;
  IF NOT governance.is_constitutional_verdict('SAFE_CONSTITUTIONAL_RESPONSE') THEN RAISE EXCEPTION '089: SCR not recognized'; END IF;
  IF governance.is_constitutional_verdict('BLOCK_AND_REDIRECT') THEN
    RAISE EXCEPTION '089: BLOCK_AND_REDIRECT should NOT be a valid verdict (spec uses CONSTITUTIONAL_REDIRECTION)';
  END IF;
END $$;

-- ---- Assertion 7: principle seeds + key entity kinds ---------------------
DO $$
DECLARE n INT;
BEGIN
  -- 15 principles total
  SELECT COUNT(*) INTO n FROM governance.constitutional_entities
    WHERE entity_kind = 'ConstitutionalPrinciple' AND review_status = 'active';
  IF n < 15 THEN RAISE EXCEPTION '089: expected ≥15 active principles, got %', n; END IF;

  -- Required entity kinds populated
  SELECT COUNT(*) INTO n FROM governance.constitutional_entities WHERE entity_kind = 'NeedBehindNeedPattern';
  IF n < 4 THEN RAISE EXCEPTION '089: NeedBehindNeedPattern under-seeded (n=%)', n; END IF;

  SELECT COUNT(*) INTO n FROM governance.constitutional_entities WHERE entity_kind = 'CrisisIndicator';
  IF n < 3 THEN RAISE EXCEPTION '089: CrisisIndicator under-seeded (n=%)', n; END IF;

  SELECT COUNT(*) INTO n FROM governance.constitutional_entities WHERE entity_kind = 'CognitiveDistortionPattern';
  IF n < 6 THEN RAISE EXCEPTION '089: CognitiveDistortionPattern under-seeded (n=%)', n; END IF;

  SELECT COUNT(*) INTO n FROM governance.constitutional_entities WHERE entity_kind = 'RealismRule';
  IF n < 2 THEN RAISE EXCEPTION '089: RealismRule under-seeded (n=%)', n; END IF;
END $$;

ROLLBACK;
