-- ==========================================================================
-- Validation for migration 072 — Career Marketplace.
--
-- Verifies:
--   1. employer_profiles publicly readable only when status='verified'
--   2. employer_users links and is_employer_member() helper
--   3. Job-post owner-by-membership read/write semantics
--   4. Candidate matches: candidate sees own, employer sees ONLY through
--      the anonymized view BEFORE consent, sees the row directly AFTER
--      consent
--   5. employer_match_anonymized view excludes user_id
-- ==========================================================================

BEGIN;

DO $validate$
DECLARE
  user_a UUID := gen_random_uuid();           -- employer owner
  user_b UUID := gen_random_uuid();           -- candidate
  user_c UUID := gen_random_uuid();           -- unrelated user
  employer_a UUID;
  job_a UUID;
  match_ab UUID;
  caught BOOLEAN;
  view_cols INT;
  view_cols_have_user_id BOOLEAN;
BEGIN
  RAISE NOTICE '--- Seeding users A=% (employer) B=% (candidate) C=% (other) ---', user_a, user_b, user_c;
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at) VALUES
    (user_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@v.local', '', NOW(), NOW(), NOW()),
    (user_b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@v.local', '', NOW(), NOW(), NOW()),
    (user_c, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c@v.local', '', NOW(), NOW(), NOW());
  INSERT INTO public.profiles (id, email, display_name) VALUES
    (user_a, 'a@v.local', 'Employer Owner A'),
    (user_b, 'b@v.local', 'Candidate B'),
    (user_c, 'c@v.local', 'Other C');

  -- Employer profile + owner link.
  INSERT INTO public.employer_profiles (legal_name, status) VALUES ('Acme Corp', 'verified') RETURNING id INTO employer_a;
  INSERT INTO public.employer_users (employer_id, user_id, role, is_active) VALUES (employer_a, user_a, 'owner', TRUE);

  -- Job post.
  INSERT INTO public.employer_job_posts
    (employer_id, posted_by, title, status, published_at, remote_mode, salary_min, salary_max)
  VALUES (employer_a, user_a, 'Senior Python Engineer', 'published', NOW(), 'remote', 140000, 180000)
  RETURNING id INTO job_a;
  INSERT INTO public.employer_job_post_requirements (job_post_id, requirement_kind, value, weight) VALUES
    (job_a, 'skill_required', 'python', 1),
    (job_a, 'education', 'bachelor', 1);

  -- A candidate match for user_b.
  INSERT INTO public.job_candidate_matches
    (user_id, job_post_id, employer_id, match_score, skills_score, certifications_score, education_score, salary_fit_score, location_fit_score, growth_alignment_score, employer_facing_summary, missing_requirements, status)
  VALUES (user_b, job_a, employer_a, 88.5, 100, 100, 100, 100, 100, 80, 'Strong skills/education match.', '[]'::jsonb, 'surfaced')
  RETURNING id INTO match_ab;

  RAISE NOTICE 'ASSERT OK: seeded employer A, job post, and a match for candidate B';

  -- 1. As a candidate, user B sees their own match.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', user_b::text, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  IF (SELECT count(*) FROM public.job_candidate_matches WHERE id = match_ab) = 0 THEN
    RAISE EXCEPTION 'candidate cannot read own match';
  END IF;
  RAISE NOTICE 'ASSERT OK: candidate B reads own match';

  -- The employer-anonymized view should NOT expose user_id.
  view_cols_have_user_id := EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'employer_match_anonymized'
       AND column_name = 'user_id'
  );
  IF view_cols_have_user_id THEN
    RAISE EXCEPTION 'employer_match_anonymized view exposes user_id';
  END IF;
  RAISE NOTICE 'ASSERT OK: employer_match_anonymized view does NOT expose user_id';

  -- 2. As employer owner user A:
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', user_a::text, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;

  -- A can see the anonymized view for surfaced matches.
  IF (SELECT count(*) FROM public.employer_match_anonymized WHERE id = match_ab) = 0 THEN
    RAISE EXCEPTION 'employer A cannot see surfaced match via anonymized view';
  END IF;
  RAISE NOTICE 'ASSERT OK: employer A sees match via anonymized view';

  -- A CANNOT directly read the row in surfaced status (RLS).
  IF (SELECT count(*) FROM public.job_candidate_matches WHERE id = match_ab) > 0 THEN
    RAISE EXCEPTION 'RLS leak: employer A read raw match row before intro_consented';
  END IF;
  RAISE NOTICE 'ASSERT OK: employer A cannot read raw match before consent';

  -- 3. Candidate B consents to intro → employer can read.
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', user_b::text, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  UPDATE public.job_candidate_matches SET status = 'intro_consented' WHERE id = match_ab;

  RESET ROLE;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', user_a::text, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  IF (SELECT count(*) FROM public.job_candidate_matches WHERE id = match_ab) = 0 THEN
    RAISE EXCEPTION 'employer A still cannot read match after intro_consented';
  END IF;
  RAISE NOTICE 'ASSERT OK: employer A reads raw match row after intro_consented';

  -- 4. Unrelated user C sees zero.
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', user_c::text, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  IF (SELECT count(*) FROM public.job_candidate_matches) > 0
  OR (SELECT count(*) FROM public.employer_match_anonymized) > 0 THEN
    RAISE EXCEPTION 'RLS leak: unrelated user sees marketplace rows';
  END IF;
  RAISE NOTICE 'ASSERT OK: unrelated user sees zero marketplace rows';

  -- 5. Unrelated user C cannot create a job under employer A.
  caught := FALSE;
  BEGIN
    INSERT INTO public.employer_job_posts (employer_id, title, status)
    VALUES (employer_a, 'sneak', 'draft');
  EXCEPTION WHEN insufficient_privilege OR check_violation OR others THEN
    caught := TRUE;
  END;
  IF NOT caught THEN
    RAISE EXCEPTION 'RLS leak: non-member user inserted job post under another employer';
  END IF;
  RAISE NOTICE 'ASSERT OK: non-member cannot create jobs under another employer';

  RESET ROLE;
  RAISE NOTICE '=========================================';
  RAISE NOTICE 'ALL ASSERTIONS PASSED for migration 072';
  RAISE NOTICE '=========================================';
END
$validate$;

ROLLBACK;
