-- ==========================================================================
-- 031: Finance Domain
-- Full financial tables: accounts, transactions, assets, tax, retirement,
-- investments, employer benefits. All with RLS and encryption.
-- ==========================================================================

-- Financial accounts (bank, credit, investment, retirement, loan)
CREATE TABLE IF NOT EXISTS finance.financial_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  account_name TEXT NOT NULL,
  account_type TEXT NOT NULL, -- checking, savings, credit_card, investment, retirement, loan, mortgage
  institution_name TEXT,
  account_number_encrypted TEXT, -- encrypted via core.encrypt_text
  routing_number_encrypted TEXT,
  current_balance NUMERIC NOT NULL DEFAULT 0,
  available_balance NUMERIC,
  currency TEXT NOT NULL DEFAULT 'USD',
  interest_rate NUMERIC,
  credit_limit NUMERIC,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_manual BOOLEAN NOT NULL DEFAULT TRUE,
  plaid_account_id TEXT,
  last_synced_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_fin_accounts_user ON finance.financial_accounts(user_id, is_active);
CREATE INDEX idx_fin_accounts_type ON finance.financial_accounts(user_id, account_type);

ALTER TABLE finance.financial_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_accounts" ON finance.financial_accounts
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "service_accounts" ON finance.financial_accounts
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Transactions (extends the basic transactions_inbox with full detail)
CREATE TABLE IF NOT EXISTS finance.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  account_id UUID REFERENCES finance.financial_accounts(id) ON DELETE SET NULL,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  transaction_date DATE NOT NULL,
  description TEXT,
  merchant TEXT,
  category TEXT,
  subcategory TEXT,
  transaction_type TEXT NOT NULL DEFAULT 'expense', -- income, expense, transfer, investment
  is_recurring BOOLEAN NOT NULL DEFAULT FALSE,
  recurrence_rule TEXT,
  plaid_transaction_id TEXT,
  notes TEXT,
  tags TEXT[],
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_transactions_user_date ON finance.transactions(user_id, transaction_date DESC);
CREATE INDEX idx_transactions_account ON finance.transactions(account_id, transaction_date DESC);
CREATE INDEX idx_transactions_category ON finance.transactions(user_id, category);

ALTER TABLE finance.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_txns" ON finance.transactions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "service_txns" ON finance.transactions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Assets (real estate, vehicles, crypto, collectibles)
CREATE TABLE IF NOT EXISTS finance.assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  asset_name TEXT NOT NULL,
  asset_type TEXT NOT NULL, -- real_estate, vehicle, crypto, collectible, other
  current_value NUMERIC NOT NULL DEFAULT 0,
  purchase_price NUMERIC,
  purchase_date DATE,
  description TEXT,
  location TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_assets_user ON finance.assets(user_id);

ALTER TABLE finance.assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_assets" ON finance.assets
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Asset loans (mortgages, auto loans, HELOCs)
CREATE TABLE IF NOT EXISTS finance.asset_loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES finance.assets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  loan_type TEXT NOT NULL, -- mortgage, auto, heloc, personal
  lender TEXT,
  original_amount NUMERIC NOT NULL,
  current_balance NUMERIC NOT NULL,
  interest_rate NUMERIC NOT NULL,
  monthly_payment NUMERIC,
  start_date DATE,
  end_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE finance.asset_loans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_loans" ON finance.asset_loans
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Investment holdings
CREATE TABLE IF NOT EXISTS finance.investment_holdings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  account_id UUID REFERENCES finance.financial_accounts(id) ON DELETE SET NULL,
  symbol TEXT NOT NULL,
  name TEXT,
  quantity NUMERIC NOT NULL,
  cost_basis NUMERIC,
  current_price NUMERIC,
  current_value NUMERIC,
  asset_class TEXT, -- stock, bond, etf, mutual_fund, crypto, reit
  sector TEXT,
  purchase_date DATE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_holdings_user ON finance.investment_holdings(user_id);
CREATE INDEX idx_holdings_account ON finance.investment_holdings(account_id);

