-- ============================================================================
-- First-5 Synthetic Beta Persona Verification — READ-ONLY
-- ============================================================================
-- Paste into the Supabase SQL editor (run section-by-section, or all at once —
-- each numbered section is a standalone SELECT that returns its own result grid).
--
-- SAFETY: This script is 100% READ-ONLY. It contains ONLY SELECTs. There are NO
--   DELETE / UPDATE / INSERT / TRUNCATE / ALTER statements and NOTHING that
--   mutates auth.users or any table. Duplicate CLEANUP is NOT performed here — if
--   duplicates are found, Section 14 prints a recommended plan only; a separate,
--   explicit cleanup script must be written and reviewed before any mutation.
--
-- WHY SQL: the GoTrue admin REST `?email=` filter is unreliable in this
--   environment (returns the first page for any email) and list pagination caps
--   at 50, so beta email→UID cannot be resolved app-side. The DB is the source of
--   truth; this resolves UIDs and dumps persisted persona facts directly.
--
-- NO SECRETS: contains no tokens, passwords, magic links, or service keys.
--
-- EXPECTED ACCOUNTS / PERSONAS (health gap on beta3 is intentional):
--   beta1@lifenav-beta.example.com  family_foundation
--   beta2@lifenav-beta.example.com  young_professional
--   beta3@lifenav-beta.example.com  pre_retirement      (EXPECTED: no health/body metrics)
--   beta4@lifenav-beta.example.com  new_parent
--   beta5@lifenav-beta.example.com  career_change
--   founder/admin: timothy@riffeandassociates.com
-- ============================================================================


-- ----------------------------------------------------------------------------
-- SECTION 0 — Table-presence matrix (to_regclass; never errors if a table is absent)
-- Use this to know which optional sections below are safe to run in this DB.
-- ----------------------------------------------------------------------------
SELECT t.tbl,
       CASE WHEN to_regclass(t.tbl) IS NULL THEN 'ABSENT' ELSE 'present' END AS status
FROM (VALUES
  ('auth.users'),
  ('public.profiles'),
  ('finance.financial_accounts'),
  ('finance.investment_holdings'),
  ('public.career_profiles'),
  ('career.experience_records'),
  ('education.education_profiles'),
  ('public.education_records'),
  ('family.family_profiles'),
  ('health.body_metrics'),
  ('life.candidate_goals')
) AS t(tbl)
ORDER BY t.tbl;


-- ----------------------------------------------------------------------------
-- SECTION 1 — Expected beta emails / personas (reference)
-- ----------------------------------------------------------------------------
SELECT email, persona, health_expected
FROM (VALUES
  ('beta1@lifenav-beta.example.com', 'family_foundation',  true),
  ('beta2@lifenav-beta.example.com', 'young_professional', true),
  ('beta3@lifenav-beta.example.com', 'pre_retirement',     false),  -- intentional: no health
  ('beta4@lifenav-beta.example.com', 'new_parent',         true),
  ('beta5@lifenav-beta.example.com', 'career_change',      true)
) AS e(email, persona, health_expected)
ORDER BY email;


-- ----------------------------------------------------------------------------
-- SECTION 2 — auth.users rows matching beta emails (the authoritative UID lookup)
-- ----------------------------------------------------------------------------
SELECT u.email,
       u.id,
       u.created_at,
       u.last_sign_in_at,
       u.raw_user_meta_data->>'is_synthetic' AS is_synthetic,
       u.raw_user_meta_data->>'persona'       AS persona,
       u.raw_user_meta_data->>'display_name'  AS display_name
FROM auth.users u
WHERE lower(u.email) LIKE 'beta_@lifenav-beta.example.com'
   OR lower(u.email) = 'timothy@riffeandassociates.com'
ORDER BY u.email, u.created_at;


-- ----------------------------------------------------------------------------
-- SECTION 3 — Duplicate auth users by email (expected count = 1 per beta email)
-- ----------------------------------------------------------------------------
SELECT lower(u.email) AS email,
       count(*)        AS auth_user_count,
       CASE WHEN count(*) > 1 THEN 'WARN: DUPLICATE' ELSE 'ok' END AS flag,
       array_agg(u.id ORDER BY u.created_at)         AS uids,
       array_agg(u.created_at ORDER BY u.created_at) AS created_ats
FROM auth.users u
WHERE lower(u.email) LIKE 'beta_@lifenav-beta.example.com'
GROUP BY lower(u.email)
ORDER BY email;


-- ----------------------------------------------------------------------------
-- SECTION 4 — Missing auth users (expected: none missing → 0 rows)
-- ----------------------------------------------------------------------------
SELECT e.email AS missing_email
FROM (VALUES
  ('beta1@lifenav-beta.example.com'),
  ('beta2@lifenav-beta.example.com'),
  ('beta3@lifenav-beta.example.com'),
  ('beta4@lifenav-beta.example.com'),
  ('beta5@lifenav-beta.example.com')
) AS e(email)
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users u WHERE lower(u.email) = e.email
);


