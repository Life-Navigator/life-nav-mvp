/**
 * Shared input types for the expanded intake routes. Each shape mirrors
 * the Zod schema of the matching API route. The wizard components fill
 * these shapes and post them as-is.
 */

export type EmploymentType =
  | 'w2_full_time'
  | 'w2_part_time'
  | 'self_employed'
  | '1099_contractor'
  | 'business_owner'
  | 'unemployed'
  | 'retired'
  | 'student'
  | 'other';

export type IncomeStability = 'very_stable' | 'stable' | 'variable' | 'unstable';

export type CreditScoreRange =
  | 'below_580'
  | '580_669'
  | '670_739'
  | '740_799'
  | '800_plus'
  | 'unknown';

export interface FinancialProfileInput {
  annual_income?: number | null;
  income_stability?: IncomeStability | null;
  employment_type?: EmploymentType | null;
  household_size?: number | null;
  spouse_annual_income?: number | null;
  household_annual_income?: number | null;
  monthly_expenses?: number | null;
  monthly_discretionary_income?: number | null;
  emergency_fund_amount?: number | null;
  emergency_fund_months?: number | null;
  credit_score_range?: CreditScoreRange | null;
  credit_card_utilization?: number | null;
  hsa_eligible?: boolean | null;
  hsa_current_balance?: number | null;
  fsa_eligible?: boolean | null;
  fsa_election_amount?: number | null;
  employer_match_percent?: number | null;
  employer_match_limit_percent?: number | null;
  has_pension?: boolean | null;
  pension_type?: string | null;
  monthly_insurance_premiums?: number | null;
  estimated_marginal_tax_bracket?: number | null;
  estimated_effective_tax_rate?: number | null;
  current_bank?: string | null;
  current_brokerage?: string | null;
  preferred_financial_institution?: string | null;
}

export interface FinancingPreferenceInput {
  liquidity_preference?: 'very_low' | 'low' | 'moderate' | 'high' | 'very_high' | null;
  liquidity_target_months?: number | null;
  debt_pay_weight?: number | null;
  invest_weight?: number | null;
  save_weight?: number | null;
  notes?: string | null;
}

export type DebtType =
  | 'credit_card'
  | 'student_loan'
  | 'personal_loan'
  | 'medical_debt'
  | 'tax_debt'
  | 'family_loan'
  | 'business_loan'
  | 'other';

export interface DebtInput {
  debt_name: string;
  debt_type: DebtType;
  lender?: string | null;
  original_amount?: number | null;
  current_balance: number;
  interest_rate?: number | null;
  minimum_payment?: number | null;
  payoff_strategy?:
    | 'avalanche'
    | 'snowball'
    | 'minimum_only'
    | 'consolidation'
    | 'refinance'
    | 'custom'
    | null;
}

export type InsurancePlanType =
  | 'medical'
  | 'dental'
  | 'vision'
  | 'pharmacy'
  | 'mental_health'
  | 'long_term_disability'
  | 'short_term_disability'
  | 'life'
  | 'accident'
  | 'critical_illness'
  | 'auto'
  | 'home'
  | 'renters'
  | 'umbrella'
  | 'pet'
  | 'other';

export interface InsurancePlanInput {
  plan_type: InsurancePlanType;
  carrier?: string | null;
  plan_name?: string | null;
  plan_id_external?: string | null;
  member_id?: string | null;
  group_number?: string | null;
  effective_date?: string | null;
  termination_date?: string | null;
  is_primary?: boolean;
  source_of_coverage?:
    | 'employer'
    | 'marketplace'
    | 'medicare'
    | 'medicaid'
    | 'va'
    | 'private'
    | null;
  monthly_premium?: number | null;
  annual_deductible?: number | null;
  deductible_met_ytd?: number | null;
  out_of_pocket_max?: number | null;
  out_of_pocket_met_ytd?: number | null;
  copay_primary_care?: number | null;
  copay_specialist?: number | null;
  copay_er?: number | null;
  copay_urgent_care?: number | null;
  coinsurance_percent?: number | null;
  hsa_eligible?: boolean | null;
  fsa_eligible?: boolean | null;
  hra_eligible?: boolean | null;
  network_type?: string | null;
  network_restrictions?: string | null;
  wellness_benefits_summary?: string | null;
}

export interface CareerExtendedInput {
  current_income?: number | null;
  income_trajectory?: 'declining' | 'stable' | 'growing' | 'rapidly_growing' | null;
  promotion_target?: string | null;
  target_income?: number | null;
  time_for_upskilling_hours_per_week?: number | null;
  job_change_willingness?: 'not_open' | 'passive' | 'active' | 'actively_searching' | null;
  entrepreneurial_interest?:
    | 'none'
    | 'curious'
    | 'side_hustle'
    | 'committed'
    | 'currently_running'
    | null;
  networking_capacity?: 'very_low' | 'low' | 'moderate' | 'high' | 'very_high' | null;
  relocation_willingness?: 'not_willing' | 'regional_only' | 'national' | 'international' | null;
  skill_gaps?: string[];
}

export interface EducationIntakeInput {
  highest_completed_degree?: string | null;
  current_program?: string | null;
  current_institution?: string | null;
  expected_completion_date?: string | null;
  tuition_budget_total?: number | null;
  tuition_budget_annual?: number | null;
  willing_to_take_loans?: boolean | null;
  expected_roi_preference?: 'fast_payback' | 'balanced' | 'long_term_value' | null;
  credential_urgency?: 'none' | 'within_year' | 'within_2_years' | 'within_5_years' | null;
  time_available_for_study_hours_per_week?: number | null;
  has_gi_bill?: boolean | null;
  gi_bill_remaining_months?: number | null;
  has_va_benefits?: boolean | null;
  employer_tuition_reimbursement_annual?: number | null;
  scholarships_summary?: string | null;
  desired_schools?: string[];
  financing_options?: string[];
}

export interface EducationCredentialInput {
  credential_kind: 'certification' | 'license' | 'badge' | 'target_credential';
  name: string;
  issuer?: string | null;
  issued_at?: string | null;
  expires_at?: string | null;
  status?: 'active' | 'expired' | 'in_progress' | 'target' | 'lapsed';
  url?: string | null;
  notes?: string | null;
}

export interface FamilyLifestyleInput {
  has_elder_care_responsibilities?: boolean | null;
  elder_care_notes?: string | null;
  caregiving_hours_per_week?: number | null;
  family_financial_obligations_monthly?: number | null;
  willing_to_relocate?: 'no' | 'regional' | 'national' | 'international' | null;
  must_stay_near_family?: boolean | null;
  travel_frequency_target?: 'rarely' | 'occasional' | 'frequent' | 'extensive' | null;
  travel_budget_annual?: number | null;
  lifestyle_goals?: string | null;
  household_priorities?: string[];
}

export interface FamilyProfileFieldsInput {
  marital_status?:
    | 'single'
    | 'partnered'
    | 'married'
    | 'separated'
    | 'divorced'
    | 'widowed'
    | 'prefer_not_to_say'
    | null;
  dependents_count?: number | null;
}

export type OnboardingSectionKey =
  | 'core_life_vision'
  | 'financial'
  | 'career'
  | 'education'
  | 'health_wellness'
  | 'insurance_benefits'
  | 'family_lifestyle'
  | 'risk_decision_preferences'
  | 'commitment_capacity'
  | 'final_review';

export type OnboardingSectionStatus = 'not_started' | 'in_progress' | 'skipped' | 'completed';