ALTER TABLE finance.investment_holdings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_holdings" ON finance.investment_holdings
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Financial goals (savings targets, debt payoff)
CREATE TABLE IF NOT EXISTS finance.financial_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  goal_id UUID REFERENCES public.goals(id) ON DELETE SET NULL,
  goal_type TEXT NOT NULL, -- savings, debt_payoff, investment, emergency_fund
  target_amount NUMERIC NOT NULL,
  current_amount NUMERIC NOT NULL DEFAULT 0,
  account_id UUID REFERENCES finance.financial_accounts(id) ON DELETE SET NULL,
  target_date DATE,
  monthly_contribution NUMERIC,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE finance.financial_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_fin_goals" ON finance.financial_goals
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Plaid items (link tokens / access tokens)
CREATE TABLE IF NOT EXISTS finance.plaid_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plaid_item_id TEXT NOT NULL UNIQUE,
  access_token_encrypted TEXT NOT NULL,
  institution_id TEXT,
  institution_name TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  consent_expires_at TIMESTAMPTZ,
  error_code TEXT,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE finance.plaid_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_plaid" ON finance.plaid_items
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "service_plaid" ON finance.plaid_items
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Tax profile
CREATE TABLE IF NOT EXISTS finance.tax_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tax_year INT NOT NULL,
  filing_status TEXT NOT NULL, -- single, married_filing_jointly, married_filing_separately, head_of_household
  dependents INT NOT NULL DEFAULT 0,
  state TEXT,
  estimated_income NUMERIC,
  estimated_tax_liability NUMERIC,
  effective_tax_rate NUMERIC,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, tax_year)
);

ALTER TABLE finance.tax_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_tax" ON finance.tax_profiles
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Employer benefits
CREATE TABLE IF NOT EXISTS finance.employer_benefits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  employer_name TEXT NOT NULL,
  salary NUMERIC,
  bonus_target NUMERIC,
  stock_grants JSONB DEFAULT '{}',
  retirement_match_percent NUMERIC,
  retirement_match_limit NUMERIC,
  health_benefits JSONB DEFAULT '{}',
  additional_benefits JSONB DEFAULT '{}',
  is_current BOOLEAN NOT NULL DEFAULT TRUE,
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE finance.employer_benefits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_employer" ON finance.employer_benefits
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Retirement plans
CREATE TABLE IF NOT EXISTS finance.retirement_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_name TEXT NOT NULL DEFAULT 'My Retirement Plan',
  target_retirement_age INT,
  target_annual_income NUMERIC,
  current_savings NUMERIC NOT NULL DEFAULT 0,
  monthly_contribution NUMERIC NOT NULL DEFAULT 0,
  expected_return_rate NUMERIC NOT NULL DEFAULT 0.07,
  inflation_rate NUMERIC NOT NULL DEFAULT 0.03,
  social_security_estimate NUMERIC,
  pension_estimate NUMERIC,
  withdrawal_strategy TEXT DEFAULT '4_percent',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE finance.retirement_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_retirement" ON finance.retirement_plans
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Updated_at triggers for all finance tables
CREATE TRIGGER set_financial_accounts_updated_at BEFORE UPDATE ON finance.financial_accounts
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
CREATE TRIGGER set_transactions_updated_at BEFORE UPDATE ON finance.transactions
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
CREATE TRIGGER set_assets_updated_at BEFORE UPDATE ON finance.assets
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
CREATE TRIGGER set_asset_loans_updated_at BEFORE UPDATE ON finance.asset_loans
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
CREATE TRIGGER set_holdings_updated_at BEFORE UPDATE ON finance.investment_holdings
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
CREATE TRIGGER set_fin_goals_updated_at BEFORE UPDATE ON finance.financial_goals
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
CREATE TRIGGER set_plaid_items_updated_at BEFORE UPDATE ON finance.plaid_items
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
CREATE TRIGGER set_tax_profiles_updated_at BEFORE UPDATE ON finance.tax_profiles
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
CREATE TRIGGER set_employer_benefits_updated_at BEFORE UPDATE ON finance.employer_benefits
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
CREATE TRIGGER set_retirement_plans_updated_at BEFORE UPDATE ON finance.retirement_plans
  FOR EACH ROW EXECUTE FUNCTION core.set_updated_at();
