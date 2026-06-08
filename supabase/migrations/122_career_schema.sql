-- 122_career_schema.sql — Career domain user-owned schema (Career X1).
--
-- New, isolated `career` schema. Legacy public.career_profiles/career_connections/
-- job_applications/resumes are a separate older surface and are NOT touched or migrated
-- here (compatibility: the new Career domain uses career.* exclusively; a future
-- data-migration sprint may backfill career.* from the legacy public.* tables if needed).
--
-- Pattern: Finance/Health 116-RLS — RLS enabled + FORCE, owner-ALL (user_id=auth.uid()),
-- service_role-ALL, grants, indexes, security_invoker view for recommendations.
-- enum-before-trigger: NO triggers here. Every table carries user_id + tenant_id +
-- created_at/updated_at + metadata jsonb; source/confidence where facts are estimated.

CREATE SCHEMA IF NOT EXISTS career;

-- 1. career_profiles
CREATE TABLE IF NOT EXISTS career.career_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL, tenant_id UUID,
  current_title TEXT, current_employer TEXT, industry TEXT, seniority_level TEXT,
  years_experience NUMERIC(5,1), management_years NUMERIC(5,1), location TEXT,
  remote_preference TEXT, security_clearance TEXT, military_experience BOOLEAN DEFAULT false,
  source TEXT, confidence NUMERIC(4,3), metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());

-- 2. career_goals
CREATE TABLE IF NOT EXISTS career.career_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL, tenant_id UUID,
  title TEXT NOT NULL, goal_type TEXT NOT NULL DEFAULT 'advancement', target_role TEXT,
  target_total_comp NUMERIC(14,2), target_date DATE, status TEXT NOT NULL DEFAULT 'active',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());

-- 3. experience_records
CREATE TABLE IF NOT EXISTS career.experience_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL, tenant_id UUID,
  title TEXT, employer TEXT, industry TEXT, start_date DATE, end_date DATE,
  is_current BOOLEAN DEFAULT false, responsibilities TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());

-- 4. skills (the user's declared skills; references ln_central.skills_reference by id)
CREATE TABLE IF NOT EXISTS career.skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL, tenant_id UUID,
  name TEXT NOT NULL, category TEXT, skill_reference_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());

-- 5. user_skills (proficiency/evidence per skill)
CREATE TABLE IF NOT EXISTS career.user_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL, tenant_id UUID,
  skill_id UUID, proficiency TEXT, years_experience NUMERIC(5,1), last_used DATE,
  source TEXT, confidence NUMERIC(4,3), metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());

-- 6. skill_gaps (gap to a target role)
CREATE TABLE IF NOT EXISTS career.skill_gaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL, tenant_id UUID,
  skill_name TEXT NOT NULL, job_target_id UUID, target_role TEXT, severity TEXT,
  source TEXT, confidence NUMERIC(4,3), metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());

-- 7. credentials
CREATE TABLE IF NOT EXISTS career.credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL, tenant_id UUID,
  name TEXT NOT NULL, credential_type TEXT, issuer TEXT, issued_date DATE, expires_date DATE,
  credential_reference_id UUID, metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());

-- 8. certifications
CREATE TABLE IF NOT EXISTS career.certifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL, tenant_id UUID,
  name TEXT NOT NULL, issuer TEXT, earned_date DATE, expires_date DATE, status TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());

-- 9. degrees
CREATE TABLE IF NOT EXISTS career.degrees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL, tenant_id UUID,
  level TEXT, field TEXT, institution TEXT, conferred_date DATE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());

-- 10. resumes
CREATE TABLE IF NOT EXISTS career.resumes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL, tenant_id UUID,
  title TEXT, content_ref TEXT, version INTEGER NOT NULL DEFAULT 1,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());

-- 11. portfolio_items
CREATE TABLE IF NOT EXISTS career.portfolio_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL, tenant_id UUID,
  title TEXT, kind TEXT, url TEXT, description TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());

-- 12. job_targets
CREATE TABLE IF NOT EXISTS career.job_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL, tenant_id UUID,
  role_title TEXT NOT NULL, role_reference_id UUID, industry TEXT, location TEXT,
  target_comp_low NUMERIC(14,2), target_comp_median NUMERIC(14,2), target_comp_high NUMERIC(14,2),
  status TEXT NOT NULL DEFAULT 'considering', source TEXT, confidence NUMERIC(4,3),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());

-- 13. job_applications
CREATE TABLE IF NOT EXISTS career.job_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL, tenant_id UUID,
  job_target_id UUID, employer TEXT, role TEXT, status TEXT NOT NULL DEFAULT 'applied',
  applied_date DATE, metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());

-- 14. interviews
CREATE TABLE IF NOT EXISTS career.interviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL, tenant_id UUID,
  job_application_id UUID, stage TEXT, scheduled_at TIMESTAMPTZ, outcome TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());

-- 15. compensation_records (observed/known comp; banded — never a black-box single value)
CREATE TABLE IF NOT EXISTS career.compensation_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL, tenant_id UUID,
  role TEXT, employer TEXT, industry TEXT, location TEXT, effective_date DATE,
  base NUMERIC(14,2), bonus NUMERIC(14,2), equity NUMERIC(14,2),
  comp_low NUMERIC(14,2), comp_median NUMERIC(14,2), comp_high NUMERIC(14,2), currency TEXT DEFAULT 'USD',
  confidence NUMERIC(4,3), source TEXT, as_of_date DATE, assumptions_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());

