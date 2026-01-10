# Schema Fix Implementation Guide

**Date**: 2026-01-09
**Status**: ✅ **READY TO EXECUTE**
**Objective**: Fix schemas before launch, add win probability + market context

---

## 🎯 Executive Summary

**Good News**: Your schemas are already 95% clean!
- ✅ No PHI/PCI data in Supabase (migration 003 already dropped sensitive tables)
- ✅ Backend HIPAA and Financial DB schemas exist (just not populated yet)
- ✅ Data boundaries are already designed correctly

**What Needs to Be Done**:
1. Add win probability fields (Monte Carlo results, confidence intervals)
2. Add market context fields (economic conditions at simulation time)
3. Create market data table in backend (for risk calculations)
4. Add scenario branching support (version forking)

**Impact**: Zero data migration (no production data exists yet)

---

## 📊 Current State Analysis

### ✅ Supabase Schema - Already Clean

| Component | Status | Notes |
|-----------|--------|-------|
| Core tables (profiles, goals, habits) | ✅ Clean | No PHI/PCI - just UI state and metadata |
| Scenario Lab tables | ✅ Mostly clean | Document metadata only, redaction flags exist |
| Sensitive tables dropped | ✅ Done | Migration 003 removed health_records, financial_accounts, etc. |
| RLS policies | ✅ Active | User-level isolation working |
| Storage buckets | ✅ Configured | Private buckets with size/type limits |

### ⚠️ What's Missing (New Features)

| Feature | Current Status | Action Needed |
|---------|----------------|---------------|
| Win probability calculations | ❌ Not implemented | Add fields to `scenario_goal_snapshots` |
| Market context awareness | ❌ Not implemented | Add fields to `scenario_sim_runs` + backend table |
| Scenario branching | ❌ Not implemented | Add fields to `scenario_versions` |
| Market data storage | ❌ Not implemented | Create `market_context_snapshots` table (backend) |

---

## 🔧 Implementation Plan

### **Phase 1: Supabase Schema Enhancements** (This Week)

#### Migration 008: Add Win Probability & Market Context Fields

**File**: `apps/web/supabase/migrations/008_add_win_probability_fields.sql`

**Status**: ✅ Created (ready to apply)

**What it does**:
1. Adds Monte Carlo results to `scenario_goal_snapshots`:
   - Probability distribution (histogram for charts)
   - 95% confidence intervals
   - Median, best case, worst case outcomes
   - Volatility score
   - Robustness letter grade (A-F)

2. Adds market context to `scenario_sim_runs`:
   - Market snapshot reference
   - Inflation rate, volatility, yields
   - Market regime classification
   - Economic conditions snapshot

3. Adds scenario branching to `scenario_versions`:
   - Parent version tracking
   - Branch names
   - Baseline marking for comparisons

**How to apply**:
```bash
cd apps/web

# Option A: Via Supabase CLI (recommended)
npx supabase db push

# Option B: Via Supabase Dashboard
# - Go to SQL Editor
# - Copy/paste migration 008
# - Run

# Option C: Via psql
psql $DATABASE_URL -f supabase/migrations/008_add_win_probability_fields.sql
```

**Verification**:
```sql
-- Check new columns were added
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'scenario_goal_snapshots'
  AND column_name IN ('probability_distribution', 'robustness_grade', 'median_outcome');

-- Should return 3 rows
```

---

### **Phase 2: Backend Market Data Table** (This Week)

#### Migration 002: Create Market Context Snapshots

**File**: `backend/app/db/migrations/financial/002_create_market_context.sql`

**Status**: ✅ Created (ready to apply)

**What it does**:
- Creates `market_context_snapshots` table in Financial DB
- Stores daily market data (rates, prices, indicators)
- 50+ fields: treasuries, SP500, VIX, inflation, unemployment, etc.
- Auto-classifies market regime (bull/bear/sideways/volatile)
- Helper views for risk engine consumption

**How to apply**:
```bash
cd backend

# Connect to your Financial DB
export DATABASE_FINANCIAL_URL="postgresql://..."

# Apply migration
psql $DATABASE_FINANCIAL_URL -f app/db/migrations/financial/002_create_market_context.sql

# Or use Alembic if configured
alembic upgrade head
```

**Verification**:
```sql
-- Check table was created
\dt market_context_snapshots

-- Check views were created
\dv latest_market_snapshot
\dv market_regime_history
```

---

### **Phase 3: Market Data Ingestion Service** (Next Sprint)

**Implementation**: Daily cron job to populate market data

