-- ==========================================================================
-- 075 verification: proves each repaired 055 trigger emits a sync_queue
-- row on INSERT, UPDATE, and DELETE.
--
-- Usage:
--   psql "$DATABASE_URL" -f scripts/validation/verify_075_triggers.sql
--
-- The script wraps everything in a transaction and ROLLBACKs at the end,
-- so no fixture data is left behind. Output is a single result set with
-- one row per trigger × {INSERT, UPDATE, DELETE} indicating PASS/FAIL.
-- ==========================================================================
BEGIN;

-- A synthetic profile for the test fixtures. ON DELETE CASCADE from
-- public.profiles will tear down any rows we forget to clean up.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = '00000000-0000-0000-0000-0000000be075') THEN
    INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at)
    VALUES ('00000000-0000-0000-0000-0000000be075', 'verify-075@lifenav.test',
            crypt('x', gen_salt('bf')), NOW(), NOW());
  END IF;
END $$;

INSERT INTO public.profiles (id, email)
VALUES ('00000000-0000-0000-0000-0000000be075', 'verify-075@lifenav.test')
ON CONFLICT (id) DO NOTHING;

-- Result accumulator
CREATE TEMP TABLE _verify_results (
  trigger_name TEXT,
  op           TEXT,
  expected_rows INT,
  observed_rows INT,
  passed       BOOLEAN
) ON COMMIT DROP;

-- ----------------------------------------------------------------------
-- Helper: count queue rows for (user, source_table, operation)
-- ----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION pg_temp.assert_queue(
  p_trigger TEXT,
  p_source  TEXT,
  p_op      TEXT,
  p_before  TIMESTAMPTZ
) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count
    FROM graphrag.sync_queue
   WHERE user_id      = '00000000-0000-0000-0000-0000000be075'
     AND source_table = p_source
     AND operation    = p_op
     AND created_at   >= p_before;

  INSERT INTO _verify_results VALUES (p_trigger, p_op, 1, v_count, v_count >= 1);
END $$;


-- ======================================================================
-- 1. public.education_records
-- ======================================================================
DO $$
DECLARE
  v_id UUID;
  v_t  TIMESTAMPTZ := NOW();
BEGIN
  -- INSERT
  INSERT INTO public.education_records
    (user_id, institution_name, status)
    VALUES ('00000000-0000-0000-0000-0000000be075', 'Verify-U', 'in_progress')
    RETURNING id INTO v_id;
  PERFORM pg_temp.assert_queue('trigger_education_record_sync', 'public.education_records', 'upsert', v_t);

  -- UPDATE
  v_t := clock_timestamp();
  UPDATE public.education_records SET status = 'completed' WHERE id = v_id;
  PERFORM pg_temp.assert_queue('trigger_education_record_sync', 'public.education_records', 'upsert', v_t);

  -- DELETE
  v_t := clock_timestamp();
  DELETE FROM public.education_records WHERE id = v_id;
  PERFORM pg_temp.assert_queue('trigger_education_record_sync', 'public.education_records', 'delete', v_t);
EXCEPTION WHEN OTHERS THEN
  INSERT INTO _verify_results VALUES ('trigger_education_record_sync', 'ERROR', 1, 0, FALSE);
END $$;

-- ======================================================================
-- 2. public.courses
-- ======================================================================
DO $$
DECLARE v_id UUID; v_t TIMESTAMPTZ := NOW();
BEGIN
  INSERT INTO public.courses (user_id, course_name, status)
    VALUES ('00000000-0000-0000-0000-0000000be075', 'Verify-101', 'enrolled')
    RETURNING id INTO v_id;
  PERFORM pg_temp.assert_queue('trigger_course_sync', 'public.courses', 'upsert', v_t);

  v_t := clock_timestamp();
  UPDATE public.courses SET status = 'completed' WHERE id = v_id;
  PERFORM pg_temp.assert_queue('trigger_course_sync', 'public.courses', 'upsert', v_t);

  v_t := clock_timestamp();
  DELETE FROM public.courses WHERE id = v_id;
  PERFORM pg_temp.assert_queue('trigger_course_sync', 'public.courses', 'delete', v_t);
EXCEPTION WHEN OTHERS THEN
  INSERT INTO _verify_results VALUES ('trigger_course_sync', 'ERROR', 1, 0, FALSE);