-- ----------------------------------------------------------------------------
-- SECTION 5 — Suggested canonical UID per email
-- Rule (NO deletion): prefer the row with is_synthetic=true AND a persona, then
-- the most recent created_at. This only SUGGESTS; cleanup is a separate script.
-- ----------------------------------------------------------------------------
SELECT DISTINCT ON (lower(u.email))
       lower(u.email) AS email,
       u.id           AS suggested_canonical_uid,
       u.created_at,
       u.raw_user_meta_data->>'is_synthetic' AS is_synthetic,
       u.raw_user_meta_data->>'persona'       AS persona
FROM auth.users u
WHERE lower(u.email) LIKE 'beta_@lifenav-beta.example.com'
ORDER BY lower(u.email),
         (u.raw_user_meta_data->>'is_synthetic' = 'true') DESC,
         (u.raw_user_meta_data->>'persona' IS NOT NULL)   DESC,
         u.created_at DESC;


-- ----------------------------------------------------------------------------
-- SECTION 6 — public.profiles for each beta UID
-- ----------------------------------------------------------------------------
SELECT u.email,
       p.id,
       p.display_name,
       p.setup_completed,
       p.onboarding_completed,
       p.created_at,
       p.updated_at
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE lower(u.email) LIKE 'beta_@lifenav-beta.example.com'
ORDER BY u.email, p.created_at;


-- ----------------------------------------------------------------------------
-- SECTION 7 — Finance: finance.financial_accounts per beta UID
-- Liabilities are debt-type accounts (often stored negative) → abs-summed.
-- ----------------------------------------------------------------------------
SELECT u.email,
       count(a.*)                                                                   AS account_count,
       coalesce(sum(a.current_balance) FILTER (
         WHERE a.account_type NOT IN ('mortgage','loan','credit_card','student_loan','auto_loan')
       ), 0)                                                                        AS total_assets,
       coalesce(abs(sum(a.current_balance) FILTER (
         WHERE a.account_type IN ('mortgage','loan','credit_card','student_loan','auto_loan')
       )), 0)                                                                       AS total_liabilities,
       coalesce(sum(a.current_balance) FILTER (WHERE a.account_type IN ('checking','savings')), 0)   AS cash_total,
       coalesce(sum(a.current_balance) FILTER (WHERE a.account_type = 'investment'), 0)              AS investment_total,
       coalesce(sum(a.current_balance) FILTER (WHERE a.account_type = 'retirement'), 0)              AS retirement_total
FROM auth.users u
LEFT JOIN finance.financial_accounts a ON a.user_id = u.id
WHERE lower(u.email) LIKE 'beta_@lifenav-beta.example.com'
GROUP BY u.email
ORDER BY u.email;


-- ----------------------------------------------------------------------------
-- SECTION 8 — Career: public.career_profiles per beta UID (select * is column-robust)
-- ----------------------------------------------------------------------------
SELECT u.email, c.*
FROM auth.users u
LEFT JOIN public.career_profiles c ON c.user_id = u.id
WHERE lower(u.email) LIKE 'beta_@lifenav-beta.example.com'
ORDER BY u.email;

-- OPTIONAL (run only if Section 0 shows career.experience_records = present):
-- SELECT u.email, count(r.*) AS experience_record_count
-- FROM auth.users u
-- LEFT JOIN career.experience_records r ON r.user_id = u.id
-- WHERE lower(u.email) LIKE 'beta_@lifenav-beta.example.com'
-- GROUP BY u.email ORDER BY u.email;


-- ----------------------------------------------------------------------------
-- SECTION 9 — Education: education.education_profiles (credentials are JSON) per beta UID
-- ----------------------------------------------------------------------------
SELECT u.email,
       ep.*,
       CASE
         WHEN ep.existing_credentials IS NULL THEN 0
         WHEN jsonb_typeof(ep.existing_credentials::jsonb) = 'array'
              THEN jsonb_array_length(ep.existing_credentials::jsonb)
         ELSE NULL
       END AS credential_count
FROM auth.users u
LEFT JOIN education.education_profiles ep ON ep.user_id = u.id
WHERE lower(u.email) LIKE 'beta_@lifenav-beta.example.com'
ORDER BY u.email;

-- OPTIONAL (run only if Section 0 shows public.education_records = present):
-- SELECT u.email, count(er.*) AS education_record_count
-- FROM auth.users u
-- LEFT JOIN public.education_records er ON er.user_id = u.id
-- WHERE lower(u.email) LIKE 'beta_@lifenav-beta.example.com'
-- GROUP BY u.email ORDER BY u.email;