**File locations**:
- `backend/app/services/market_data/fred_client.py` - FRED API client
- `backend/app/services/market_data/stooq_client.py` - Stooq scraper
- `backend/app/services/market_data/ingestion.py` - Main ingestion logic
- `backend/app/cron/ingest_market_data.py` - Cron entry point

**Data sources**:
- **FRED (Federal Reserve)**: Treasury yields, inflation, GDP, unemployment
- **Stooq**: SP500, NASDAQ, VIX (free EOD data)
- **Optional**: Alpha Vantage, Yahoo Finance (if needed)

**Cron schedule**:
```bash
# Cloud Run scheduled job (recommended)
gcloud scheduler jobs create http market-data-ingestion \
  --schedule="0 18 * * 1-5" \  # 6pm UTC Mon-Fri (after market close)
  --uri="https://backend.run.app/api/v1/internal/market-data/ingest" \
  --http-method=POST

# Or via backend cron (if running 24/7)
# Add to app/cron/__init__.py
```

---

### **Phase 4: Risk Engine Integration** (Next Sprint)

**Implementation**: Update risk engine to use market context

**Files to modify**:
- `backend/app/services/risk_engine/monte_carlo.py` - Add market-aware simulations
- `backend/app/services/risk_engine/probability_calculator.py` - Calculate win probabilities
- `backend/app/services/risk_engine/market_adapter.py` - Fetch latest market data

**API flow**:
```
1. Frontend triggers simulation
2. Backend fetches latest market snapshot
3. Risk engine runs Monte Carlo with market context
4. Results stored in Supabase with market reference
5. Frontend displays probability distribution + confidence intervals
```

---

## 📋 Detailed Changes

### Supabase Tables Modified

#### **scenario_goal_snapshots** (Win Probability Results)

**New columns**:
```sql
probability_distribution JSONB         -- Histogram: {"bins": [...], "total": 10000}
confidence_interval_95_low FLOAT       -- 5th percentile (downside)
confidence_interval_95_high FLOAT      -- 95th percentile (upside)
median_outcome FLOAT                   -- 50th percentile
worst_case_10th_percentile FLOAT       -- 10th percentile
best_case_90th_percentile FLOAT        -- 90th percentile
volatility_score FLOAT                 -- Std dev of outcomes
robustness_grade TEXT                  -- A (≥90%), B (75-89%), C (60-74%), D (50-59%), F (<50%)
```

**Example data**:
```json
{
  "goal_id": "uuid-123",
  "goal_title": "Save $50k emergency fund",
  "final_success_probability": 0.78,
  "robustness_grade": "B",
  "median_outcome": 48500.00,
  "confidence_interval_95_low": 35000.00,
  "confidence_interval_95_high": 62000.00,
  "worst_case_10th_percentile": 30000.00,
  "best_case_90th_percentile": 70000.00,
  "volatility_score": 0.15,
  "probability_distribution": {
    "bins": [
      {"min": 30000, "max": 35000, "count": 150},
      {"min": 35000, "max": 40000, "count": 890},
      {"min": 40000, "max": 45000, "count": 2340},
      {"min": 45000, "max": 50000, "count": 3720},
      {"min": 50000, "max": 55000, "count": 1850},
      {"min": 55000, "max": 60000, "count": 780},
      {"min": 60000, "max": 65000, "count": 210},
      {"min": 65000, "max": 70000, "count": 60}
    ],
    "total_iterations": 10000
  }
}
```

---

#### **scenario_sim_runs** (Market Context)

**New columns**:
```sql
market_snapshot_id UUID                -- Reference to backend market_context_snapshots.id
market_snapshot_date DATE               -- Which trading day's data was used
inflation_rate_used FLOAT               -- CPI at simulation time
sp500_volatility_used FLOAT             -- VIX or realized vol
treasury_10y_yield_used FLOAT           -- Risk-free rate
market_regime TEXT                      -- 'bull', 'bear', 'sideways', 'volatile', 'unknown'
economic_conditions JSONB               -- Snapshot of other indicators
market_adjusted_probability FLOAT       -- Overall prob adjusted for current market
```

**Example data**:
```json
{
  "scenario_version_id": "uuid-456",
  "model_version": "v2.1.0",
  "iterations": 10000,
  "market_snapshot_id": "uuid-789",
  "market_snapshot_date": "2026-01-08",
  "inflation_rate_used": 3.2,
  "sp500_volatility_used": 15.8,
  "treasury_10y_yield_used": 4.25,
  "market_regime": "sideways",
  "economic_conditions": {
    "unemployment_rate": 3.7,
    "gdp_growth_annual": 2.1,
    "credit_spread_baa_aaa": 0.85
  },
  "overall_robustness_score": 0.72,
  "market_adjusted_probability": 0.68,
  "status": "completed"
}
```

