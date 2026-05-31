/**
 * Build a ProjectorState from the user's owned tables. Used by the
 * /api/simulations/[id]/run route. Defaults are applied for anything
 * the user hasn't told us — annotated in the assumptions the projector
 * writes back.
 */

import type { ProjectorState } from '@/types/trajectory';

export interface BuildStateOptions {
  horizon_years: number;
}

export async function buildBaseStateForUser(
  supabase: unknown,
  userId: string,
  options: BuildStateOptions
): Promise<ProjectorState> {
  const sb: any = supabase;

  const [{ data: profile }, { data: debts }, { data: career }, { data: insurance }] =
    await Promise.all([
      sb
        .schema('finance')
        .from('user_financial_profile')
        .select(
          'annual_income, household_annual_income, monthly_expenses, monthly_discretionary_income, emergency_fund_amount, emergency_fund_months, hsa_eligible, hsa_current_balance, employer_match_percent, employer_match_limit_percent, estimated_marginal_tax_bracket'
        )
        .eq('user_id', userId)
        .maybeSingle(),
      sb
        .schema('finance')
        .from('debts')
        .select('debt_name, debt_type, current_balance, interest_rate, minimum_payment')
        .eq('user_id', userId)
        .eq('is_active', true),
      sb.from('career_profiles').select('current_income').eq('user_id', userId).maybeSingle(),
      sb
        .from('insurance_plans')
        .select('monthly_premium, annual_deductible, out_of_pocket_max, is_active')
        .eq('user_id', userId)
        .eq('is_active', true),
    ]);

  const annual_gross_income = Number(profile?.annual_income ?? career?.current_income ?? 80000);
  const monthly_take_home = Math.round((annual_gross_income * 0.7) / 12); // rough after-tax
  const monthly_expenses = Number(
    profile?.monthly_expenses ?? Math.round((annual_gross_income * 0.45) / 12)
  );
  const cash = Number(profile?.emergency_fund_amount ?? 0);
  const hsa_balance = Number(profile?.hsa_current_balance ?? 0);

  return {
    starting_month: 0,
    horizon_months: Math.max(1, Math.min(720, Math.round(options.horizon_years * 12))),
    annual_gross_income,
    monthly_take_home,
    expected_income_growth_pct: 0.03,
    monthly_expenses,
    expected_inflation_pct: 0.025,
    cash,
    taxable_investments: 0,
    retirement_balance: 0,
    hsa_balance,
    home_equity: 0,
    debts: ((debts ?? []) as Array<any>).map((d) => ({
      label: d.debt_name,
      balance: Number(d.current_balance ?? 0),
      apr: Number(d.interest_rate ?? 0.05),
      minimum_payment: Number(
        d.minimum_payment ?? Math.max(25, Number(d.current_balance ?? 0) * 0.02)
      ),
    })),
    employer_match_pct:
      profile?.employer_match_percent != null ? Number(profile.employer_match_percent) / 100 : 0,
    employer_match_limit_pct:
      profile?.employer_match_limit_percent != null
        ? Number(profile.employer_match_limit_percent) / 100
        : 0,
    monthly_retirement_contribution: 0,
    monthly_hsa_contribution: profile?.hsa_eligible ? 0 : 0,
    monthly_taxable_investing: 0,
    monthly_emergency_fund_topup: 0,
    monthly_extra_debt_payment: 0,
    expected_real_return_pct: 0.06,
    expected_retirement_return_pct: 0.06,
    annual_health_premium: ((insurance ?? []) as Array<any>).reduce(
      (a, p) => a + Number(p.monthly_premium ?? 0) * 12,
      0
    ),
    expected_annual_oop: ((insurance ?? []) as Array<any>).reduce(
      (a, p) => a + Number(p.annual_deductible ?? 0) * 0.3,
      0
    ),
  };
}
