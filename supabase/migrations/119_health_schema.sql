-- 119_health_schema.sql — Health & Wellness foundation (H1 Phase 1).
--
-- New, isolated `health` schema (separate from the legacy `health_meta` schema and its
-- triggers, which are untouched). Follows the Finance 116/117 RLS pattern:
--   * RLS enabled + FORCE
--   * owner ALL policy (USING/WITH CHECK user_id = auth.uid())
--   * service_role ALL policy (Core API writes; GraphRAG reads)
--   * grants + security_invoker read views for user-facing tables
-- enum-before-trigger: NO GraphRAG triggers here (added in a later migration after the
-- worker enum variants ship + tests pass). Idempotent (IF NOT EXISTS).

CREATE SCHEMA IF NOT EXISTS health;

-- ── Core ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS health.health_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  dob_year SMALLINT,
  sex_at_birth TEXT,
  height_cm NUMERIC(5,1),
  baseline_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS health.health_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  goal_type TEXT NOT NULL DEFAULT 'wellness',
  target_metric TEXT,
  target_value NUMERIC(12,2),
  target_unit TEXT,
  target_date DATE,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS health.wellness_habits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  cadence TEXT NOT NULL DEFAULT 'daily',
  streak INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS health.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  logged_at DATE NOT NULL DEFAULT current_date,
  activity_type TEXT,
  duration_min INTEGER,
  steps INTEGER,
  calories INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS health.sleep_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  night_of DATE NOT NULL,
  total_hours NUMERIC(4,2),
  efficiency NUMERIC(4,3),
  awakenings INTEGER,
  bedtime TIME,
  wake_time TIME,
  source TEXT DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS health.nutrition_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  logged_at DATE NOT NULL DEFAULT current_date,
  calories INTEGER,
  protein_g NUMERIC(6,1),
  carbs_g NUMERIC(6,1),
  fat_g NUMERIC(6,1),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS health.supplement_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  logged_at DATE NOT NULL DEFAULT current_date,
  name TEXT NOT NULL,
  dose NUMERIC(10,2),
  unit TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS health.vitals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  kind TEXT NOT NULL,            -- heart_rate | blood_pressure | spo2 | temperature | ...
  value NUMERIC(10,2),
  value_secondary NUMERIC(10,2), -- e.g. diastolic
  unit TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS health.lab_markers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  observed_at DATE NOT NULL,
  marker TEXT NOT NULL,
  value NUMERIC(12,4),
  unit TEXT,
  reference_low NUMERIC(12,4),
  reference_high NUMERIC(12,4),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS health.body_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  observed_at DATE NOT NULL DEFAULT current_date,
  weight_kg NUMERIC(6,2),
  body_fat_pct NUMERIC(5,2),
  waist_cm NUMERIC(5,1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS health.workout_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  logged_at DATE NOT NULL DEFAULT current_date,
  modality TEXT,
  duration_min INTEGER,
  intensity TEXT,
  load NUMERIC(10,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Benefits / Insurance ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS health.health_insurance_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  plan_name TEXT NOT NULL,
  carrier TEXT,
  plan_type TEXT,
  employer_benefit_id UUID,        -- extension point: COVERED_BY EmployerBenefit
  premium NUMERIC(12,2),
  deductible NUMERIC(12,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS health.health_spending_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  account_type TEXT NOT NULL DEFAULT 'hsa',   -- hsa | fsa
  balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  contribution_ytd NUMERIC(12,2),
  currency TEXT NOT NULL DEFAULT 'USD',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS health.medical_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  expense_date DATE NOT NULL DEFAULT current_date,
  amount NUMERIC(12,2),
  category TEXT,
  description TEXT,
  spending_account_id UUID,        -- extension point: ELIGIBLE_FOR_HSA_FSA HealthSpendingAccount
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS health.benefit_deadlines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  deadline_date DATE NOT NULL,
  benefit_type TEXT,
  description TEXT,
  spending_account_id UUID,        -- extension point: ADDRESSES HealthSpendingAccount
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Recommendation / Governance (standard RECOMMENDATION_FRAMEWORK shape) ─────
CREATE TABLE IF NOT EXISTS health.health_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  recommendation_type TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium',
  confidence NUMERIC(4,3) NOT NULL DEFAULT 0.5,
  governance_verdict JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'active',
  evidence_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  assumptions_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  tradeoffs_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_tables TEXT[] NOT NULL DEFAULT '{}',
  source_graph_nodes TEXT[] NOT NULL DEFAULT '{}',
  derived_by TEXT NOT NULL DEFAULT 'health-recommendation-engine',
  addresses_entity_type TEXT,
  addresses_entity_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ
);

-- ── Indexes (user_id + relevant dates) ───────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_h_profiles_user ON health.health_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_h_goals_user ON health.health_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_h_habits_user ON health.wellness_habits(user_id);
CREATE INDEX IF NOT EXISTS idx_h_activity_user ON health.activity_logs(user_id, logged_at);
CREATE INDEX IF NOT EXISTS idx_h_sleep_user ON health.sleep_logs(user_id, night_of);
CREATE INDEX IF NOT EXISTS idx_h_nutrition_user ON health.nutrition_logs(user_id, logged_at);
CREATE INDEX IF NOT EXISTS idx_h_supplement_user ON health.supplement_logs(user_id, logged_at);
CREATE INDEX IF NOT EXISTS idx_h_vitals_user ON health.vitals(user_id, observed_at);
CREATE INDEX IF NOT EXISTS idx_h_labs_user ON health.lab_markers(user_id, observed_at);
CREATE INDEX IF NOT EXISTS idx_h_body_user ON health.body_metrics(user_id, observed_at);
CREATE INDEX IF NOT EXISTS idx_h_workout_user ON health.workout_logs(user_id, logged_at);
CREATE INDEX IF NOT EXISTS idx_h_insurance_user ON health.health_insurance_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_h_hsa_user ON health.health_spending_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_h_medexp_user ON health.medical_expenses(user_id, expense_date);
CREATE INDEX IF NOT EXISTS idx_h_deadline_user ON health.benefit_deadlines(user_id, deadline_date);
CREATE INDEX IF NOT EXISTS idx_h_recs_user ON health.health_recommendations(user_id, recommendation_type);

-- ── RLS: owner isolation + service-role write, applied uniformly ─────────────
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'health_profiles','health_goals','wellness_habits','activity_logs','sleep_logs',
    'nutrition_logs','supplement_logs','vitals','lab_markers','body_metrics','workout_logs',
    'health_insurance_plans','health_spending_accounts','medical_expenses','benefit_deadlines',
    'health_recommendations'
  ] LOOP
    EXECUTE format('ALTER TABLE health.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE health.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format($p$DROP POLICY IF EXISTS users_own_%1$s ON health.%1$I$p$, t);
    EXECUTE format(
      'CREATE POLICY users_own_%1$s ON health.%1$I FOR ALL TO authenticated '
      'USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())', t);
    EXECUTE format($p$DROP POLICY IF EXISTS service_%1$s ON health.%1$I$p$, t);
    EXECUTE format(
      'CREATE POLICY service_%1$s ON health.%1$I FOR ALL TO service_role '
      'USING (true) WITH CHECK (true)', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON health.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON health.%I TO service_role', t);
  END LOOP;
END $$;

-- ── security_invoker read view for user-facing recommendations ───────────────
DROP VIEW IF EXISTS public.v_health_recommendations;
CREATE VIEW public.v_health_recommendations
  WITH (security_invoker = true) AS
  SELECT id, user_id, title, description, recommendation_type, priority, confidence,
         governance_verdict, status, evidence_json, assumptions_json, tradeoffs_json,
         addresses_entity_type, addresses_entity_id, created_at, updated_at,
         accepted_at, rejected_at, dismissed_at
  FROM health.health_recommendations;
GRANT SELECT ON public.v_health_recommendations TO authenticated;

-- NO triggers in this migration (enum-before-trigger).