---

#### **scenario_versions** (Branching)

**New columns**:
```sql
parent_version_id UUID                  -- Which version was this forked from
branch_name TEXT                        -- "Optimistic", "Conservative", etc.
comparison_notes TEXT                   -- User notes on why this variation
is_baseline BOOLEAN                     -- Mark one as baseline (only one per scenario)
```

**Example use case**:
```
Scenario: "Grad school or work?"
├── Version 1 (Baseline) - Current plan
├── Version 2 (Optimistic) - Scholarship + part-time job
└── Version 3 (Conservative) - Delay 1 year, save more
```

---

### Backend Tables Created

#### **market_context_snapshots** (Financial DB)

**Purpose**: Store daily market data for risk calculations

**Key fields**:
- Treasury yields (1m, 3m, 6m, 1y, 2y, 5y, 10y, 30y)
- Fed rates (fed funds, SOFR)
- Inflation (CPI, PCE, breakevens)
- Equity markets (SP500, NASDAQ, Russell 2000, VIX)
- Credit spreads (BAA-AAA, high yield)
- FX (EUR/USD, GBP/USD, JPY, CNY)
- Commodities (gold, oil - optional)
- Crypto (BTC, ETH - optional)
- Economic indicators (unemployment, GDP)
- Market regime classification (bull/bear/etc.)

**Sample row**:
```json
{
  "snapshot_date": "2026-01-08",
  "treasury_10y_yield": 4.25,
  "sp500_price": 4785.32,
  "sp500_volatility_30d": 15.8,
  "vix_close": 14.2,
  "inflation_rate_cpi_annual": 3.2,
  "unemployment_rate": 3.7,
  "market_regime": "sideways",
  "risk_environment": "moderate",
  "data_sources": {
    "treasury_10y_yield": "FRED:DGS10",
    "sp500_price": "Stooq:^SPX",
    "vix_close": "Stooq:^VIX"
  },
  "data_quality_score": 0.95
}
```

---

## 🧪 Testing Plan

### Local Testing

```bash
# 1. Apply Supabase migration
cd apps/web
npx supabase db reset  # Fresh start
npx supabase db push   # Apply all migrations

# 2. Verify columns exist
npx supabase db execute "
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('scenario_goal_snapshots', 'scenario_sim_runs', 'scenario_versions')
  AND column_name LIKE '%probability%' OR column_name LIKE '%market%'
ORDER BY table_name, ordinal_position;
"

# 3. Insert test data
npx supabase db execute "
INSERT INTO scenario_goal_snapshots (
  id, sim_run_id, goal_id, goal_title,
  final_success_probability, robustness_grade,
  median_outcome, confidence_interval_95_low, confidence_interval_95_high
) VALUES (
  gen_random_uuid(),
  (SELECT id FROM scenario_sim_runs LIMIT 1),
  gen_random_uuid(),
  'Test Goal',
  0.78,
  'B',
  50000,
  35000,
  65000
);
"

# 4. Query test data
npx supabase db execute "
SELECT goal_title, robustness_grade, median_outcome
FROM scenario_goal_snapshots
WHERE robustness_grade IS NOT NULL;
"
```

### Backend Testing

```bash
# 1. Apply backend migration
cd backend
export DATABASE_FINANCIAL_URL="postgresql://localhost:5432/lifenavigator_financial_test"

psql $DATABASE_FINANCIAL_URL -f app/db/migrations/financial/002_create_market_context.sql

# 2. Verify table exists
psql $DATABASE_FINANCIAL_URL -c "\d market_context_snapshots"

# 3. Insert test market data
psql $DATABASE_FINANCIAL_URL -c "
INSERT INTO market_context_snapshots (
  snapshot_date, treasury_10y_yield, sp500_price, vix_close,
  inflation_rate_cpi_annual, market_regime, risk_environment
) VALUES (
  '2026-01-08', 4.25, 4785.32, 14.2, 3.2, 'sideways', 'moderate'
);
"

# 4. Query latest snapshot
psql $DATABASE_FINANCIAL_URL -c "SELECT * FROM latest_market_snapshot;"
```

---

## 🚀 Deployment Steps

### Staging Environment

```bash
# 1. Deploy Supabase migration
cd apps/web
npx supabase link --project-ref <your-staging-project>
npx supabase db push

# 2. Deploy backend migration
cd ../../backend
export DATABASE_FINANCIAL_URL="<staging-financial-db-url>"
psql $DATABASE_FINANCIAL_URL -f app/db/migrations/financial/002_create_market_context.sql

# 3. Verify deployment
npx supabase db execute "SELECT COUNT(*) FROM scenario_goal_snapshots;" --project-ref <staging>
```

