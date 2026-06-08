-- 117_finance_elite_schema.sql
-- Phase 1 of the Finance Recommendation Evidence Graph: the elite finance tables.
--
-- enum-before-trigger discipline: this migration creates TABLES ONLY. No GraphRAG
-- enqueue triggers are added here — they come in a later migration AFTER the worker
-- enum variants for these entity types exist and tests pass (otherwise the worker
-- would write :Unknown nodes).
--
-- RLS pattern (matches existing finance tables, e.g. finance.financial_accounts):
--   * RLS enabled
--   * owner ALL policy  USING/​WITH CHECK (user_id = auth.uid())
--   * service_role ALL policy (Core API service-role writes; GraphRAG reads)
-- All tables are tenant-safe (owner-scoped by user_id). Idempotent (IF NOT EXISTS).

CREATE SCHEMA IF NOT EXISTS finance;

-- ── helper: apply the standard owner+service RLS to a finance table ──────────
-- (inlined per table below; Postgres has no parameterized DDL macro)

-- 1. financial_recommendations — the persisted, governed, replayable recommendation.
CREATE TABLE IF NOT EXISTS finance.financial_recommendations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL,
  tenant_id           UUID NOT NULL,
  title               TEXT NOT NULL,
  description         TEXT,
  recommendation_type TEXT NOT NULL,                 -- debt_optimization | emergency_fund | cash_flow | budget_leakage | retirement_gap
  priority            TEXT NOT NULL DEFAULT 'medium', -- high | medium | low
  confidence          NUMERIC(4,3) NOT NULL DEFAULT 0.5,
  governance_verdict  JSONB NOT NULL DEFAULT '{}'::jsonb,
  status              TEXT NOT NULL DEFAULT 'active', -- active | accepted | rejected | dismissed | superseded
  evidence_json       JSONB NOT NULL DEFAULT '[]'::jsonb,
  assumptions_json    JSONB NOT NULL DEFAULT '[]'::jsonb,
  tradeoffs_json      JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_tables       TEXT[] NOT NULL DEFAULT '{}',
  source_graph_nodes  TEXT[] NOT NULL DEFAULT '{}',
  derived_by          TEXT NOT NULL DEFAULT 'finance-recommendation-engine',
  addresses_entity_type TEXT,                         -- goal | debt | budget_category | insurance_need
  addresses_entity_id   UUID,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at         TIMESTAMPTZ,
  rejected_at         TIMESTAMPTZ,
  dismissed_at        TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_fin_recs_user ON finance.financial_recommendations(user_id);
CREATE INDEX IF NOT EXISTS idx_fin_recs_type ON finance.financial_recommendations(user_id, recommendation_type);

