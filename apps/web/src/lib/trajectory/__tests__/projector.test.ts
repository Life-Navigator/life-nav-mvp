/**
 * @jest-environment node
 *
 * Determinism + shape tests for the trajectory projector. Pure-input:
 * no Supabase mocks needed.
 */

import { project, PROJECTOR_VERSION } from '../projector';
import { buildVariant, generateAllVariants } from '../generator';
import { ALL_LABELS, type ProjectorState } from '@/types/trajectory';

function baseState(overrides: Partial<ProjectorState> = {}): ProjectorState {
  return {
    starting_month: 0,
    horizon_months: 60, // 5 years
    annual_gross_income: 120000,
    monthly_take_home: 7000,
    expected_income_growth_pct: 0.03,
    monthly_expenses: 4500,
    expected_inflation_pct: 0.025,
    cash: 10000,
    taxable_investments: 5000,
    retirement_balance: 20000,
    hsa_balance: 0,
    home_equity: 0,
    debts: [
      { label: 'cc', balance: 4500, apr: 0.22, minimum_payment: 120 },
      { label: 'student', balance: 22000, apr: 0.07, minimum_payment: 280 },
    ],
    employer_match_pct: 0.5,
    employer_match_limit_pct: 0.06,
    monthly_retirement_contribution: 400,
    monthly_hsa_contribution: 0,
    monthly_taxable_investing: 200,
    monthly_emergency_fund_topup: 0,
    monthly_extra_debt_payment: 0,
    expected_real_return_pct: 0.06,
    expected_retirement_return_pct: 0.06,
    annual_health_premium: 4200,
    expected_annual_oop: 1500,
    ...overrides,
  };
}

describe('determinism', () => {
  it('same state produces identical output across two runs', () => {
    const s = baseState();
    const a = project(s);
    const b = project(s);
    expect(a).toEqual(b);
  });

  it('engine version is stamped', () => {
    const a = project(baseState());
    expect(a.engine_version).toBe(PROJECTOR_VERSION);
  });
});

describe('shape', () => {
  it('emits horizon_months + 1 metric points', () => {
    const s = baseState({ horizon_months: 24 });
    const out = project(s);
    expect(out.metrics.length).toBe(25); // month 0 .. month 24
  });

  it('emits monotonically increasing at_month values', () => {
    const out = project(baseState({ horizon_months: 12 }));
    for (let i = 1; i < out.metrics.length; i++) {
      expect(out.metrics[i].at_month).toBeGreaterThan(out.metrics[i - 1].at_month);
    }
  });

  it('debt decreases when extra payment is applied', () => {
    const baseline = project(baseState({ horizon_months: 36, monthly_extra_debt_payment: 0 }));
    const paying = project(baseState({ horizon_months: 36, monthly_extra_debt_payment: 200 }));
    const baseDebtFinal = baseline.final_debt;
    const payingDebtFinal = paying.final_debt;
    expect(payingDebtFinal).toBeLessThan(baseDebtFinal);
  });

  it('extra debt payment reduces total debt at horizon', () => {
    const s = baseState({ horizon_months: 60, monthly_extra_debt_payment: 500 });
    const out = project(s);
    // With $500/month extra over 5 years the credit card should be gone.
    expect(out.final_debt).toBeLessThan(s.debts.reduce((a, d) => a + d.balance, 0));
  });

  it('investments grow when taxable contribution is positive and return > 0', () => {
    const s = baseState({
      monthly_taxable_investing: 500,
      expected_real_return_pct: 0.07,
      horizon_months: 60,
    });
    const out = project(s);
    const startInv = s.taxable_investments;
    const endInv = out.metrics[out.metrics.length - 1].taxable_investments;
    expect(endInv).toBeGreaterThan(startInv);
  });

  it('inflation lifts expenses by horizon', () => {
    const s = baseState({ expected_inflation_pct: 0.03, horizon_months: 60 });
    const out = project(s);
    // Year-end monthly cash flow should be lower than month 0's because
    // expenses inflate while take-home grows ~at the same rate. With
    // inflation > income growth (default 2.5% inflation < 3% income), this
    // would invert — so flip the test to use inflation > income growth.
    const inflated = project({
      ...s,
      expected_inflation_pct: 0.05,
      expected_income_growth_pct: 0.0,
    });
    const startCf = inflated.metrics[1].monthly_cash_flow;
    const endCf = inflated.metrics[inflated.metrics.length - 1].monthly_cash_flow;
    expect(endCf).toBeLessThan(startCf);
  });

  it('emergency_months never goes negative', () => {
    const out = project(baseState());
    for (const p of out.metrics) {
      expect(p.emergency_months).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('decisions', () => {
  it('home_purchase decision adds a mortgage and home equity', () => {
    const s = baseState({ horizon_months: 48, cash: 100000 });
    const before = project(s);
    const after = project(s, [
      {
        decision_type: 'home_purchase',
        description: 'buy a home',
        at_month: 6,
        amount: 60000,
        parameters: { home_value: 400000, mortgage_apr: 0.065, mortgage_term_months: 360 },
      },
    ]);
    expect(after.events.length).toBeGreaterThan(0);
    expect(after.events.find((e) => e.event_type === 'home_purchase')).toBeDefined();
    // With a mortgage initiated, end-of-horizon debt should be higher than baseline.
    expect(after.final_debt).toBeGreaterThan(before.final_debt);
  });
});

describe('generator', () => {
  it('produces a variant for every canonical label', () => {
    const variants = generateAllVariants(
      baseState({
        monthly_taxable_investing: 0,
        monthly_retirement_contribution: 0,
        monthly_extra_debt_payment: 0,
      })
    );
    expect(variants.map((v) => v.label).sort()).toEqual([...ALL_LABELS].sort());
  });

  it('aggressive_upside has higher taxable_investing knob than conservative', () => {
    const base = baseState({
      monthly_taxable_investing: 0,
      monthly_retirement_contribution: 0,
      monthly_extra_debt_payment: 0,
    });
    const v1 = buildVariant('conservative', base, 1000, {});
    const v2 = buildVariant('aggressive_upside', base, 1000, {});
    expect(v2.state.monthly_taxable_investing).toBeGreaterThan(v1.state.monthly_taxable_investing);
  });

  it('goal_optimized with a home stated goal schedules a home_purchase decision', () => {
    const base = baseState({
      monthly_taxable_investing: 0,
      monthly_retirement_contribution: 0,
      monthly_extra_debt_payment: 0,
    });
    const v = buildVariant('goal_optimized', base, 1000, { stated_goal: 'save for a house' });
    expect(v.decisions.find((d) => d.decision_type === 'home_purchase')).toBeDefined();
  });
});
