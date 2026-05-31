-- ==========================================================================
-- 062: Financial Intake Expansion
--   * finance.user_financial_profile  — singleton summary per user
--   * finance.debts                   — non-asset debts (cards, student loans, etc.)
--   * finance.financing_preferences   — declarative: liquidity / debt vs invest
--   * ADD COLUMN IF NOT EXISTS on existing tables for fields we were missing
-- ==========================================================================

-- -------------------------------------------------------------------------
-- 1. finance.user_financial_profile  (one row per user)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS finance.user_financial_profile (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Income
  annual_income NUMERIC,
  income_stability TEXT
    CHECK (income_stability IS NULL OR income_stability IN ('very_stable', 'stable', 'variable', 'unstable')),
  employment_type TEXT
    CHECK (employment_type IS NULL OR employment_type IN (
      'w2_full_time', 'w2_part_time', 'self_employed', '1099_contractor',
      'business_owner', 'unemployed', 'retired', 'student', 'other'
    )),
  household_size INT CHECK (household_size IS NULL OR household_size >= 1),
  spouse_annual_income NUMERIC,
  household_annual_income NUMERIC,                  -- derived or self-reported

  -- Expenses
  monthly_expenses NUMERIC,
  monthly_discretionary_income NUMERIC,
  emergency_fund_amount NUMERIC,
  emergency_fund_months NUMERIC,                     -- months of expenses covered

  -- Credit
  credit_score_range TEXT
    CHECK (credit_score_range IS NULL OR credit_score_range IN (
      'below_580', '580_669', '670_739', '740_799', '800_plus', 'unknown'
    )),
  credit_card_utilization NUMERIC(5,2)               -- 0..100 (percent)
    CHECK (credit_card_utilization IS NULL OR credit_card_utilization BETWEEN 0 AND 100),

  -- Tax-advantaged accounts
  hsa_eligible BOOLEAN,
  hsa_current_balance NUMERIC,
  fsa_eligible BOOLEAN,
  fsa_election_amount NUMERIC,

  -- Employer benefits
  employer_match_percent NUMERIC,
  employer_match_limit_percent NUMERIC,              -- e.g. matches up to 6% of salary
  has_pension BOOLEAN DEFAULT FALSE,
  pension_type TEXT,                                 -- 'defined_benefit' | 'defined_contribution'

  -- Insurance premiums (high-level monthly cost)
  monthly_insurance_premiums NUMERIC,

  -- Tax estimate
  estimated_marginal_tax_bracket NUMERIC,            -- e.g. 0.24
  estimated_effective_tax_rate NUMERIC,

  -- Institution preferences
  current_bank TEXT,
  current_brokerage TEXT,
  preferred_financial_institution TEXT,

  -- Bookkeeping
  source TEXT NOT NULL DEFAULT 'onboarding',
  confidence_score NUMERIC(3,2)
    CHECK (confidence_score IS NULL OR (confidence_score BETWEEN 0 AND 1)),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_financial_profile_user
  ON finance.user_financial_profile(user_id);

ALTER TABLE finance.user_financial_profile ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ufp_owner_all" ON finance.user_financial_profile
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ufp_service_role" ON finance.user_financial_profile
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TRIGGER set_ufp_updated_at
  BEFORE UPDATE ON finance.user_financial_profile
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


-- -------------------------------------------------------------------------
-- 2. finance.debts  (non-asset debts: credit cards, student loans, etc.)
--    For asset-backed loans (mortgage, auto) the existing
--    finance.asset_loans table is the canonical home.
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS finance.debts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  debt_name TEXT NOT NULL,
  debt_type TEXT NOT NULL
    CHECK (debt_type IN (
      'credit_card', 'student_loan', 'personal_loan',
      'medical_debt', 'tax_debt', 'family_loan', 'business_loan', 'other'
    )),
  lender TEXT,
  original_amount NUMERIC,
  current_balance NUMERIC NOT NULL DEFAULT 0,
  interest_rate NUMERIC,                              -- APR as decimal (e.g. 0.2199)
  minimum_payment NUMERIC,
  payment_frequency TEXT DEFAULT 'monthly'
    CHECK (payment_frequency IN ('weekly', 'biweekly', 'monthly', 'quarterly', 'annual', 'other')),
  due_day INT CHECK (due_day IS NULL OR due_day BETWEEN 1 AND 31),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_deductible_interest BOOLEAN NOT NULL DEFAULT FALSE,
  payoff_strategy TEXT
    CHECK (payoff_strategy IS NULL OR payoff_strategy IN ('avalanche', 'snowball', 'minimum_only', 'consolidation', 'refinance', 'custom')),
  source TEXT NOT NULL DEFAULT 'onboarding',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_debts_user        ON finance.debts(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_debts_user_type   ON finance.debts(user_id, debt_type);

ALTER TABLE finance.debts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "debts_owner_all" ON finance.debts
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "debts_service_role" ON finance.debts
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TRIGGER set_debts_updated_at
  BEFORE UPDATE ON finance.debts
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


-- -------------------------------------------------------------------------
-- 3. finance.financing_preferences  (singleton)
--   * Liquidity preference (how much cash on hand)
--   * Debt-vs-invest-vs-save preference
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS finance.financing_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  liquidity_preference TEXT
    CHECK (liquidity_preference IS NULL OR liquidity_preference IN (
      'very_low', 'low', 'moderate', 'high', 'very_high'
    )),
  liquidity_target_months NUMERIC,                   -- months of expenses kept liquid
  debt_pay_weight NUMERIC(3,2)
    CHECK (debt_pay_weight IS NULL OR debt_pay_weight BETWEEN 0 AND 1),
  invest_weight NUMERIC(3,2)
    CHECK (invest_weight IS NULL OR invest_weight BETWEEN 0 AND 1),
  save_weight NUMERIC(3,2)
    CHECK (save_weight IS NULL OR save_weight BETWEEN 0 AND 1),
  notes TEXT,
  source TEXT NOT NULL DEFAULT 'onboarding',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE finance.financing_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fp_owner_all" ON finance.financing_preferences
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "fp_service_role" ON finance.financing_preferences
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TRIGGER set_fp_updated_at
  BEFORE UPDATE ON finance.financing_preferences
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();


-- -------------------------------------------------------------------------
-- 4. ADD COLUMN IF NOT EXISTS on existing finance tables for gaps surfaced
--    by the expanded intake.
-- -------------------------------------------------------------------------
ALTER TABLE finance.financial_accounts
  ADD COLUMN IF NOT EXISTS is_preferred BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS purpose TEXT,                    -- 'emergency_fund' | 'spending' | ...
  ADD COLUMN IF NOT EXISTS notes TEXT;

ALTER TABLE finance.employer_benefits
  ADD COLUMN IF NOT EXISTS hsa_eligible BOOLEAN,
  ADD COLUMN IF NOT EXISTS fsa_eligible BOOLEAN,
  ADD COLUMN IF NOT EXISTS hra_eligible BOOLEAN,
  ADD COLUMN IF NOT EXISTS has_pension BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS pension_type TEXT;

ALTER TABLE finance.tax_profiles
  ADD COLUMN IF NOT EXISTS marginal_bracket NUMERIC,        -- e.g. 0.24
  ADD COLUMN IF NOT EXISTS spouse_income NUMERIC;
