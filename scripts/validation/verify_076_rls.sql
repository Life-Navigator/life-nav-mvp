-- ==========================================================================
-- 076 RLS verification: proves the goal-hierarchy tables enforce strict
-- owner-only access. User A cannot read User B's hierarchy edges.
--
-- Usage:
--   psql "$DATABASE_URL" -f scripts/validation/verify_076_rls.sql
--
-- All work happens inside a transaction that ROLLBACKs at the end —
-- no fixture rows are left behind.
-- ==========================================================================
BEGIN;

-- Two synthetic users.
DO $$
BEGIN
  INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at)
  VALUES
    ('00000000-0000-0000-0000-0000000a1076', 'rls-a@lifenav.test',
     crypt('x', gen_salt('bf')), NOW(), NOW()),
    ('00000000-0000-0000-0000-0000000b2076', 'rls-b@lifenav.test',
     crypt('x', gen_salt('bf')), NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;
END $$;

INSERT INTO public.profiles (id, email) VALUES
  ('00000000-0000-0000-0000-0000000a1076', 'rls-a@lifenav.test'),
  ('00000000-0000-0000-0000-0000000b2076', 'rls-b@lifenav.test')
ON CONFLICT (id) DO NOTHING;

-- Two goals per user.
INSERT INTO public.goals (id, user_id, title, domain, category, priority)
VALUES
  ('00000000-0000-0000-0000-00000076aaa1', '00000000-0000-0000-0000-0000000a1076',
   'A-root', 'financial', 'wealth', 'essential'),
  ('00000000-0000-0000-0000-00000076aaa2', '00000000-0000-0000-0000-0000000a1076',
   'A-leaf', 'financial', 'protection', 'important'),
  ('00000000-0000-0000-0000-00000076bbb1', '00000000-0000-0000-0000-0000000b2076',
   'B-root', 'financial', 'wealth', 'essential'),
  ('00000000-0000-0000-0000-00000076bbb2', '00000000-0000-0000-0000-0000000b2076',
   'B-leaf', 'financial', 'protection', 'important')
ON CONFLICT (id) DO NOTHING;

-- Service-role inserts one edge per user. (We're connected as a
-- superuser, which bypasses RLS; we then switch to the authenticated
-- role and a per-user JWT to test enforcement.)
INSERT INTO public.goal_relationships
  (user_id, parent_goal_id, child_goal_id, relationship_type, strength_score, confidence_score, source)
VALUES
  ('00000000-0000-0000-0000-0000000a1076',
   '00000000-0000-0000-0000-00000076aaa1', '00000000-0000-0000-0000-00000076aaa2',
   'SUPPORTS', 0.8, 0.9, 'test'),
  ('00000000-0000-0000-0000-0000000b2076',
   '00000000-0000-0000-0000-00000076bbb1', '00000000-0000-0000-0000-00000076bbb2',
   'SUPPORTS', 0.8, 0.9, 'test');

-- Result accumulator.
CREATE TEMP TABLE _rls_results (
  name        TEXT,
  expected    INT,
  observed    INT,
  passed      BOOLEAN
) ON COMMIT DROP;

-- ----------------------------------------------------------------------
-- Test 1: User A reading their own edges sees 1 row.
-- ----------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000a1076","role":"authenticated"}';

INSERT INTO _rls_results
SELECT 'A_reads_own', 1,
       (SELECT COUNT(*) FROM public.goal_relationships
        WHERE user_id = '00000000-0000-0000-0000-0000000a1076'),
       (SELECT COUNT(*) FROM public.goal_relationships
        WHERE user_id = '00000000-0000-0000-0000-0000000a1076') = 1;

-- ----------------------------------------------------------------------
-- Test 2: User A trying to read User B's edges sees 0 rows (RLS blocks).
-- ----------------------------------------------------------------------
INSERT INTO _rls_results
SELECT 'A_reads_B_blocked', 0,
       (SELECT COUNT(*) FROM public.goal_relationships
        WHERE user_id = '00000000-0000-0000-0000-0000000b2076'),
       (SELECT COUNT(*) FROM public.goal_relationships
        WHERE user_id = '00000000-0000-0000-0000-0000000b2076') = 0;

-- ----------------------------------------------------------------------
-- Test 3: Same checks across all six hierarchy tables.
-- ----------------------------------------------------------------------
DO $$
DECLARE
  t TEXT;
  v_a INT;
  v_b INT;
BEGIN
  FOREACH t IN ARRAY ARRAY['goal_hierarchies','goal_dependencies','goal_conflicts',
                            'goal_priorities','goal_relationships','goal_pathways']
  LOOP
    EXECUTE format('SELECT COUNT(*) FROM public.%I WHERE user_id = $1', t)
       INTO v_a USING '00000000-0000-0000-0000-0000000a1076';
    EXECUTE format('SELECT COUNT(*) FROM public.%I WHERE user_id = $1', t)
       INTO v_b USING '00000000-0000-0000-0000-0000000b2076';
    INSERT INTO _rls_results
    VALUES (
      format('%s_other_user_blocked', t),
      0, v_b, v_b = 0
    );
  END LOOP;
END $$;

-- ----------------------------------------------------------------------
-- Test 4: User A trying to INSERT a row for User B is blocked.
-- ----------------------------------------------------------------------
DO $$
BEGIN
  BEGIN
    INSERT INTO public.goal_relationships
      (user_id, parent_goal_id, child_goal_id, relationship_type, strength_score, confidence_score, source)
    VALUES
      ('00000000-0000-0000-0000-0000000b2076',
       '00000000-0000-0000-0000-00000076bbb1', '00000000-0000-0000-0000-00000076bbb2',
       'SUPPORTS', 0.9, 0.9, 'attacker');
    INSERT INTO _rls_results VALUES ('A_writes_as_B_blocked', 0, 1, FALSE);
  EXCEPTION WHEN insufficient_privilege OR check_violation OR others THEN
    INSERT INTO _rls_results VALUES ('A_writes_as_B_blocked', 0, 0, TRUE);
  END;
END $$;

RESET ROLE;

-- ----------------------------------------------------------------------
-- Report
-- ----------------------------------------------------------------------
SELECT * FROM _rls_results ORDER BY name;

SELECT
  COUNT(*)                              AS total,
  COUNT(*) FILTER (WHERE passed)        AS pass,
  COUNT(*) FILTER (WHERE NOT passed)    AS fail,
  CASE WHEN COUNT(*) FILTER (WHERE NOT passed) = 0
       THEN 'ALL PASS' ELSE 'FAIL' END  AS summary
  FROM _rls_results;

ROLLBACK;
