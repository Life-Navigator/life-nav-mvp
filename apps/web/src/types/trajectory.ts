/**
 * Types for the Life Trajectory Simulation Engine. Mirrors the columns
 * defined in migration 071_life_trajectory_simulation.sql.
 */

export type ScenarioLabel =
  | 'current_behavior'
  | 'conservative'
  | 'balanced'
  | 'aggressive_upside'
  | 'goal_optimized';

export const ALL_LABELS: ScenarioLabel[] = [
  'current_behavior',
  'conservative',
  'balanced',
  'aggressive_upside',
  'goal_optimized',
];

export type ScenarioDecisionType =
  | 'pay_debt'
  | 'invest_taxable'
  | 'contribute_retirement'
  | 'contribute_hsa'
  | 'add_to_emergency_fund'
  | 'add_to_down_payment'
  | 'enroll_education'
  | 'career_change'
  | 'home_purchase'
  | 'retire'
  | 'other';

/** A discrete decision scheduled to fire at a specific month index. */
export interface ScenarioDecision {
  decision_type: ScenarioDecisionType;
  description?: string;
  at_month: number; // 0 = start
  amount?: number; // USD if applicable
  parameters?: Record<string, unknown>;
}

/** Per-debt detail the projector pays down month-by-month. */
export interface ProjectorDebt {
  label: string;
  balance: number;
  apr: number; // decimal, e.g. 0.2199
  minimum_payment: number; // USD/month
}

/** Initial state the projector advances forward. */
export interface ProjectorState {
  starting_month: number; // 0
  horizon_months: number; // 1..720
  // Income
  annual_gross_income: number;
  monthly_take_home: number;
  expected_income_growth_pct: number; // annual
  // Expenses
  monthly_expenses: number;
  expected_inflation_pct: number; // annual
  // Balances
  cash: number;
  taxable_investments: number;
  retirement_balance: number;
  hsa_balance: number;
  home_equity: number;
  debts: ProjectorDebt[];
  // Income augmenters
  employer_match_pct: number; // 0..1 — fraction of salary matched
  employer_match_limit_pct: number; // 0..1 — up to this % of salary
  monthly_retirement_contribution: number; // pre-match owner contribution
  monthly_hsa_contribution: number;
  monthly_taxable_investing: number;
  monthly_emergency_fund_topup: number;
  monthly_extra_debt_payment: number; // applied to highest-APR balance first
  // Risk model
  expected_real_return_pct: number; // annual real return on investments
  expected_retirement_return_pct: number;
  // Health-cost model
  annual_health_premium: number;
  expected_annual_oop: number;
}

export interface ProjectorMetricsPoint {
  at_month: number;
  net_worth: number;
  cash: number;
  taxable_investments: number;
  retirement_balance: number;
  hsa_balance: number;
  total_debt: number;
  emergency_months: number;
  annual_income: number; // running annualized at this month
  monthly_cash_flow: number; // income - expenses - debt service
  health_cost_exposure: number;
}

export interface ProjectorAssumption {
  key: string;
  value: unknown;
  rationale: string;
}

export interface ProjectorOutput {
  final_net_worth: number;
  final_debt: number;
  final_annual_income: number;
  final_emergency_months: number;
  final_health_cost_exposure: number;
  retirement_ready: boolean;
  recommended: boolean;
  rationale: string;
  risks: string[];
  upside_factors: string[];
  metrics: ProjectorMetricsPoint[];
  events: Array<{
    at_month: number;
    event_type: string;
    description: string;
    impact: Record<string, number>;
  }>;
  assumptions: ProjectorAssumption[];
  engine_version: string;
}

/** Shape returned to the UI when listing a scenario. */
export interface SimulationVersionView {
  id: string;
  version_index: number;
  label: ScenarioLabel | string | null;
  horizon_years: number;
  status: string;
  ran_at: string | null;
  output: {
    final_net_worth: number | null;
    final_debt: number | null;
    final_annual_income: number | null;
    emergency_fund_months_final: number | null;
    health_cost_exposure_final: number | null;
    retirement_ready: boolean | null;
    recommended: boolean | null;
    rationale: string | null;
    risks: unknown;
    upside_factors: unknown;
  } | null;
  metrics: Array<{
    at_month: number;
    metric_key: string;
    metric_value: number;
  }>;
}