-- ----------------------------------------------------------------------------
-- SECTION 10 — Family: family.family_profiles per beta UID (metadata holds wedding/home/children)
-- ----------------------------------------------------------------------------
SELECT u.email,
       fp.*,
       fp.metadata->>'wedding_timeline' AS wedding_timeline,
       fp.metadata->>'home_goal'        AS home_goal,
       fp.metadata->>'children_goal'    AS children_goal
FROM auth.users u
LEFT JOIN family.family_profiles fp ON fp.user_id = u.id
WHERE lower(u.email) LIKE 'beta_@lifenav-beta.example.com'
ORDER BY u.email;


-- ----------------------------------------------------------------------------
-- SECTION 11 — Health: health.body_metrics per beta UID (select * is column-robust)
-- EXPECTED: beta3 (pre_retirement) has NO health rows by design.
-- ----------------------------------------------------------------------------
SELECT u.email, count(b.*) AS body_metric_count
FROM auth.users u
LEFT JOIN health.body_metrics b ON b.user_id = u.id
WHERE lower(u.email) LIKE 'beta_@lifenav-beta.example.com'
GROUP BY u.email
ORDER BY u.email;

-- Detail (most recent row per user; select * avoids unit-column name guesses):
-- SELECT u.email, b.*
-- FROM auth.users u
-- JOIN health.body_metrics b ON b.user_id = u.id
-- WHERE lower(u.email) LIKE 'beta_@lifenav-beta.example.com'
-- ORDER BY u.email, b.created_at DESC;


-- ----------------------------------------------------------------------------
-- SECTION 12 — Goals: life.candidate_goals per beta UID + raw-paragraph detection
-- Display-risk = goal_text length > 120 chars OR > 18 words (should not render as a goal title).
-- ----------------------------------------------------------------------------
SELECT u.email,
       g.domain,
       g.status,
       g.goal_text,
       length(g.goal_text)                                          AS char_len,
       array_length(regexp_split_to_array(btrim(g.goal_text), '\s+'), 1) AS word_count,
       CASE
         WHEN length(g.goal_text) > 120
           OR array_length(regexp_split_to_array(btrim(g.goal_text), '\s+'), 1) > 18
         THEN 'WARN: RAW_PARAGRAPH'
         ELSE 'ok'
       END AS display_risk
FROM auth.users u
JOIN life.candidate_goals g ON g.user_id = u.id
WHERE lower(u.email) LIKE 'beta_@lifenav-beta.example.com'
ORDER BY u.email, display_risk DESC, g.domain;


-- ----------------------------------------------------------------------------
-- SECTION 13 — Orphan / null-owner leakage check across persona tables
-- Any row with a NULL user_id (un-scoped data) is a leakage risk. Expected: 0 rows.
-- Optional-table lines are commented; uncomment only those Section 0 marks present.
-- ----------------------------------------------------------------------------
SELECT 'finance.financial_accounts' AS tbl, count(*) AS null_user_id_rows
  FROM finance.financial_accounts WHERE user_id IS NULL
UNION ALL SELECT 'public.career_profiles', count(*) FROM public.career_profiles WHERE user_id IS NULL
UNION ALL SELECT 'education.education_profiles', count(*) FROM education.education_profiles WHERE user_id IS NULL
UNION ALL SELECT 'family.family_profiles', count(*) FROM family.family_profiles WHERE user_id IS NULL
UNION ALL SELECT 'health.body_metrics', count(*) FROM health.body_metrics WHERE user_id IS NULL
UNION ALL SELECT 'life.candidate_goals', count(*) FROM life.candidate_goals WHERE user_id IS NULL
-- UNION ALL SELECT 'finance.investment_holdings', count(*) FROM finance.investment_holdings WHERE user_id IS NULL
-- UNION ALL SELECT 'career.experience_records', count(*) FROM career.experience_records WHERE user_id IS NULL
-- UNION ALL SELECT 'public.education_records', count(*) FROM public.education_records WHERE user_id IS NULL
ORDER BY tbl;


