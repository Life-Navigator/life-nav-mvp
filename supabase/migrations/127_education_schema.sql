-- 127_education_schema.sql — Education domain user-owned schema (Education E1).
--
-- New, isolated `education` schema. Legacy public.education_records is a separate older
-- surface and is NOT touched here (the new domain uses education.* exclusively).
-- Pattern: Finance/Health/Career 116-RLS — RLS enabled + FORCE, owner-ALL
-- (user_id=auth.uid()), service_role-ALL, grants, indexes, security_invoker view for
-- recommendations. enum-before-trigger: NO triggers here (added in 128 after the worker
-- enum ships + deploys). Every table: user_id + tenant_id + created_at/updated_at +
-- metadata; source/confidence where facts are estimated/cited.

CREATE SCHEMA IF NOT EXISTS education;

-- 1. education_profiles
CREATE TABLE IF NOT EXISTS education.education_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL, tenant_id UUID,
  highest_level TEXT, existing_credentials JSONB NOT NULL DEFAULT '[]'::jsonb,
  learning_preferences TEXT, source TEXT, confidence NUMERIC(4,3),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());

-- 2. education_goals
CREATE TABLE IF NOT EXISTS education.education_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL, tenant_id UUID,
  title TEXT NOT NULL, goal_type TEXT NOT NULL DEFAULT 'credential', target_role TEXT,
  target_date DATE, status TEXT NOT NULL DEFAULT 'active',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());

-- 3. learning_paths
CREATE TABLE IF NOT EXISTS education.learning_paths (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL, tenant_id UUID,
  title TEXT NOT NULL, description TEXT, status TEXT NOT NULL DEFAULT 'planned',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());

-- 4. schools
CREATE TABLE IF NOT EXISTS education.schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL, tenant_id UUID,
  name TEXT NOT NULL, school_type TEXT, location TEXT, accreditation_status TEXT,
  source TEXT, source_as_of DATE, confidence NUMERIC(4,3),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());

-- 5. programs (school_id FK -> education.schools enables the OFFERS inter-entity edge)
CREATE TABLE IF NOT EXISTS education.programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL, tenant_id UUID,
  school_id UUID, name TEXT NOT NULL, level TEXT, major TEXT, modality TEXT,
  duration_months INTEGER, tuition NUMERIC(14,2), currency TEXT DEFAULT 'USD',
  graduation_rate NUMERIC(5,4), median_salary NUMERIC(14,2),
  source TEXT, source_as_of DATE, confidence NUMERIC(4,3),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());

-- 6. certifications (education-side; distinct from career.certifications by source_table)
CREATE TABLE IF NOT EXISTS education.certifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL, tenant_id UUID,
  name TEXT NOT NULL, issuer TEXT, program_id UUID, status TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());

-- 7. program_comparisons
CREATE TABLE IF NOT EXISTS education.program_comparisons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL, tenant_id UUID,
  title TEXT NOT NULL, options_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  summary_json JSONB NOT NULL DEFAULT '{}'::jsonb, status TEXT NOT NULL DEFAULT 'draft',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());

-- 8. education_recommendations (RECOMMENDATION_FRAMEWORK shape + affected_domains)
CREATE TABLE IF NOT EXISTS education.education_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL, tenant_id UUID NOT NULL,
  title TEXT NOT NULL, description TEXT, recommendation_type TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium', confidence NUMERIC(4,3) NOT NULL DEFAULT 0.5,
  governance_verdict JSONB NOT NULL DEFAULT '{}'::jsonb, status TEXT NOT NULL DEFAULT 'active',
  evidence_json JSONB NOT NULL DEFAULT '[]'::jsonb, assumptions_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  tradeoffs_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_tables TEXT[] NOT NULL DEFAULT '{}', source_graph_nodes TEXT[] NOT NULL DEFAULT '{}',
  affected_domains TEXT[] NOT NULL DEFAULT '{education}', derived_by TEXT NOT NULL DEFAULT 'education-recommendation-engine',
  addresses_entity_type TEXT, addresses_entity_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ, rejected_at TIMESTAMPTZ, dismissed_at TIMESTAMPTZ);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_e_profiles_user ON education.education_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_e_goals_user ON education.education_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_e_paths_user ON education.learning_paths(user_id);
CREATE INDEX IF NOT EXISTS idx_e_schools_user ON education.schools(user_id);
CREATE INDEX IF NOT EXISTS idx_e_programs_user ON education.programs(user_id);
CREATE INDEX IF NOT EXISTS idx_e_programs_school ON education.programs(school_id);
CREATE INDEX IF NOT EXISTS idx_e_certs_user ON education.certifications(user_id);
CREATE INDEX IF NOT EXISTS idx_e_compare_user ON education.program_comparisons(user_id);
CREATE INDEX IF NOT EXISTS idx_e_recs_user ON education.education_recommendations(user_id, recommendation_type);

-- RLS: owner isolation + service-role write (uniform)
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'education_profiles','education_goals','learning_paths','schools','programs',
    'certifications','program_comparisons','education_recommendations'
  ] LOOP
    EXECUTE format('ALTER TABLE education.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE education.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format($p$DROP POLICY IF EXISTS users_own_%1$s ON education.%1$I$p$, t);
    EXECUTE format(
      'CREATE POLICY users_own_%1$s ON education.%1$I FOR ALL TO authenticated '
      'USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())', t);
    EXECUTE format($p$DROP POLICY IF EXISTS service_%1$s ON education.%1$I$p$, t);
    EXECUTE format(
      'CREATE POLICY service_%1$s ON education.%1$I FOR ALL TO service_role USING (true) WITH CHECK (true)', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON education.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON education.%I TO service_role', t);
  END LOOP;
END $$;

-- security_invoker read view for recommendations
DROP VIEW IF EXISTS public.v_education_recommendations;
CREATE VIEW public.v_education_recommendations WITH (security_invoker = true) AS
  SELECT id, user_id, title, description, recommendation_type, priority, confidence,
         governance_verdict, status, evidence_json, assumptions_json, tradeoffs_json,
         affected_domains, created_at, updated_at, accepted_at, rejected_at, dismissed_at
  FROM education.education_recommendations;
GRANT SELECT ON public.v_education_recommendations TO authenticated;

GRANT USAGE ON SCHEMA education TO authenticated, service_role, anon;
-- NO triggers (enum-before-trigger). NO PostgREST db_schemas change here (done in 129).
