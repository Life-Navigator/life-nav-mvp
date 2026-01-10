-- ============================================================================
-- Backend Financial DB: Market Context Snapshots
-- ============================================================================
-- Daily snapshots of market conditions for risk-aware simulations
-- Data sources: FRED (Federal Reserve), Stooq (market prices)
--
-- Run after: 001_create_finance_schema.sql
-- Safe to run multiple times (uses CREATE TABLE IF NOT EXISTS)
-- ============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- MARKET_CONTEXT_SNAPSHOTS (Daily Market Data)
-- ============================================================================
CREATE TABLE IF NOT EXISTS market_context_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Date (UNIQUE constraint ensures one snapshot per day)
  snapshot_date DATE NOT NULL UNIQUE,

  -- ========================================================================
  -- Interest Rates (Treasury Yields)
  -- ========================================================================
  treasury_1m_yield FLOAT,   -- 1-month Treasury (cash proxy)
  treasury_3m_yield FLOAT,   -- 3-month Treasury
  treasury_6m_yield FLOAT,   -- 6-month Treasury
  treasury_1y_yield FLOAT,   -- 1-year Treasury
  treasury_2y_yield FLOAT,   -- 2-year Treasury
  treasury_5y_yield FLOAT,   -- 5-year Treasury
  treasury_10y_yield FLOAT,  -- 10-year Treasury (benchmark)
  treasury_30y_yield FLOAT,  -- 30-year Treasury

  -- Federal Reserve Rates
  fed_funds_rate FLOAT,      -- Federal Funds Rate
  sofr_rate FLOAT,           -- Secured Overnight Financing Rate

  -- ========================================================================
  -- Inflation Indicators
  -- ========================================================================
  cpi_annual FLOAT,          -- Consumer Price Index (YoY %)
  pce_annual FLOAT,          -- Personal Consumption Expenditures (YoY %)
  breakeven_5y FLOAT,        -- 5-year breakeven inflation rate
  breakeven_10y FLOAT,       -- 10-year breakeven inflation rate

  -- ========================================================================
  -- Equity Markets
  -- ========================================================================
  sp500_price FLOAT,         -- S&P 500 index level
  sp500_return_1d FLOAT,     -- 1-day return (%)
  sp500_return_1m FLOAT,     -- 1-month return (%)
  sp500_volatility_30d FLOAT,-- 30-day realized volatility (annualized)
  vix_close FLOAT,           -- VIX (implied volatility index)

  nasdaq_price FLOAT,        -- NASDAQ Composite
  russell_2000_price FLOAT,  -- Russell 2000 (small cap)

  -- ========================================================================
  -- Credit Spreads
  -- ========================================================================
  baa_aaa_spread FLOAT,      -- BAA-AAA corporate spread (FRED)
  high_yield_spread FLOAT,   -- High-yield spread over treasuries

  -- ========================================================================
  -- Foreign Exchange (Major Pairs)
  -- ========================================================================
  usd_eur FLOAT,             -- EUR/USD exchange rate
  usd_gbp FLOAT,             -- GBP/USD exchange rate
  usd_jpy FLOAT,             -- USD/JPY exchange rate
  usd_cny FLOAT,             -- USD/CNY exchange rate

  -- ========================================================================
  -- Commodities (Optional)
  -- ========================================================================
  gold_price FLOAT,          -- Gold spot price (USD/oz)
  oil_wti_price FLOAT,       -- WTI Crude Oil (USD/barrel)

  -- ========================================================================
  -- Cryptocurrency (Optional)
  -- ========================================================================
  btc_price FLOAT,           -- Bitcoin (USD)
  eth_price FLOAT,           -- Ethereum (USD)

  -- ========================================================================
  -- Economic Indicators
  -- ========================================================================
  unemployment_rate FLOAT,   -- U.S. unemployment rate (%)
  gdp_growth_quarterly FLOAT,-- Real GDP growth (QoQ annualized %)
  gdp_growth_annual FLOAT,   -- Real GDP growth (YoY %)

  -- ========================================================================
  -- Market Regime Classification (Computed)
  -- ========================================================================
  market_regime TEXT CHECK (market_regime IN ('bull', 'bear', 'sideways', 'volatile', 'unknown')),
  risk_environment TEXT CHECK (risk_environment IN ('low', 'moderate', 'elevated', 'high', 'extreme')),

  -- Classification logic (stored for transparency)
  regime_classification_reason TEXT,  -- Why this regime was chosen

  -- ========================================================================
  -- Data Quality & Provenance
  -- ========================================================================
  data_sources JSONB,        -- {"treasury_yields": "FRED", "sp500": "Stooq", ...}
  missing_fields TEXT[],     -- Array of fields that couldn't be fetched
  data_quality_score FLOAT,  -- 0-1 score (1 = all fields populated)

  -- ========================================================================
  -- Timestamps
  -- ========================================================================
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Indexes for Performance
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_market_snapshots_date
  ON market_context_snapshots(snapshot_date DESC);