END $$;

-- ======================================================================
-- 3. public.job_applications
-- ======================================================================
DO $$
DECLARE v_id UUID; v_t TIMESTAMPTZ := NOW();
BEGIN
  INSERT INTO public.job_applications (user_id, company, position, status)
    VALUES ('00000000-0000-0000-0000-0000000be075', 'Verify Co', 'SWE', 'applied')
    RETURNING id INTO v_id;
  PERFORM pg_temp.assert_queue('trigger_job_application_sync', 'public.job_applications', 'upsert', v_t);

  v_t := clock_timestamp();
  UPDATE public.job_applications SET status = 'interview' WHERE id = v_id;
  PERFORM pg_temp.assert_queue('trigger_job_application_sync', 'public.job_applications', 'upsert', v_t);

  v_t := clock_timestamp();
  DELETE FROM public.job_applications WHERE id = v_id;
  PERFORM pg_temp.assert_queue('trigger_job_application_sync', 'public.job_applications', 'delete', v_t);
EXCEPTION WHEN OTHERS THEN
  INSERT INTO _verify_results VALUES ('trigger_job_application_sync', 'ERROR', 1, 0, FALSE);
END $$;

-- ======================================================================
-- 4. public.career_connections
-- ======================================================================
DO $$
DECLARE v_id UUID; v_t TIMESTAMPTZ := NOW();
BEGIN
  INSERT INTO public.career_connections (user_id, name, relationship_type)
    VALUES ('00000000-0000-0000-0000-0000000be075', 'Verify Person', 'mentor')
    RETURNING id INTO v_id;
  PERFORM pg_temp.assert_queue('trigger_career_connection_sync', 'public.career_connections', 'upsert', v_t);

  v_t := clock_timestamp();
  UPDATE public.career_connections SET title = 'Director' WHERE id = v_id;
  PERFORM pg_temp.assert_queue('trigger_career_connection_sync', 'public.career_connections', 'upsert', v_t);

  v_t := clock_timestamp();
  DELETE FROM public.career_connections WHERE id = v_id;
  PERFORM pg_temp.assert_queue('trigger_career_connection_sync', 'public.career_connections', 'delete', v_t);
EXCEPTION WHEN OTHERS THEN
  INSERT INTO _verify_results VALUES ('trigger_career_connection_sync', 'ERROR', 1, 0, FALSE);
END $$;

-- ======================================================================
-- 5. public.resumes
-- ======================================================================
DO $$
DECLARE v_id UUID; v_t TIMESTAMPTZ := NOW();
BEGIN
  INSERT INTO public.resumes (user_id, title)
    VALUES ('00000000-0000-0000-0000-0000000be075', 'Verify Resume')
    RETURNING id INTO v_id;
  PERFORM pg_temp.assert_queue('trigger_resume_sync', 'public.resumes', 'upsert', v_t);

  v_t := clock_timestamp();
  UPDATE public.resumes SET version = 'v2' WHERE id = v_id;
  PERFORM pg_temp.assert_queue('trigger_resume_sync', 'public.resumes', 'upsert', v_t);

  v_t := clock_timestamp();
  DELETE FROM public.resumes WHERE id = v_id;
  PERFORM pg_temp.assert_queue('trigger_resume_sync', 'public.resumes', 'delete', v_t);
EXCEPTION WHEN OTHERS THEN
  INSERT INTO _verify_results VALUES ('trigger_resume_sync', 'ERROR', 1, 0, FALSE);
END $$;

-- ======================================================================
-- 6. finance.financial_goals
-- ======================================================================
DO $$
DECLARE v_id UUID; v_t TIMESTAMPTZ := NOW();
BEGIN
  INSERT INTO finance.financial_goals (user_id, name, target_amount, target_date, priority)
    VALUES ('00000000-0000-0000-0000-0000000be075', 'Verify Goal', 10000, NOW() + INTERVAL '1 year', 'high')
    RETURNING id INTO v_id;
  PERFORM pg_temp.assert_queue('trigger_financial_goal_sync', 'finance.financial_goals', 'upsert', v_t);

  v_t := clock_timestamp();
  UPDATE finance.financial_goals SET current_amount = 500 WHERE id = v_id;
  PERFORM pg_temp.assert_queue('trigger_financial_goal_sync', 'finance.financial_goals', 'upsert', v_t);

  v_t := clock_timestamp();
  DELETE FROM finance.financial_goals WHERE id = v_id;
  PERFORM pg_temp.assert_queue('trigger_financial_goal_sync', 'finance.financial_goals', 'delete', v_t);
