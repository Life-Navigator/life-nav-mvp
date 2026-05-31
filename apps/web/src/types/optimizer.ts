/**
 * Shared types for the Dynamic Goal Optimizer. Mirrors the columns in
 * migration 070 and the payloads the API routes accept.
 */

export type AllocationCategory =
  | 'emergency_fund'
  | 'high_interest_debt'
  | 'low_interest_debt'
  | 'retirement_match'
  | 'retirement_contribution'
  | 'hsa_contribution'
  | 'taxable_investing'
  | 'education_investment'
  | 'career_development'
  | 'insurance_gap_coverage'
  | 'health_wellness_investment'
  | 'home_down_payment_fund'
  | 'cash_reserve';

export const ALL_CATEGORIES: AllocationCategory[] = [
  'emergency_fund',
  'high_interest_debt',
  'low_interest_debt',
  'retirement_match',
  'retirement_contribution',
  'hsa_contribution',
  'taxable_investing',
  'education_investment',
  'career_development',
  'insurance_gap_coverage',
  'health_wellness_investment',
  'home_down_payment_fund',
  'cash_reserve',
];

export type DecisionAxis =
  | 'speed'
  | 'certainty'
  | 'flexibility'
  | 'upside'
  | 'minimize_downside'
  | 'minimize_stress'
  | 'minimize_cost'
  | 'maximize_long_term_net_worth'
  | 'maximize_healthspan'
  | 'maximize_family_stability';

export type DriverKey = 'financial_security' | 'image' | 'performance';

// ----- input snapshot (loaded by the engine before scoring) ------------

export interface DebtInputSnapshot {
  debt_type: string; // matches finance.debts.debt_type
  current_balance: number;
  interest_rate: number | null; // APR as decimal (e.g. 0.2299)
  minimum_payment: number | null;
}

export interface InsurancePlanInputSnapshot {
  plan_type: string; // medical | dental | vision | disability | life | ...
  is_active: boolean;
}

export interface RiskToleranceInputSnapshot {
  domain: string;
  tolerance_score: number; // 0..1
}

export interface DecisionPreferenceInputSnapshot {
  axis: DecisionAxis;
  weight: number; // 0..1
}

export interface GoalInputSnapshot {
  id: string;
  category: string;
  title: string;
  stated_goal: string | null;
  root_goal: string | null;
  dominant_driver: DriverKey | null;
  urgency: 'low' | 'medium' | 'high' | 'critical' | null;
  target_value: number | null;
}

export interface FinancialProfileInputSnapshot {
  annual_income: number | null;
  household_annual_income: number | null;
  monthly_expenses: number | null;
  monthly_discretionary_income: number | null;
  emergency_fund_amount: number | null;
  emergency_fund_months: number | null;
  credit_score_range: string | null;
  credit_card_utilization: number | null; // 0..100
  hsa_eligible: boolean | null;
  hsa_current_balance: number | null;
  fsa_eligible: boolean | null;
  employer_match_percent: number | null; // e.g. 50 = 50%
  employer_match_limit_percent: number | null; // e.g. 6 = up to 6% of salary
  has_pension: boolean | null;
  estimated_marginal_tax_bracket: number | null;
}

export interface CareerInputSnapshot {
  current_income: number | null;
  target_income: number | null;
  skill_gaps: string[];
  time_for_upskilling_hours_per_week: number | null;
}

export interface EducationInputSnapshot {
  has_pending_program: boolean;
  tuition_budget_annual: number | null;
  expected_roi_preference: 'fast_payback' | 'balanced' | 'long_term_value' | null;
  credential_urgency: 'none' | 'within_year' | 'within_2_years' | 'within_5_years' | null;
}

export interface OptimizerInputs {
  monthly_surplus: number;
  user_goal_id?: string | null;
  stated_goal?: string | null;
  profile: FinancialProfileInputSnapshot | null;
  debts: DebtInputSnapshot[];
  insurance: InsurancePlanInputSnapshot[];
  risk: RiskToleranceInputSnapshot[];
  decision_preferences: DecisionPreferenceInputSnapshot[];
  career: CareerInputSnapshot | null;
  education: EducationInputSnapshot | null;
  goals: GoalInputSnapshot[];
}

// ----- scoring + output ------------------------------------------------

export interface DimensionScores {
  net_worth_impact: number;
  risk_reduction: number;
  liquidity_improvement: number;
  goal_alignment: number;
  timeline_urgency: number;
  tax_advantage: number;
  interest_rate_spread: number;
  behavioral_stress_impact: number;
  prerequisite_value: number;
  credit_readiness_impact: number;
  home_readiness_impact: number;
  career_income_impact: number;
  health_cost_prevention_impact: number;
}

export interface CategoryScore {
  category: AllocationCategory;
  raw_score: number; // unweighted sum across dimensions
  weighted_score: number; // after decision-preference weighting
  rationale_keys: string[]; // short rationale tokens
  dimensions: DimensionScores;
}

export interface OptimizerAllocation {
  category: AllocationCategory;
  amount_usd: number;
  share_pct: number; // 0..100, rounded
  priority: number; // 0..100, derived from weighted_score
  rationale: string;
  category_score: number;
}

export interface TradeoffNote {
  axis_a: AllocationCategory;
  axis_b: AllocationCategory;
  summary: string;
  favored_axis: 'a' | 'b' | 'balanced';
}

export interface AssumptionNote {
  key: string;
  value: unknown;
  rationale: string;
}

export interface OptimizerOutput {
  stated_goal: string;
  inferred_true_goal: string;
  confidence: number; // 0..1
  monthly_surplus: number;
  allocations: OptimizerAllocation[]; // sums to monthly_surplus
  tradeoffs: TradeoffNote[];
  assumptions: AssumptionNote[];
  summary: string;
  next_best_action: string;
  // Engine-version stamp persisted on every run for reproducibility.
  engine_version: string;
}
