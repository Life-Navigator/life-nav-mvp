-- ============================================================================
-- Migration 008: Add Win Probability & Market Context Fields
-- ============================================================================
-- This migration enhances scenario lab tables with:
-- - Win probability distributions (Monte Carlo results)
-- - Market context awareness (economic conditions at sim time)
-- - Scenario branching (version forking)
--
-- Run after: 007_scenario_lab_storage.sql
-- Safe to run multiple times (uses IF NOT EXISTS)
-- ============================================================================

-- 1. Add win probability fields to goal snapshots
-- These fields store Monte Carlo simulation results for visualization
ALTER TABLE public.scenario_goal_snapshots
  ADD COLUMN IF NOT EXISTS probability_distribution JSONB,  -- Histogram bins for charts
  ADD COLUMN IF NOT EXISTS confidence_interval_95_low FLOAT,  -- 95% CI lower bound (5th percentile)
  ADD COLUMN IF NOT EXISTS confidence_interval_95_high FLOAT,  -- 95% CI upper bound (95th percentile)
  ADD COLUMN IF NOT EXISTS median_outcome FLOAT,  -- 50th percentile (median) result
  ADD COLUMN IF NOT EXISTS worst_case_10th_percentile FLOAT,  -- Downside risk (10th percentile)
  ADD COLUMN IF NOT EXISTS best_case_90th_percentile FLOAT,  -- Upside potential (90th percentile)
  ADD COLUMN IF NOT EXISTS volatility_score FLOAT,  -- Standard deviation of outcomes
  ADD COLUMN IF NOT EXISTS robustness_grade TEXT CHECK (robustness_grade IN ('A', 'B', 'C', 'D', 'F'));  -- Letter grade

-- 2. Add market context fields to simulation runs
-- These track economic conditions at the time of simulation
ALTER TABLE public.scenario_sim_runs
  ADD COLUMN IF NOT EXISTS market_snapshot_id UUID,  -- Reference to backend market_context_snapshots
  ADD COLUMN IF NOT EXISTS market_snapshot_date DATE,  -- Which market data was used
  ADD COLUMN IF NOT EXISTS inflation_rate_used FLOAT,  -- CPI at time of simulation
  ADD COLUMN IF NOT EXISTS sp500_volatility_used FLOAT,  -- VIX or realized vol
  ADD COLUMN IF NOT EXISTS treasury_10y_yield_used FLOAT,  -- Risk-free rate proxy
  ADD COLUMN IF NOT EXISTS market_regime TEXT CHECK (market_regime IN ('bull', 'bear', 'sideways', 'volatile', 'unknown')),
  ADD COLUMN IF NOT EXISTS economic_conditions JSONB,  -- {unemployment_rate, gdp_growth, etc.}
  ADD COLUMN IF NOT EXISTS market_adjusted_probability FLOAT;  -- Overall prob adjusted for current market

-- 3. Add scenario branching fields for version forking
-- Allows users to create variations of scenarios and compare them
ALTER TABLE public.scenario_versions
  ADD COLUMN IF NOT EXISTS parent_version_id UUID REFERENCES public.scenario_versions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS branch_name TEXT,  -- "Optimistic", "Conservative", etc.
  ADD COLUMN IF NOT EXISTS comparison_notes TEXT,  -- User notes on why this variation exists
  ADD COLUMN IF NOT EXISTS is_baseline BOOLEAN DEFAULT FALSE;  -- Mark one as baseline for comparisons

-- 4. Add performance indexes
CREATE INDEX IF NOT EXISTS idx_scenario_sim_runs_market_date
  ON public.scenario_sim_runs(market_snapshot_date);

CREATE INDEX IF NOT EXISTS idx_scenario_versions_parent
  ON public.scenario_versions(parent_version_id);

CREATE INDEX IF NOT EXISTS idx_scenario_goal_snapshots_goal
  ON public.scenario_goal_snapshots(goal_id);

CREATE INDEX IF NOT EXISTS idx_scenario_goal_snapshots_robustness
  ON public.scenario_goal_snapshots(robustness_grade) WHERE robustness_grade IS NOT NULL;

-- 5. Add helpful comments
COMMENT ON COLUMN public.scenario_goal_snapshots.probability_distribution IS
  'Monte Carlo outcome histogram in format: {"bins": [{"min": 0, "max": 10, "count": 42}, ...], "total_iterations": 10000}';

COMMENT ON COLUMN public.scenario_goal_snapshots.confidence_interval_95_low IS
  '95% confidence interval lower bound (5th percentile) - "In 95% of scenarios, outcome will be above this"';

COMMENT ON COLUMN public.scenario_goal_snapshots.confidence_interval_95_high IS
  '95% confidence interval upper bound (95th percentile) - "In 95% of scenarios, outcome will be below this"';

COMMENT ON COLUMN public.scenario_goal_snapshots.median_outcome IS
  '50th percentile (median) outcome - "Half of scenarios are better, half are worse"';

COMMENT ON COLUMN public.scenario_goal_snapshots.worst_case_10th_percentile IS
  'Downside risk (10th percentile) - "90% of scenarios are better than this"';

COMMENT ON COLUMN public.scenario_goal_snapshots.best_case_90th_percentile IS
  'Upside potential (90th percentile) - "10% of scenarios are better than this"';

COMMENT ON COLUMN public.scenario_goal_snapshots.volatility_score IS
  'Standard deviation of outcomes - measures how much results vary across simulations';

COMMENT ON COLUMN public.scenario_goal_snapshots.robustness_grade IS
  'Letter grade based on final_success_probability: A (≥90%), B (75-89%), C (60-74%), D (50-59%), F (<50%)';

COMMENT ON COLUMN public.scenario_sim_runs.market_snapshot_id IS
  'Reference to backend market_context_snapshots table (not in Supabase) - tracks which market data was used';

COMMENT ON COLUMN public.scenario_sim_runs.market_snapshot_date IS
  'Date of market data used in simulation - allows comparing results across different economic environments';

COMMENT ON COLUMN public.scenario_sim_runs.market_regime IS
  'Classified market environment at simulation time - affects risk model assumptions';

COMMENT ON COLUMN public.scenario_sim_runs.economic_conditions IS
  'Snapshot of economic indicators used in risk model: {"unemployment": 3.7, "gdp_growth": 2.1, ...}';

COMMENT ON COLUMN public.scenario_sim_runs.market_adjusted_probability IS
  'Overall success probability adjusted for current market conditions (vs. historical average)';

COMMENT ON COLUMN public.scenario_versions.parent_version_id IS
  'For scenario branching - which version was this forked from (NULL = original scenario)';

COMMENT ON COLUMN public.scenario_versions.is_baseline IS
  'User can mark one version as baseline for side-by-side comparisons (only one per scenario should be TRUE)';

-- 6. Add constraint to ensure only one baseline per scenario
CREATE UNIQUE INDEX IF NOT EXISTS idx_scenario_versions_one_baseline_per_scenario
  ON public.scenario_versions(scenario_id)
  WHERE is_baseline = TRUE;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Migration 008 complete: Win probability & market context fields added';
  RAISE NOTICE '   - scenario_goal_snapshots: +8 columns (probability distribution, CI, percentiles, grade)';
  RAISE NOTICE '   - scenario_sim_runs: +8 columns (market context, regime, economic conditions)';
  RAISE NOTICE '   - scenario_versions: +4 columns (branching support)';
  RAISE NOTICE '   - Added 5 performance indexes';
END $$;
