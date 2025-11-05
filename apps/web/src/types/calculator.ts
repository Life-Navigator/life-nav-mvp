/**
 * Investment Calculator Type Definitions
 */

export enum ContributionFrequency {
  WEEKLY = "weekly",
  BI_WEEKLY = "bi_weekly",
  MONTHLY = "monthly",
  QUARTERLY = "quarterly",
  ANNUALLY = "annually",
  ONE_TIME = "one_time"
}

export enum RiskLevel {
  CONSERVATIVE = "conservative",
  MODERATELY_CONSERVATIVE = "moderately_conservative",
  MODERATE = "moderate",
  MODERATELY_AGGRESSIVE = "moderately_aggressive",
  AGGRESSIVE = "aggressive"
}

// Investment Growth Calculator

export interface InvestmentGrowthRequest {
  name?: string;
  initial_investment: number;
  annual_return_rate: number;
  volatility?: number;
  inflation_rate?: number;
  fee_percentage?: number;
  tax_rate?: number;
  time_horizon_years: number;
  contribution_amount?: number;
  contribution_frequency?: ContributionFrequency;
  contribution_growth_rate?: number;
  include_monthly_detail?: boolean;
  include_monte_carlo?: boolean;
  simulation_runs?: number;
}

export interface YearlyProjection {
  year: number;
  age?: number;
  balance: number;
  contribution: number;
  growth: number;
  fees?: number;
  taxes?: number;
  inflation_adjusted_balance: number;
}

export interface MonthlyProjection {
  year: number;
  month: number;
  balance: number;
  contribution: number;
  growth: number;
  fees?: number;
  taxes?: number;
}

export interface MonteCarloSimulation {
  median_final_balance: number;
  best_case: number;
  worst_case: number;
  percentiles: {
    "10th": number[];
    "25th": number[];
    "50th": number[];
    "75th": number[];
    "90th": number[];
  };
  probabilities: {
    [key: string]: number;
  };
}

export interface InvestmentGrowthSummary {
  final_balance: number;
  total_contributions: number;
  investment_growth: number;
  total_fees?: number;
  total_taxes?: number;
  compound_annual_growth_rate: number;
  growth_multiple: number;
  real_return_rate: number;
  inflation_adjusted_balance: number;
  inflation_adjusted_benefit: number;
}

export interface InvestmentGrowthResponse {
  scenario: InvestmentGrowthRequest;
  summary: InvestmentGrowthSummary;
  annual_projection: YearlyProjection[];
  monthly_projection?: MonthlyProjection[];
  monte_carlo?: MonteCarloSimulation;
}

// Investment Scenario Comparison

export interface ScenarioComparisonRequest {
  scenarios: InvestmentGrowthRequest[];
}

export interface ScenarioSummary {
  name: string;
  final_balance: number;
  inflation_adjusted_balance: number;
  total_contributions: number;
  investment_growth: number;
  compound_annual_growth_rate: number;
}

export interface ScenarioComparisonResult {
  scenarios: ScenarioSummary[];
  best_performing: {
    by_final_balance: string;
    by_inflation_adjusted: string;
    by_cagr: string;
  };
  recommendation: string;
}

// Asset Allocation Calculator

export interface AssetAllocationRequest {
  risk_level: RiskLevel;
  age?: number;
  time_horizon_years?: number;
  customize_allocation?: boolean;
  custom_stock_percentage?: number;
}

export interface AssetClassMetrics {
  allocation_percentage: number;
  expected_return: number;
  volatility: number;
  best_year: number;
  worst_year: number;
}

export interface PortfolioMetrics {
  expected_return: number;
  volatility: number;
  sharpe_ratio: number;
  risk_level: RiskLevel;
}

export interface ProjectedGrowth {
  years: number;
  percentage: number;
}

export interface AssetAllocationResponse {
  allocation: {
    stocks: number;
    bonds: number;
    cash: number;
    real_estate?: number;
    alternatives?: number;
  };
  asset_class_metrics: {
    stocks: AssetClassMetrics;
    bonds: AssetClassMetrics;
    cash: AssetClassMetrics;
    real_estate?: AssetClassMetrics;
    alternatives?: AssetClassMetrics;
  };
  portfolio: PortfolioMetrics;
  projected_growth: ProjectedGrowth;
}

// Lump Sum vs DCA Calculator

export interface LumpSumVsDcaRequest {
  total_amount: number;
  time_horizon_years: number;
  risk_level: RiskLevel;
  dca_periods?: number;
  expected_return_rate?: number | null;
}

export interface InvestmentStrategy {
  final_balance: number;
  growth_amount: number;
  growth_percentage: number;
  period_investment?: number;
  initial_investment?: number;
  annual_projection: YearlyProjection[];
}

export interface StrategyComparison {
  best_strategy: string;
  lump_sum_vs_dca: number;
  lump_sum_vs_dca_percentage: number;
  lump_sum_vs_partial: number;
  lump_sum_vs_partial_percentage: number;
}

export interface RiskConsiderations {
  risk_level: RiskLevel;
  volatility: number;
  market_timing_risk: string;
  psychological_comfort: string;
}

export interface LumpSumVsDcaResponse {
  total_amount: number;
  time_horizon_years: number;
  dca_periods: number;
  expected_annual_return: number;
  lump_sum: InvestmentStrategy;
  dollar_cost_averaging: InvestmentStrategy;
  partial_lump_sum_dca: InvestmentStrategy;
  comparison: StrategyComparison;
  risk_considerations: RiskConsiderations;
  strategy_recommendation: string;
}

// Historical Returns

export interface AssetClassReturns {
  asset_class: string;
  average_return: number;
  standard_deviation: number;
  worst_year: number;
  best_year: number;
  historical_returns: {
    year: number;
    return: number;
  }[];
}

export interface HistoricalReturnsResponse {
  time_period: string;
  asset_classes: AssetClassReturns[];
  correlation_matrix: {
    [key: string]: {
      [key: string]: number;
    };
  };
}

// Combined results type for the hook

export interface InvestmentCalculatorResults {
  investment_growth?: InvestmentGrowthResponse;
  scenario_comparison?: ScenarioComparisonResult;
  asset_allocation?: AssetAllocationResponse;
  lump_sum_dca?: LumpSumVsDcaResponse;
  historical_returns?: HistoricalReturnsResponse;
}