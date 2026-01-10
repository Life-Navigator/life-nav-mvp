# Schema Cleanup Plan - Pre-Launch

**Date**: 2026-01-09
**Status**: 🔧 **READY TO EXECUTE** - No data to migrate
**Objective**: Clean schemas before launch, add win prob + market context fields

---

## Executive Summary

✅ **Good News**: Supabase schema is already 95% clean!
- Migration 003 already dropped all sensitive tables (health_records, financial_accounts, transactions)
- Current schema only has category references ('health', 'finance') - not actual data
- Scenario Lab references document types (metadata only)

🔧 **Minor Fixes Needed**:
1. Add win probability fields to scenario results
2. Add market context fields for risk assessments
3. Document the intended data boundaries clearly
4. Add any missing indexes for performance

---

## Current Schema Status

### ✅ **Supabase - Already Clean** (No PHI/PCI Data)

| Table Category | Tables | Sensitive Data? | Action |
|----------------|--------|-----------------|--------|
| **User/Profile** | profiles, user_preferences, user_progress | No - display names, UI settings | ✅ Keep as-is |
| **Goals** | goals, goal_milestones | No - titles, categories only | ✅ Keep (dgx_goal_id references backend) |
| **Gamification** | achievements, user_achievements, challenges, user_challenges | No - XP, badges, streaks | ✅ Keep as-is |
| **Habits** | habits, habit_completions | No - habit names, check-ins | ✅ Keep as-is |
| **Notifications** | user_notifications, notification_templates, reminders | No - UI notifications | ✅ Keep as-is |
| **Activity** | activity_logs, ai_sessions | No - engagement tracking | ✅ Keep as-is |
| **Scenario Lab** | scenario_labs, scenario_versions, scenario_sim_runs, etc. | **Metadata only** | ✅ Keep + enhance |
| **Storage** | file_uploads, user_storage_usage | No - file metadata, quotas | ✅ Keep as-is |
| **Community** | waitlist_entries, referrals, feedback | No - emails, referral codes | ✅ Keep as-is |

### ❌ **Dropped Tables** (Migration 003 - Already Executed)

These were correctly removed:
- `health_metrics` - Moved to backend HIPAA DB
- `health_records` - Moved to backend HIPAA DB
- `financial_goals` - Moved to backend Financial DB
- `transactions` - Moved to backend Financial DB
- `financial_accounts` - Moved to backend Financial DB
- `accounts` - Moved to backend Financial DB

---

## Schema Enhancements Needed

### 1. **Add Win Probability Fields** (Scenario Lab)

#### **Table: scenario_goal_snapshots**

**Current fields**:
```sql
CREATE TABLE public.scenario_goal_snapshots (
  id UUID PRIMARY KEY,
  sim_run_id UUID REFERENCES scenario_sim_runs(id),
  goal_id UUID NOT NULL,
  goal_title TEXT NOT NULL,

  -- Current fields
  probability_series JSONB,  -- Array of probabilities over time
  final_success_probability FLOAT,
  status TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Add these fields**:
```sql
ALTER TABLE public.scenario_goal_snapshots
  ADD COLUMN probability_distribution JSONB,  -- Histogram bins: {0-10%: count, 10-20%: count, ...}
  ADD COLUMN confidence_interval_95_low FLOAT,  -- 95% CI lower bound
  ADD COLUMN confidence_interval_95_high FLOAT,  -- 95% CI upper bound
  ADD COLUMN median_outcome FLOAT,  -- 50th percentile result
  ADD COLUMN worst_case_10th_percentile FLOAT,  -- Downside risk
  ADD COLUMN best_case_90th_percentile FLOAT,  -- Upside potential
  ADD COLUMN volatility_score FLOAT,  -- Standard deviation of outcomes
  ADD COLUMN robustness_grade TEXT CHECK (robustness_grade IN ('A', 'B', 'C', 'D', 'F'));  -- Letter grade

