-- 131_family_schema.sql — Family domain user-owned schema (Family F1).
--
-- New, isolated `family` schema. Legacy public.family_members / family_appointments are a
-- separate older surface and are NOT touched (the new domain uses family.* exclusively).
-- Pattern: Finance/Health/Career/Education 116-RLS. enum-before-trigger: NO triggers here
-- (added in 132 after the worker enum ships + deploys). Family data is sensitive — minimal
-- PII by design (relationships/bands, not full names). Every table: user_id + tenant_id +
-- timestamps + metadata; source/confidence where estimated.

CREATE SCHEMA IF NOT EXISTS family;

-- 1. family_profiles
CREATE TABLE IF NOT EXISTS family.family_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL, tenant_id UUID,
  household_size INTEGER, marital_status TEXT, num_dependents INTEGER,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());

-- 2. dependents (guardianship_plan_id FK enables the COVERS_DEPENDENT inter-entity edge)
CREATE TABLE IF NOT EXISTS family.dependents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL, tenant_id UUID,
  relationship TEXT, birth_year INTEGER, guardianship_plan_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());

-- 3. spouse_profiles
CREATE TABLE IF NOT EXISTS family.spouse_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL, tenant_id UUID,
  employment_status TEXT, income_band TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());

-- 4. guardianship_plans
CREATE TABLE IF NOT EXISTS family.guardianship_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL, tenant_id UUID,
  status TEXT NOT NULL DEFAULT 'undesignated', designated_guardian TEXT, notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());

-- 5. estate_plans
CREATE TABLE IF NOT EXISTS family.estate_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL, tenant_id UUID,
  has_will BOOLEAN DEFAULT false, has_poa BOOLEAN DEFAULT false,
  has_beneficiaries BOOLEAN DEFAULT false, status TEXT NOT NULL DEFAULT 'incomplete',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());

-- 6. insurance_profiles
CREATE TABLE IF NOT EXISTS family.insurance_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL, tenant_id UUID,
  life_coverage NUMERIC(14,2), disability_coverage NUMERIC(14,2), currency TEXT DEFAULT 'USD',
  source TEXT, confidence NUMERIC(4,3), metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());

-- 7. college_planning
CREATE TABLE IF NOT EXISTS family.college_planning (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL, tenant_id UUID,
  dependent_id UUID, target_year INTEGER, projected_cost NUMERIC(14,2),
  saved_amount NUMERIC(14,2), vehicle TEXT, currency TEXT DEFAULT 'USD',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());

-- 8. family_recommendations (RECOMMENDATION_FRAMEWORK shape + affected_domains)
CREATE TABLE IF NOT EXISTS family.family_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL, tenant_id UUID NOT NULL,
  title TEXT NOT NULL, description TEXT, recommendation_type TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium', confidence NUMERIC(4,3) NOT NULL DEFAULT 0.5,
  governance_verdict JSONB NOT NULL DEFAULT '{}'::jsonb, status TEXT NOT NULL DEFAULT 'active',
  evidence_json JSONB NOT NULL DEFAULT '[]'::jsonb, assumptions_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  tradeoffs_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_tables TEXT[] NOT NULL DEFAULT '{}', source_graph_nodes TEXT[] NOT NULL DEFAULT '{}',
  affected_domains TEXT[] NOT NULL DEFAULT '{family}', derived_by TEXT NOT NULL DEFAULT 'family-recommendation-engine',
  addresses_entity_type TEXT, addresses_entity_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ, rejected_at TIMESTAMPTZ, dismissed_at TIMESTAMPTZ);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_f_profiles_user ON family.family_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_f_dependents_user ON family.dependents(user_id);
CREATE INDEX IF NOT EXISTS idx_f_dependents_guardian ON family.dependents(guardianship_plan_id);
CREATE INDEX IF NOT EXISTS idx_f_spouse_user ON family.spouse_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_f_guardian_user ON family.guardianship_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_f_estate_user ON family.estate_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_f_insurance_user ON family.insurance_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_f_college_user ON family.college_planning(user_id);
CREATE INDEX IF NOT EXISTS idx_f_recs_user ON family.family_recommendations(user_id, recommendation_type);

-- RLS: owner isolation + service-role write (uniform)
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'family_profiles','dependents','spouse_profiles','guardianship_plans','estate_plans',
    'insurance_profiles','college_planning','family_recommendations'
  ] LOOP
    EXECUTE format('ALTER TABLE family.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE family.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format($p$DROP POLICY IF EXISTS users_own_%1$s ON family.%1$I$p$, t);
    EXECUTE format(
      'CREATE POLICY users_own_%1$s ON family.%1$I FOR ALL TO authenticated '
      'USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())', t);
    EXECUTE format($p$DROP POLICY IF EXISTS service_%1$s ON family.%1$I$p$, t);
    EXECUTE format(
      'CREATE POLICY service_%1$s ON family.%1$I FOR ALL TO service_role USING (true) WITH CHECK (true)', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON family.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON family.%I TO service_role', t);
  END LOOP;
END $$;

DROP VIEW IF EXISTS public.v_family_recommendations;
CREATE VIEW public.v_family_recommendations WITH (security_invoker = true) AS
  SELECT id, user_id, title, description, recommendation_type, priority, confidence,
         governance_verdict, status, evidence_json, assumptions_json, tradeoffs_json,
         affected_domains, created_at, updated_at, accepted_at, rejected_at, dismissed_at
  FROM family.family_recommendations;
GRANT SELECT ON public.v_family_recommendations TO authenticated;

GRANT USAGE ON SCHEMA family TO authenticated, service_role, anon;
-- NO triggers (enum-before-trigger). NO PostgREST db_schemas change here (done in 133).