-- 2. liabilities
CREATE TABLE IF NOT EXISTS finance.liabilities (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL,
  name            TEXT NOT NULL,
  liability_type  TEXT NOT NULL DEFAULT 'other',
  balance         NUMERIC(18,2) NOT NULL DEFAULT 0,
  interest_rate   NUMERIC(6,4),
  minimum_payment NUMERIC(18,2),
  currency        TEXT NOT NULL DEFAULT 'USD',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_liabilities_user ON finance.liabilities(user_id);

-- 3. debts (finance.debts was defined in 062 but never applied to prod; define here)
CREATE TABLE IF NOT EXISTS finance.debts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL,
  debt_name       TEXT NOT NULL,
  debt_type       TEXT NOT NULL DEFAULT 'other',
  balance         NUMERIC(18,2) NOT NULL DEFAULT 0,
  apr             NUMERIC(6,4),
  minimum_payment NUMERIC(18,2),
  due_day         SMALLINT,
  secured_asset_id UUID,                 -- extension point for (:Debt)-[:SECURED_BY]->(:Asset)
  currency        TEXT NOT NULL DEFAULT 'USD',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_debts_user ON finance.debts(user_id);

-- 4. cash_flow_snapshots
CREATE TABLE IF NOT EXISTS finance.cash_flow_snapshots (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL,
  period_start   DATE NOT NULL,
  period_end     DATE NOT NULL,
  total_income   NUMERIC(18,2) NOT NULL DEFAULT 0,
  total_expenses NUMERIC(18,2) NOT NULL DEFAULT 0,
  net_cash_flow  NUMERIC(18,2) NOT NULL DEFAULT 0,
  currency       TEXT NOT NULL DEFAULT 'USD',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cashflow_user ON finance.cash_flow_snapshots(user_id, period_end);

-- 5. net_worth_snapshots
CREATE TABLE IF NOT EXISTS finance.net_worth_snapshots (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL,
  as_of_date        DATE NOT NULL,
  total_assets      NUMERIC(18,2) NOT NULL DEFAULT 0,
  total_liabilities NUMERIC(18,2) NOT NULL DEFAULT 0,
  net_worth         NUMERIC(18,2) NOT NULL DEFAULT 0,
  currency          TEXT NOT NULL DEFAULT 'USD',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_networth_user ON finance.net_worth_snapshots(user_id, as_of_date);

-- 6. budget_categories
CREATE TABLE IF NOT EXISTS finance.budget_categories (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL,
  name          TEXT NOT NULL,
  category_type TEXT NOT NULL DEFAULT 'discretionary',
  monthly_limit NUMERIC(18,2),
  currency      TEXT NOT NULL DEFAULT 'USD',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_budgetcat_user ON finance.budget_categories(user_id);

-- 7. income_sources
CREATE TABLE IF NOT EXISTS finance.income_sources (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL,
  name           TEXT NOT NULL,
  source_type    TEXT NOT NULL DEFAULT 'salary',
  monthly_amount NUMERIC(18,2),
  currency       TEXT NOT NULL DEFAULT 'USD',
  is_active      BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_income_user ON finance.income_sources(user_id);

-- 8. expense_categories
CREATE TABLE IF NOT EXISTS finance.expense_categories (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL,
  name            TEXT NOT NULL,
  parent_category TEXT,
  is_essential    BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_expcat_user ON finance.expense_categories(user_id);

-- 9. financial_events
CREATE TABLE IF NOT EXISTS finance.financial_events (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL,
  event_type          TEXT NOT NULL,
  event_date          DATE NOT NULL DEFAULT current_date,
  amount              NUMERIC(18,2),
  description         TEXT,
  related_entity_type TEXT,
  related_entity_id   UUID,
  currency            TEXT NOT NULL DEFAULT 'USD',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_finevents_user ON finance.financial_events(user_id, event_date);

-- ── RLS: owner isolation + service-role write, applied uniformly ─────────────
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'financial_recommendations','liabilities','debts','cash_flow_snapshots',
    'net_worth_snapshots','budget_categories','income_sources','expense_categories','financial_events'
  ] LOOP
    EXECUTE format('ALTER TABLE finance.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE finance.%I FORCE ROW LEVEL SECURITY', t);
    -- owner ALL (read + write own rows)
    EXECUTE format($p$DROP POLICY IF EXISTS users_own_%1$s ON finance.%1$I$p$, t);
    EXECUTE format(
      'CREATE POLICY users_own_%1$s ON finance.%1$I FOR ALL TO authenticated '
      'USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())', t);
    -- service_role ALL (Core API writes; GraphRAG enqueue reads)
    EXECUTE format($p$DROP POLICY IF EXISTS service_%1$s ON finance.%1$I$p$, t);
    EXECUTE format(
      'CREATE POLICY service_%1$s ON finance.%1$I FOR ALL TO service_role '
      'USING (true) WITH CHECK (true)', t);
    -- grants
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON finance.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON finance.%I TO service_role', t);
  END LOOP;
END $$;

-- ── security_invoker public read view for the user-facing recommendations ────
-- (frontend/chat read path; honors the caller's RLS, not the view owner's)
DROP VIEW IF EXISTS public.v_financial_recommendations;
CREATE VIEW public.v_financial_recommendations
  WITH (security_invoker = true) AS
  SELECT id, user_id, title, description, recommendation_type, priority, confidence,
         governance_verdict, status, evidence_json, assumptions_json, tradeoffs_json,
         addresses_entity_type, addresses_entity_id, created_at, updated_at,
         accepted_at, rejected_at, dismissed_at
  FROM finance.financial_recommendations;
GRANT SELECT ON public.v_financial_recommendations TO authenticated;

-- NOTE: NO triggers in this migration. GraphRAG enqueue triggers for these tables
-- are deferred to a post-worker-enum migration (enum-before-trigger).