-- 16. compensation_projections (modeled before/during/after-education, promotion, location, …)
CREATE TABLE IF NOT EXISTS career.compensation_projections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL, tenant_id UUID,
  scenario TEXT NOT NULL, horizon_months INTEGER, role TEXT, location TEXT,
  value_low NUMERIC(14,2), value_median NUMERIC(14,2), value_high NUMERIC(14,2), currency TEXT DEFAULT 'USD',
  confidence NUMERIC(4,3), source TEXT, as_of_date DATE,
  adjustments_json JSONB NOT NULL DEFAULT '{}'::jsonb,   -- location/industry/employer/education/credential/experience/military/clearance premiums (each value+confidence)
  assumptions_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());

-- 17. career_recommendations (RECOMMENDATION_FRAMEWORK shape + affected_domains)
CREATE TABLE IF NOT EXISTS career.career_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL, tenant_id UUID NOT NULL,
  title TEXT NOT NULL, description TEXT, recommendation_type TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium', confidence NUMERIC(4,3) NOT NULL DEFAULT 0.5,
  governance_verdict JSONB NOT NULL DEFAULT '{}'::jsonb, status TEXT NOT NULL DEFAULT 'active',
  evidence_json JSONB NOT NULL DEFAULT '[]'::jsonb, assumptions_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  tradeoffs_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_tables TEXT[] NOT NULL DEFAULT '{}', source_graph_nodes TEXT[] NOT NULL DEFAULT '{}',
  affected_domains TEXT[] NOT NULL DEFAULT '{career}', derived_by TEXT NOT NULL DEFAULT 'career-recommendation-engine',
  addresses_entity_type TEXT, addresses_entity_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ, rejected_at TIMESTAMPTZ, dismissed_at TIMESTAMPTZ);

-- Indexes (user_id + relevant dates)
CREATE INDEX IF NOT EXISTS idx_c_profiles_user ON career.career_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_c_goals_user ON career.career_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_c_exp_user ON career.experience_records(user_id, start_date);
CREATE INDEX IF NOT EXISTS idx_c_skills_user ON career.skills(user_id);
CREATE INDEX IF NOT EXISTS idx_c_userskills_user ON career.user_skills(user_id);
CREATE INDEX IF NOT EXISTS idx_c_gaps_user ON career.skill_gaps(user_id);
CREATE INDEX IF NOT EXISTS idx_c_creds_user ON career.credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_c_certs_user ON career.certifications(user_id);
CREATE INDEX IF NOT EXISTS idx_c_degrees_user ON career.degrees(user_id);
CREATE INDEX IF NOT EXISTS idx_c_resumes_user ON career.resumes(user_id);
CREATE INDEX IF NOT EXISTS idx_c_portfolio_user ON career.portfolio_items(user_id);
CREATE INDEX IF NOT EXISTS idx_c_targets_user ON career.job_targets(user_id);
CREATE INDEX IF NOT EXISTS idx_c_apps_user ON career.job_applications(user_id, applied_date);
CREATE INDEX IF NOT EXISTS idx_c_interviews_user ON career.interviews(user_id, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_c_comp_user ON career.compensation_records(user_id, effective_date);
CREATE INDEX IF NOT EXISTS idx_c_proj_user ON career.compensation_projections(user_id);
CREATE INDEX IF NOT EXISTS idx_c_recs_user ON career.career_recommendations(user_id, recommendation_type);

-- RLS: owner isolation + service-role write (uniform)
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'career_profiles','career_goals','experience_records','skills','user_skills','skill_gaps',
    'credentials','certifications','degrees','resumes','portfolio_items','job_targets',
    'job_applications','interviews','compensation_records','compensation_projections','career_recommendations'
  ] LOOP
    EXECUTE format('ALTER TABLE career.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE career.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format($p$DROP POLICY IF EXISTS users_own_%1$s ON career.%1$I$p$, t);
    EXECUTE format(
      'CREATE POLICY users_own_%1$s ON career.%1$I FOR ALL TO authenticated '
      'USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())', t);
    EXECUTE format($p$DROP POLICY IF EXISTS service_%1$s ON career.%1$I$p$, t);
    EXECUTE format(
      'CREATE POLICY service_%1$s ON career.%1$I FOR ALL TO service_role USING (true) WITH CHECK (true)', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON career.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON career.%I TO service_role', t);
  END LOOP;
END $$;

-- security_invoker read view for user-facing recommendations
DROP VIEW IF EXISTS public.v_career_recommendations;
CREATE VIEW public.v_career_recommendations WITH (security_invoker = true) AS
  SELECT id, user_id, title, description, recommendation_type, priority, confidence,
         governance_verdict, status, evidence_json, assumptions_json, tradeoffs_json,
         affected_domains, addresses_entity_type, addresses_entity_id,
         created_at, updated_at, accepted_at, rejected_at, dismissed_at
  FROM career.career_recommendations;
GRANT SELECT ON public.v_career_recommendations TO authenticated;

-- NO triggers (enum-before-trigger). NO GRANT USAGE / PostgREST exposure here — done in a
-- dedicated exposure step alongside the worker-enum + trigger sprint (X2/after), keeping the
-- exposed-schema list intact (graphrag must remain — the H1 incident).
GRANT USAGE ON SCHEMA career TO authenticated, service_role, anon;