-- ----------------------------------------------------------------------------
-- SECTION 14 — SUMMARY PASS / FAIL / WARN / EXPECTED_GAP (one row per beta email)
-- Uses the suggested canonical UID per email; counts come from the core tables.
-- ----------------------------------------------------------------------------
WITH expected(email, persona, health_expected) AS (
  VALUES
    ('beta1@lifenav-beta.example.com', 'family_foundation',  true),
    ('beta2@lifenav-beta.example.com', 'young_professional', true),
    ('beta3@lifenav-beta.example.com', 'pre_retirement',     false),
    ('beta4@lifenav-beta.example.com', 'new_parent',         true),
    ('beta5@lifenav-beta.example.com', 'career_change',      true)
),
counts AS (
  SELECT lower(u.email) AS email, count(*) AS auth_user_count
  FROM auth.users u
  WHERE lower(u.email) LIKE 'beta_@lifenav-beta.example.com'
  GROUP BY lower(u.email)
),
canonical AS (
  SELECT DISTINCT ON (lower(u.email))
         lower(u.email) AS email,
         u.id           AS uid,
         u.raw_user_meta_data->>'is_synthetic' AS is_synthetic,
         u.raw_user_meta_data->>'persona'       AS persona
  FROM auth.users u
  WHERE lower(u.email) LIKE 'beta_@lifenav-beta.example.com'
  ORDER BY lower(u.email),
           (u.raw_user_meta_data->>'is_synthetic' = 'true') DESC,
           (u.raw_user_meta_data->>'persona' IS NOT NULL)   DESC,
           u.created_at DESC
)
SELECT
  e.email                                            AS beta_email,
  e.persona                                          AS expected_persona,
  coalesce(ct.auth_user_count, 0)                    AS auth_user_count,
  c.uid                                              AS suggested_canonical_uid,
  CASE WHEN c.is_synthetic = 'true' THEN 'PASS' ELSE 'FAIL' END AS synthetic_flag_ok,
  CASE WHEN c.persona = e.persona THEN 'PASS'
       WHEN c.persona IS NULL THEN 'WARN'
       ELSE 'FAIL' END                               AS persona_ok,
  CASE WHEN EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = c.uid) THEN 'PASS' ELSE 'FAIL' END AS profile_ok,
  CASE WHEN (SELECT count(*) FROM finance.financial_accounts a WHERE a.user_id = c.uid) > 0 THEN 'PASS' ELSE 'FAIL' END AS finance_ok,
  CASE WHEN EXISTS (SELECT 1 FROM public.career_profiles cp WHERE cp.user_id = c.uid) THEN 'PASS' ELSE 'FAIL' END AS career_ok,
  CASE WHEN EXISTS (SELECT 1 FROM education.education_profiles ep WHERE ep.user_id = c.uid) THEN 'PASS' ELSE 'WARN' END AS education_ok,
  CASE WHEN EXISTS (SELECT 1 FROM family.family_profiles fp WHERE fp.user_id = c.uid) THEN 'PASS' ELSE 'WARN' END AS family_ok,
  CASE
    WHEN (SELECT count(*) FROM health.body_metrics b WHERE b.user_id = c.uid) > 0 THEN 'PASS'
    WHEN e.health_expected = false THEN 'EXPECTED_GAP'
    ELSE 'FAIL'
  END                                                AS health_ok,
  CASE WHEN (SELECT count(*) FROM life.candidate_goals g WHERE g.user_id = c.uid) > 0 THEN 'PASS' ELSE 'FAIL' END AS goals_ok,
  CASE WHEN coalesce(ct.auth_user_count, 0) > 1 THEN 'WARN' ELSE 'ok' END AS duplicate_warning,
  CASE WHEN EXISTS (
    SELECT 1 FROM life.candidate_goals g
    WHERE g.user_id = c.uid
      AND (length(g.goal_text) > 120
           OR array_length(regexp_split_to_array(btrim(g.goal_text), '\s+'), 1) > 18)
  ) THEN 'WARN' ELSE 'ok' END                        AS raw_goal_warning,
  CASE WHEN coalesce(ct.auth_user_count, 0) = 0 THEN 'MISSING auth user'
       WHEN coalesce(ct.auth_user_count, 0) > 1 THEN 'Duplicates exist — see Section 5 for canonical UID; cleanup needs a separate reviewed script'
       ELSE '' END                                   AS notes
FROM expected e
LEFT JOIN counts    ct ON ct.email = e.email
LEFT JOIN canonical c  ON c.email  = e.email
ORDER BY e.email;


-- ----------------------------------------------------------------------------
-- SECTION 15 — Recommended cleanup PLAN (printed only — performs NO mutation)
-- If Section 3/14 flags duplicates, the SAFE cleanup approach (for a SEPARATE,
-- reviewed script — do NOT run anything here):
--   1. From Section 5, record the suggested canonical UID per duplicated email.
--   2. Confirm the canonical UID has is_synthetic=true, the right persona, AND
--      the most complete persisted records (Sections 6–12).
--   3. In a separate cleanup script, delete ONLY the NON-canonical duplicate
--      auth.users rows (cascades remove their owned rows) — one email at a time,
--      after founder sign-off. Never delete by `?email=` via the admin REST API
--      (its filter is unreliable here); delete by explicit UID in SQL.
--   4. Re-run THIS read-only script; expect auth_user_count = 1 and all PASS.
-- ----------------------------------------------------------------------------
SELECT 'Cleanup is intentionally NOT performed by this read-only script. '
    || 'See Section 15 comments for the reviewed-cleanup plan.' AS cleanup_notice;
