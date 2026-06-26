-- finance.financial_planning_goals — additive, idempotent. PLANNING goals/targets ONLY (never accounts).
CREATE SCHEMA IF NOT EXISTS finance;
CREATE TABLE IF NOT EXISTS finance.financial_planning_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  goal_type text NOT NULL,
  label text,
  target_amount numeric,
  amount_min numeric,
  amount_max numeric,
  target_date date,
  timeline text,
  priority text,
  linked_domains text[] DEFAULT '{}',
  source text,
  confidence numeric,
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fin_planning_user ON finance.financial_planning_goals(user_id);
ALTER TABLE finance.financial_planning_goals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS users_own_fin_planning ON finance.financial_planning_goals;
CREATE POLICY users_own_fin_planning ON finance.financial_planning_goals FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS service_fin_planning ON finance.financial_planning_goals;
CREATE POLICY service_fin_planning ON finance.financial_planning_goals FOR ALL TO service_role
  USING (true) WITH CHECK (true);
GRANT USAGE ON SCHEMA finance TO authenticated, service_role, anon;
GRANT SELECT, INSERT, UPDATE ON finance.financial_planning_goals TO authenticated, service_role;