COMMENT ON COLUMN scenario_goal_snapshots.probability_distribution IS 'Monte Carlo outcome histogram for visualization';
COMMENT ON COLUMN scenario_goal_snapshots.confidence_interval_95_low IS '95% confidence interval lower bound (5th percentile)';
COMMENT ON COLUMN scenario_goal_snapshots.confidence_interval_95_high IS '95% confidence interval upper bound (95th percentile)';
COMMENT ON COLUMN scenario_goal_snapshots.median_outcome IS '50th percentile (median) outcome from simulation';
COMMENT ON COLUMN scenario_goal_snapshots.robustness_grade IS 'Letter grade: A (>90%), B (75-90%), C (60-75%), D (50-60%), F (<50%)';
```

---

### 2. **Add Market Context Fields** (Risk Assessment)

#### **Table: scenario_sim_runs**

**Current fields**:
```sql
CREATE TABLE public.scenario_sim_runs (
  id UUID PRIMARY KEY,
  scenario_version_id UUID REFERENCES scenario_versions(id),
  user_id UUID NOT NULL,

  model_version TEXT NOT NULL,
  seed BIGINT NOT NULL,
  iterations INT DEFAULT 10000,
  inputs_hash TEXT NOT NULL,

  overall_robustness_score FLOAT,
  goals_simulated INT,
  status TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Add these fields**:
```sql
ALTER TABLE public.scenario_sim_runs
  ADD COLUMN market_snapshot_id UUID,  -- Reference to backend market_context_snapshots
  ADD COLUMN market_snapshot_date DATE,  -- Which market data was used
  ADD COLUMN inflation_rate_used FLOAT,  -- CPI at time of simulation
  ADD COLUMN sp500_volatility_used FLOAT,  -- VIX or realized vol
  ADD COLUMN treasury_10y_yield_used FLOAT,  -- Risk-free rate proxy
  ADD COLUMN market_regime TEXT CHECK (market_regime IN ('bull', 'bear', 'sideways', 'volatile', 'unknown')),
  ADD COLUMN economic_conditions JSONB,  -- {unemployment_rate, gdp_growth, etc.}
  ADD COLUMN market_adjusted_probability FLOAT;  -- Overall prob adjusted for current market

CREATE INDEX idx_scenario_sim_runs_market_date ON public.scenario_sim_runs(market_snapshot_date);

COMMENT ON COLUMN scenario_sim_runs.market_snapshot_id IS 'Reference to backend market_context_snapshots table (not in Supabase)';
COMMENT ON COLUMN scenario_sim_runs.market_regime IS 'Classified market environment at simulation time';
COMMENT ON COLUMN scenario_sim_runs.economic_conditions IS 'Snapshot of economic indicators used in risk model';
```

---

### 3. **Add Scenario Comparison Fields** (Scenario Lab V2)

#### **Table: scenario_versions**

**Current fields**:
```sql
CREATE TABLE public.scenario_versions (
  id UUID PRIMARY KEY,
  scenario_id UUID REFERENCES scenario_labs(id),
  user_id UUID NOT NULL,

  version_number INT NOT NULL,
  version_label TEXT,
  is_committed BOOLEAN DEFAULT FALSE,
  inputs_hash TEXT NOT NULL,

  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Add these fields**:
```sql
ALTER TABLE public.scenario_versions
  ADD COLUMN parent_version_id UUID REFERENCES scenario_versions(id),  -- For branching
  ADD COLUMN branch_name TEXT,  -- "Optimistic", "Conservative", etc.
  ADD COLUMN comparison_notes TEXT,  -- User notes on why this variation
  ADD COLUMN is_baseline BOOLEAN DEFAULT FALSE;  -- Mark one as baseline for comparisons

CREATE INDEX idx_scenario_versions_parent ON public.scenario_versions(parent_version_id);

COMMENT ON COLUMN scenario_versions.parent_version_id IS 'For scenario branching - which version was this forked from';
COMMENT ON COLUMN scenario_versions.is_baseline IS 'User can mark one version as baseline for side-by-side comparisons';
```

---

### 4. **Add Missing Indexes** (Performance)

```sql
-- Scenario Lab performance indexes
CREATE INDEX IF NOT EXISTS idx_scenario_labs_user_status ON public.scenario_labs(user_id, status);
CREATE INDEX IF NOT EXISTS idx_scenario_sim_runs_status ON public.scenario_sim_runs(status);
CREATE INDEX IF NOT EXISTS idx_scenario_goal_snapshots_goal ON public.scenario_goal_snapshots(goal_id);
CREATE INDEX IF NOT EXISTS idx_scenario_documents_ocr_status ON public.scenario_documents(ocr_status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_scenario_extracted_fields_approval ON public.scenario_extracted_fields(approval_status);

-- Activity tracking indexes
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_date ON public.activity_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_sessions_user ON public.ai_sessions(user_id, created_at DESC);

-- Gamification indexes
CREATE INDEX IF NOT EXISTS idx_user_challenges_status ON public.user_challenges(user_id, status);
CREATE INDEX IF NOT EXISTS idx_habit_completions_date ON public.habit_completions(habit_id, completed_date DESC);
```

---

## Backend Schema Enhancements

### **New Table: market_context_snapshots** (Backend Financial DB)

This stores daily market data for risk calculations.

**Location**: `backend/app/db/migrations/financial/002_create_market_context.sql`

```sql
-- ============================================================================
-- Market Context Snapshots (Daily Market Data for Risk Calculations)
-- ============================================================================
-- This table stores daily snapshots of market conditions used by the risk engine.
-- Data sources: FRED (Federal Reserve Economic Data), Stooq (market prices)
-- ============================================================================

CREATE TABLE market_context_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Date
  snapshot_date DATE NOT NULL UNIQUE,

  -- Interest Rates
  treasury_1m_yield FLOAT,  -- 1-month Treasury (cash proxy)
  treasury_3m_yield FLOAT,  -- 3-month Treasury
  treasury_6m_yield FLOAT,  -- 6-month Treasury
  treasury_1y_yield FLOAT,  -- 1-year Treasury
  treasury_2y_yield FLOAT,  -- 2-year Treasury
  treasury_5y_yield FLOAT,  -- 5-year Treasury
  treasury_10y_yield FLOAT,  -- 10-year Treasury (benchmark)
  treasury_30y_yield FLOAT,  -- 30-year Treasury

  -- Fed Rates
  fed_funds_rate FLOAT,  -- Federal Funds Rate
  sofr_rate FLOAT,  -- Secured Overnight Financing Rate

  -- Inflation
  cpi_annual FLOAT,  -- Consumer Price Index (YoY %)
  pce_annual FLOAT,  -- Personal Consumption Expenditures (YoY %)
  breakeven_5y FLOAT,  -- 5-year breakeven inflation rate
  breakeven_10y FLOAT,  -- 10-year breakeven inflation rate

  -- Equity Markets
  sp500_price FLOAT,  -- S&P 500 index level
  sp500_return_1d FLOAT,  -- 1-day return (%)
  sp500_return_1m FLOAT,  -- 1-month return (%)
  sp500_volatility_30d FLOAT,  -- 30-day realized volatility
  vix_close FLOAT,  -- VIX (implied volatility)

  nasdaq_price FLOAT,  -- NASDAQ index
  russell_2000_price FLOAT,  -- Small cap proxy

  -- Credit Spreads
  baa_aaa_spread FLOAT,  -- Corporate credit spread (FRED)
  high_yield_spread FLOAT,  -- High-yield spread over treasuries

  -- FX (Major Pairs)
  usd_eur FLOAT,  -- EUR/USD
  usd_gbp FLOAT,  -- GBP/USD
  usd_jpy FLOAT,  -- USD/JPY
  usd_cny FLOAT,  -- USD/CNY

  -- Commodities (Optional)
  gold_price FLOAT,  -- Gold (USD/oz)
  oil_wti_price FLOAT,  -- WTI Crude Oil

  -- Crypto (Optional)
  btc_price FLOAT,  -- Bitcoin
  eth_price FLOAT,  -- Ethereum

  -- Economic Indicators
  unemployment_rate FLOAT,  -- U.S. unemployment rate (%)
  gdp_growth_quarterly FLOAT,  -- Real GDP growth (QoQ %)
  gdp_growth_annual FLOAT,  -- Real GDP growth (YoY %)

  -- Market Regime Classification (Computed)
  market_regime TEXT CHECK (market_regime IN ('bull', 'bear', 'sideways', 'volatile', 'unknown')),
  risk_environment TEXT CHECK (risk_environment IN ('low', 'moderate', 'elevated', 'high', 'extreme')),

  -- Data Quality
  data_sources JSONB,  -- {"treasury_yields": "FRED", "sp500": "Stooq", ...}
  missing_fields JSONB,  -- List of fields that couldn't be fetched

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_market_snapshots_date ON market_context_snapshots(snapshot_date DESC);
CREATE INDEX idx_market_snapshots_regime ON market_context_snapshots(market_regime);

COMMENT ON TABLE market_context_snapshots IS 'Daily market data snapshots for risk-aware simulations';
COMMENT ON COLUMN market_context_snapshots.market_regime IS 'Auto-classified based on SP500 trends and VIX levels';
COMMENT ON COLUMN market_context_snapshots.risk_environment IS 'Overall risk classification based on spreads, volatility, and economic data';
```

---

## Migration Scripts

### **Migration: 008_add_win_probability_fields.sql**

**Location**: `apps/web/supabase/migrations/008_add_win_probability_fields.sql`

```sql
-- ============================================================================
-- Add Win Probability & Market Context Fields
-- ============================================================================
-- This migration enhances scenario lab tables with:
-- - Win probability distributions (Monte Carlo results)
-- - Market context awareness (economic conditions at sim time)
-- - Scenario branching (version forking)
-- ============================================================================

-- 1. Add win probability fields to goal snapshots
ALTER TABLE public.scenario_goal_snapshots
  ADD COLUMN IF NOT EXISTS probability_distribution JSONB,
  ADD COLUMN IF NOT EXISTS confidence_interval_95_low FLOAT,
  ADD COLUMN IF NOT EXISTS confidence_interval_95_high FLOAT,
  ADD COLUMN IF NOT EXISTS median_outcome FLOAT,
  ADD COLUMN IF NOT EXISTS worst_case_10th_percentile FLOAT,
  ADD COLUMN IF NOT EXISTS best_case_90th_percentile FLOAT,
  ADD COLUMN IF NOT EXISTS volatility_score FLOAT,
  ADD COLUMN IF NOT EXISTS robustness_grade TEXT CHECK (robustness_grade IN ('A', 'B', 'C', 'D', 'F'));

-- 2. Add market context fields to simulation runs
ALTER TABLE public.scenario_sim_runs
  ADD COLUMN IF NOT EXISTS market_snapshot_id UUID,
  ADD COLUMN IF NOT EXISTS market_snapshot_date DATE,
  ADD COLUMN IF NOT EXISTS inflation_rate_used FLOAT,
  ADD COLUMN IF NOT EXISTS sp500_volatility_used FLOAT,
  ADD COLUMN IF NOT EXISTS treasury_10y_yield_used FLOAT,
  ADD COLUMN IF NOT EXISTS market_regime TEXT CHECK (market_regime IN ('bull', 'bear', 'sideways', 'volatile', 'unknown')),
  ADD COLUMN IF NOT EXISTS economic_conditions JSONB,
  ADD COLUMN IF NOT EXISTS market_adjusted_probability FLOAT;

-- 3. Add scenario branching fields
ALTER TABLE public.scenario_versions
  ADD COLUMN IF NOT EXISTS parent_version_id UUID REFERENCES public.scenario_versions(id),
  ADD COLUMN IF NOT EXISTS branch_name TEXT,
  ADD COLUMN IF NOT EXISTS comparison_notes TEXT,
  ADD COLUMN IF NOT EXISTS is_baseline BOOLEAN DEFAULT FALSE;

-- 4. Add performance indexes
CREATE INDEX IF NOT EXISTS idx_scenario_sim_runs_market_date ON public.scenario_sim_runs(market_snapshot_date);
CREATE INDEX IF NOT EXISTS idx_scenario_versions_parent ON public.scenario_versions(parent_version_id);
CREATE INDEX IF NOT EXISTS idx_scenario_goal_snapshots_goal ON public.scenario_goal_snapshots(goal_id);

-- 5. Add comments
COMMENT ON COLUMN scenario_goal_snapshots.probability_distribution IS 'Monte Carlo outcome histogram for visualization';
COMMENT ON COLUMN scenario_goal_snapshots.robustness_grade IS 'Letter grade: A (>90%), B (75-90%), C (60-75%), D (50-60%), F (<50%)';
COMMENT ON COLUMN scenario_sim_runs.market_snapshot_id IS 'Reference to backend market_context_snapshots table';
COMMENT ON COLUMN scenario_sim_runs.market_regime IS 'Classified market environment at simulation time';
COMMENT ON COLUMN scenario_versions.parent_version_id IS 'For scenario branching - which version was this forked from';
```

---

## Data Boundary Documentation

### **What STAYS in Supabase** (Safe for Cloud)

✅ **User Preferences & UI State**
- Display names, avatars, theme preferences
- Dashboard layouts, widget configurations
- Notification settings, email preferences

✅ **Goal Metadata Only**
- Goal titles, categories, icons, colors
- Progress percentages, XP earned
- **NOT actual financial targets** (stored in backend via `dgx_goal_id`)

✅ **Gamification & Engagement**
- Achievements unlocked, XP totals, level
- Habit check-ins (titles only, not health details)
- Streaks, leaderboards, challenges

✅ **Scenario Lab Metadata**
- Scenario names, descriptions, versions
- Simulation run metadata (iterations, model version)
- **Win probability results** (aggregated only, not raw data)
- **Market context references** (dates, not account details)
- Document **filenames** and **types** (not content)
- OCR extracted fields **after redaction**

---

### **What NEVER Goes to Supabase** (Backend Only)

❌ **Health Data (HIPAA)**
- Diagnoses, conditions, ICD-10 codes
- Medications, dosages, prescriptions
- Allergies, reactions
- Vital signs, lab results, medical visits
- **Stored in**: `backend` HIPAA database

❌ **Financial Data (PCI)**
- Account numbers, routing numbers
- Credit card numbers, CVV
- Transaction details (amounts, merchants)
- Balances, credit limits
- **Stored in**: `backend` Financial database

❌ **Personally Identifiable Info (PII)**
- SSN, driver's license numbers
- Passport numbers
- Date of birth (exact - age ranges OK)
- Full addresses (city/state OK)

---

## Execution Plan

### **Phase 1: Schema Cleanup** (This Week - No Data Impact)

1. ✅ **Verify current state** (Done - schemas already clean!)
2. 🔧 **Create migration 008** - Win prob + market context fields
3. 🔧 **Create backend migration 002** - Market context snapshots table
4. ✅ **Test migrations** on local Supabase
5. ✅ **Apply to staging Supabase**
6. ✅ **Deploy to production Supabase** (no existing data, safe)

### **Phase 2: Market Data Pipeline** (Next Sprint)

1. Implement market data ingestion service
2. Daily cron job (FRED + Stooq APIs)
3. Populate `market_context_snapshots` table
4. Build internal API for risk engine

### **Phase 3: Feature Implementation** (Sprint After)

1. Update risk engine to use market context
2. Implement Monte Carlo simulations (win probability)
3. Add probability distribution charts to frontend
4. Add scenario branching UI

---

## Verification Checklist

Before launch, verify:

- [ ] No PHI/PCI tables in Supabase migrations
- [ ] All sensitive tables dropped (health_records, financial_accounts, etc.)
- [ ] Win probability fields added to scenario_goal_snapshots
- [ ] Market context fields added to scenario_sim_runs
- [ ] Backend market_context_snapshots table created
- [ ] Data boundary middleware enforces PHI/PCI blocking
- [ ] RLS policies active on all Supabase tables
- [ ] Scenario document redaction working
- [ ] Audit logging captures all sensitive operations

---

**Status**: ✅ **Ready to execute** - Clean schemas, no data migration needed

**Next Step**: Create migration 008 and apply to Supabase