### Production Environment

```bash
# 1. Backup databases (safety first)
npx supabase db dump --project-ref <prod> > backup_$(date +%Y%m%d).sql

# 2. Apply Supabase migration
npx supabase link --project-ref <your-prod-project>
npx supabase db push

# 3. Apply backend migration
export DATABASE_FINANCIAL_URL="<prod-financial-db-url>"
psql $DATABASE_FINANCIAL_URL -f app/db/migrations/financial/002_create_market_context.sql

# 4. Verify production
npx supabase db execute "
SELECT table_name, column_name
FROM information_schema.columns
WHERE table_name IN ('scenario_goal_snapshots', 'scenario_sim_runs')
  AND column_name LIKE '%probability%' OR column_name LIKE '%market%';
" --project-ref <prod>
```

---

## 📊 Success Criteria

After applying all migrations, verify:

- [ ] **Supabase migration 008 applied successfully**
  - New columns exist in `scenario_goal_snapshots`
  - New columns exist in `scenario_sim_runs`
  - New columns exist in `scenario_versions`
  - Indexes created
  - No errors in Supabase logs

- [ ] **Backend migration 002 applied successfully**
  - `market_context_snapshots` table exists in Financial DB
  - Views `latest_market_snapshot` and `market_regime_history` exist
  - Indexes created
  - Can insert test data

- [ ] **No data corruption**
  - Existing Supabase data unchanged (0 rows affected anyway)
  - Backend databases empty (as expected)

- [ ] **Documentation updated**
  - Schema docs reflect new fields
  - API docs mention win probability + market context
  - Frontend docs show new features available

---

## 🎯 Next Steps After Schema Fix

### Sprint 1: Market Data Ingestion

**Goal**: Populate `market_context_snapshots` with historical + daily data

**Tasks**:
1. Create FRED API client (`backend/app/services/market_data/fred_client.py`)
2. Create Stooq scraper (`backend/app/services/market_data/stooq_client.py`)
3. Implement market regime classifier
4. Create daily cron job
5. Backfill 1 year of historical data

**Deliverable**: `market_context_snapshots` table populated daily

---

### Sprint 2: Win Probability Implementation

**Goal**: Calculate and display Monte Carlo results

**Tasks**:
1. Update risk engine to run 10k iterations
2. Calculate percentiles, confidence intervals
3. Classify robustness grade (A-F)
4. Store results in `scenario_goal_snapshots`
5. Create probability distribution chart component (frontend)

**Deliverable**: Users see probability graphs with confidence intervals

---

### Sprint 3: Market-Aware Risk

**Goal**: Adjust risk calculations based on economic conditions

**Tasks**:
1. Risk engine fetches latest market snapshot
2. Adjust assumptions based on market regime
3. Compare current vs historical probabilities
4. Store market context in `scenario_sim_runs`
5. Display market impact to users

**Deliverable**: "Probability in current market: 65% (vs. 72% historical avg)"

---

### Sprint 4: Scenario Branching

**Goal**: Users can create and compare scenario variations

**Tasks**:
1. Add "Fork Scenario" button (frontend)
2. Create child version with `parent_version_id`
3. Side-by-side comparison view
4. Mark baseline version
5. Visual diff of inputs/results

**Deliverable**: Users can explore "What if" variations

---

## 🔒 Security & Compliance

### Data Boundary Verification

After schema changes, verify data boundaries still hold:

```bash
# Test data boundary enforcement
curl -X POST https://staging-backend.run.app/api/v1/internal/risk-engine/compute \
  -H "Content-Type: application/json" \
  -d '{"ssn": "123-45-6789"}'

# Expected: HTTP 400 "data_boundary_violation"
```

### Audit Logging

Ensure new fields are captured in audit logs:

```sql
-- Check scenario_audit_log captures new fields
SELECT action, resource_type, changes
FROM scenario_audit_log
WHERE changes::text LIKE '%probability_distribution%'
   OR changes::text LIKE '%market_snapshot_id%'
LIMIT 5;
```

---

## 📞 Support & Questions

**Schema Questions**: See `docs/database/SCHEMA_CLEANUP_PLAN.md`

**Migration Issues**: Check Supabase/backend logs

**Data Boundaries**: See `docs/security/DATA_BOUNDARY_ENFORCEMENT.md`

**Feature Implementation**: See individual sprint plans above

---

**Status**: ✅ **All migration files created and ready to apply**

**Recommended Timeline**:
- Today: Apply migrations to local/dev
- This week: Deploy to staging
- Next week: Deploy to production (after staging validation)

**Risk**: ⬜ **NONE** - No production data exists, migrations are additive only (no data loss possible)