EXCEPTION WHEN OTHERS THEN
  INSERT INTO _verify_results VALUES ('trigger_financial_goal_sync', 'ERROR', 1, 0, FALSE);
END $$;

-- ======================================================================
-- 7. finance.investment_holdings
-- ======================================================================
DO $$
DECLARE v_id UUID; v_t TIMESTAMPTZ := NOW();
BEGIN
  INSERT INTO finance.investment_holdings (user_id, symbol, quantity, cost_basis)
    VALUES ('00000000-0000-0000-0000-0000000be075', 'VOO', 10, 4500)
    RETURNING id INTO v_id;
  PERFORM pg_temp.assert_queue('trigger_investment_holding_sync', 'finance.investment_holdings', 'upsert', v_t);

  v_t := clock_timestamp();
  UPDATE finance.investment_holdings SET current_value = 5000 WHERE id = v_id;
  PERFORM pg_temp.assert_queue('trigger_investment_holding_sync', 'finance.investment_holdings', 'upsert', v_t);

  v_t := clock_timestamp();
  DELETE FROM finance.investment_holdings WHERE id = v_id;
  PERFORM pg_temp.assert_queue('trigger_investment_holding_sync', 'finance.investment_holdings', 'delete', v_t);
EXCEPTION WHEN OTHERS THEN
  INSERT INTO _verify_results VALUES ('trigger_investment_holding_sync', 'ERROR', 1, 0, FALSE);
END $$;

-- ======================================================================
-- 8. finance.transactions
-- ======================================================================
DO $$
DECLARE v_id UUID; v_t TIMESTAMPTZ := NOW();
BEGIN
  INSERT INTO finance.transactions (user_id, amount, category, transaction_date)
    VALUES ('00000000-0000-0000-0000-0000000be075', 42.00, 'groceries', CURRENT_DATE)
    RETURNING id INTO v_id;
  PERFORM pg_temp.assert_queue('trigger_transaction_sync', 'finance.transactions', 'upsert', v_t);

  v_t := clock_timestamp();
  UPDATE finance.transactions SET category = 'dining' WHERE id = v_id;
  PERFORM pg_temp.assert_queue('trigger_transaction_sync', 'finance.transactions', 'upsert', v_t);

  v_t := clock_timestamp();
  DELETE FROM finance.transactions WHERE id = v_id;
  PERFORM pg_temp.assert_queue('trigger_transaction_sync', 'finance.transactions', 'delete', v_t);
EXCEPTION WHEN OTHERS THEN
  INSERT INTO _verify_results VALUES ('trigger_transaction_sync', 'ERROR', 1, 0, FALSE);
END $$;

-- ======================================================================
-- 9. public.family_members
-- ======================================================================
DO $$
DECLARE v_id UUID; v_t TIMESTAMPTZ := NOW();
BEGIN
  INSERT INTO public.family_members (user_id, name, relationship)
    VALUES ('00000000-0000-0000-0000-0000000be075', 'Verify Relative', 'sibling')
    RETURNING id INTO v_id;
  PERFORM pg_temp.assert_queue('trigger_family_member_sync', 'public.family_members', 'upsert', v_t);

  v_t := clock_timestamp();
  UPDATE public.family_members SET relationship = 'child' WHERE id = v_id;
  PERFORM pg_temp.assert_queue('trigger_family_member_sync', 'public.family_members', 'upsert', v_t);

  v_t := clock_timestamp();
  DELETE FROM public.family_members WHERE id = v_id;
  PERFORM pg_temp.assert_queue('trigger_family_member_sync', 'public.family_members', 'delete', v_t);
EXCEPTION WHEN OTHERS THEN
  INSERT INTO _verify_results VALUES ('trigger_family_member_sync', 'ERROR', 1, 0, FALSE);
END $$;