CREATE INDEX IF NOT EXISTS idx_market_snapshots_regime
  ON market_context_snapshots(market_regime)
  WHERE market_regime IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_market_snapshots_risk_env
  ON market_context_snapshots(risk_environment)
  WHERE risk_environment IS NOT NULL;

-- Index for finding recent snapshots
CREATE INDEX IF NOT EXISTS idx_market_snapshots_recent
  ON market_context_snapshots(snapshot_date DESC, created_at DESC);

-- ============================================================================
-- Comments (Documentation)
-- ============================================================================
COMMENT ON TABLE market_context_snapshots IS
  'Daily market data snapshots for risk-aware simulations. Populated via daily cron job from FRED/Stooq APIs.';

COMMENT ON COLUMN market_context_snapshots.snapshot_date IS
  'Market close date (U.S. Eastern Time). One snapshot per trading day.';

COMMENT ON COLUMN market_context_snapshots.market_regime IS
  'Auto-classified based on: SP500 50/200-day MA, VIX levels, trend strength. Updated daily.';

COMMENT ON COLUMN market_context_snapshots.risk_environment IS
  'Overall risk classification based on: credit spreads, volatility, economic data. Used by risk engine.';

COMMENT ON COLUMN market_context_snapshots.data_quality_score IS
  'Percentage of fields successfully populated (1.0 = 100%, 0.5 = 50% missing)';

COMMENT ON COLUMN market_context_snapshots.data_sources IS
  'JSON mapping of which API provided each field. Example: {"treasury_10y_yield": "FRED:DGS10", "sp500_price": "Stooq:^SPX"}';

-- ============================================================================
-- Helper View: Latest Market Snapshot
-- ============================================================================
CREATE OR REPLACE VIEW latest_market_snapshot AS
SELECT * FROM market_context_snapshots
ORDER BY snapshot_date DESC
LIMIT 1;

COMMENT ON VIEW latest_market_snapshot IS
  'Convenience view for getting the most recent market data. Used by risk engine.';

-- ============================================================================
-- Helper View: Market Regime History
-- ============================================================================
CREATE OR REPLACE VIEW market_regime_history AS
SELECT
  snapshot_date,
  market_regime,
  risk_environment,
  sp500_price,
  sp500_volatility_30d,
  vix_close,
  treasury_10y_yield,
  cpi_annual,
  regime_classification_reason
FROM market_context_snapshots
WHERE market_regime IS NOT NULL
ORDER BY snapshot_date DESC;

COMMENT ON VIEW market_regime_history IS
  'Simplified view of market regime changes over time. Useful for backtesting risk models.';

-- ============================================================================
-- Success Message
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '✅ Backend Financial DB: market_context_snapshots table created';
  RAISE NOTICE '   - 50+ fields for market/economic data';
  RAISE NOTICE '   - 4 performance indexes added';
  RAISE NOTICE '   - 2 helper views created (latest_market_snapshot, market_regime_history)';
  RAISE NOTICE '';
  RAISE NOTICE '📋 Next steps:';
  RAISE NOTICE '   1. Implement daily cron job to populate data';
  RAISE NOTICE '   2. Create internal API endpoint for risk engine';
  RAISE NOTICE '   3. Test with historical data backfill';
END $$;