-- ======================================================================
-- 10. health_meta.health_records
-- ======================================================================
DO $$
DECLARE v_id UUID; v_t TIMESTAMPTZ := NOW();
BEGIN
  INSERT INTO health_meta.health_records (user_id, record_type, record_date)
    VALUES ('00000000-0000-0000-0000-0000000be075', 'lab_panel', CURRENT_DATE)
    RETURNING id INTO v_id;
  PERFORM pg_temp.assert_queue('trigger_health_record_sync', 'health_meta.health_records', 'upsert', v_t);

  v_t := clock_timestamp();
  UPDATE health_meta.health_records SET provider = 'Verify Clinic' WHERE id = v_id;
  PERFORM pg_temp.assert_queue('trigger_health_record_sync', 'health_meta.health_records', 'upsert', v_t);

  v_t := clock_timestamp();
  DELETE FROM health_meta.health_records WHERE id = v_id;
  PERFORM pg_temp.assert_queue('trigger_health_record_sync', 'health_meta.health_records', 'delete', v_t);
EXCEPTION WHEN OTHERS THEN
  INSERT INTO _verify_results VALUES ('trigger_health_record_sync', 'ERROR', 1, 0, FALSE);
END $$;

-- ======================================================================
-- 11. health_meta.health_metrics
-- ======================================================================
DO $$
DECLARE v_id UUID; v_t TIMESTAMPTZ := NOW();
BEGIN
  INSERT INTO health_meta.health_metrics (user_id, metric_type, value, unit, measured_at)
    VALUES ('00000000-0000-0000-0000-0000000be075', 'resting_hr', 60, 'bpm', NOW())
    RETURNING id INTO v_id;
  PERFORM pg_temp.assert_queue('trigger_health_metric_sync', 'health_meta.health_metrics', 'upsert', v_t);

  v_t := clock_timestamp();
  UPDATE health_meta.health_metrics SET value = 58 WHERE id = v_id;
  PERFORM pg_temp.assert_queue('trigger_health_metric_sync', 'health_meta.health_metrics', 'upsert', v_t);

  v_t := clock_timestamp();
  DELETE FROM health_meta.health_metrics WHERE id = v_id;
  PERFORM pg_temp.assert_queue('trigger_health_metric_sync', 'health_meta.health_metrics', 'delete', v_t);
EXCEPTION WHEN OTHERS THEN
  INSERT INTO _verify_results VALUES ('trigger_health_metric_sync', 'ERROR', 1, 0, FALSE);
END $$;

-- ======================================================================
-- 12. public.documents
-- ======================================================================
DO $$
DECLARE v_id UUID; v_t TIMESTAMPTZ := NOW();
BEGIN
  INSERT INTO public.documents (user_id, name, document_type, mime_type, storage_path)
    VALUES ('00000000-0000-0000-0000-0000000be075', 'Verify Doc', 'misc', 'application/pdf', 'tmp/verify.pdf')
    RETURNING id INTO v_id;
  PERFORM pg_temp.assert_queue('trigger_document_sync', 'public.documents', 'upsert', v_t);

  v_t := clock_timestamp();
  UPDATE public.documents SET document_type = 'tax' WHERE id = v_id;
  PERFORM pg_temp.assert_queue('trigger_document_sync', 'public.documents', 'upsert', v_t);

  v_t := clock_timestamp();
  DELETE FROM public.documents WHERE id = v_id;
  PERFORM pg_temp.assert_queue('trigger_document_sync', 'public.documents', 'delete', v_t);
EXCEPTION WHEN OTHERS THEN
  INSERT INTO _verify_results VALUES ('trigger_document_sync', 'ERROR', 1, 0, FALSE);
END $$;


-- ----------------------------------------------------------------------
-- Final report
-- ----------------------------------------------------------------------
SELECT trigger_name, op, observed_rows, passed
  FROM _verify_results
 ORDER BY trigger_name, op;

SELECT
  COUNT(*)                                                   AS total,
  COUNT(*) FILTER (WHERE passed)                             AS pass,
  COUNT(*) FILTER (WHERE NOT passed)                         AS fail,
  CASE WHEN COUNT(*) FILTER (WHERE NOT passed) = 0
       THEN 'ALL PASS' ELSE 'FAIL' END                       AS summary
  FROM _verify_results;

ROLLBACK;
