/**
 * @jest-environment node
 *
 * Deterministic tests for the Dynamic Goal Optimizer engine. Pure-input
 * unit tests — no Supabase mocking needed because the engine module
 * splits I/O (loadInputs) from logic (run / scoreAll / buildAllocation).
 */

import { scoreAll } from '../scoring';
import {
  buildAllocation,
  buildTradeoffs,
  buildNextBestAction,
  inferTrueGoal,
  run,
} from '../engine';
import type { OptimizerInputs } from '@/types/optimizer';

function baseInputs(overrides: Partial<OptimizerInputs> = {}): OptimizerInputs {
  return {
    monthly_surplus: 1000,
    user_goal_id: null,
    stated_goal: null,
    profile: {
      annual_income: 120000,
      household_annual_income: 120000,
      monthly_expenses: 5000,
      monthly_discretionary_income: 1500,
      emergency_fund_amount: 30000,
      emergency_fund_months: 6,
      credit_score_range: '740_799',
      credit_card_utilization: 10,
      hsa_eligible: false,
      hsa_current_balance: null,
      fsa_eligible: false,
      employer_match_percent: 0,
      employer_match_limit_percent: 0,
      has_pension: false,
      estimated_marginal_tax_bracket: 0.24,
    },
    debts: [],
    insurance: [
      { plan_type: 'medical', is_active: true },
      { plan_type: 'dental', is_active: true },
      { plan_type: 'long_term_disability', is_active: true },
      { plan_type: 'life', is_active: true },
    ],
    risk: [],
    decision_preferences: [],
    career: null,
    education: null,
    goals: [],
    ...overrides,
  };
}

describe('determinism', () => {
  it('the same input produces the same allocations every run', () => {
    const i = baseInputs({
      debts: [
        {
          debt_type: 'credit_card',
          current_balance: 4500,
          interest_rate: 0.22,
          minimum_payment: 120,
        },
      ],
    });
    const a = run(i);
    const b = run(i);
    expect(a).toEqual(b);
  });
});

describe('hard-priority routing', () => {
  it('routes meaningfully to high_interest_debt when a high-APR debt is present', () => {
    const i = baseInputs({
      debts: [
        {
          debt_type: 'credit_card',
          current_balance: 4500,
          interest_rate: 0.2299,
          minimum_payment: 120,
        },
      ],
    });
    const out = run(i);
    const top = out.allocations[0];
    expect(top.category).toBe('high_interest_debt');
    expect(top.amount_usd).toBeGreaterThan(i.monthly_surplus * 0.1);
  });

  it('routes meaningfully to emergency_fund when EF months are 0', () => {
    const i = baseInputs({
      profile: { ...baseInputs().profile!, emergency_fund_months: 0, emergency_fund_amount: 0 },
    });
    const out = run(i);
    expect(out.allocations[0].category).toBe('emergency_fund');
  });

  it('routes meaningfully to retirement_match when a match exists', () => {
    const i = baseInputs({
      profile: {
        ...baseInputs().profile!,
        employer_match_percent: 50,
        employer_match_limit_percent: 6,
      },
    });
    const out = run(i);
    const match = out.allocations.find((a) => a.category === 'retirement_match');
    expect(match).toBeDefined();
    expect(match?.amount_usd ?? 0).toBeGreaterThan(0);
  });

  it('routes meaningfully to insurance_gap_coverage when no medical plan is on file', () => {
    const i = baseInputs({
      insurance: [{ plan_type: 'dental', is_active: true }],
    });
    const out = run(i);
    const gap = out.allocations.find((a) => a.category === 'insurance_gap_coverage');
    expect(gap).toBeDefined();
    expect(gap?.amount_usd ?? 0).toBeGreaterThan(0);
  });
});

describe('allocation normalization', () => {
  it('the sum of all allocations equals the monthly surplus (to the dollar)', () => {
    for (const surplus of [200, 500, 1500, 12345]) {
      const i = baseInputs({
        monthly_surplus: surplus,
        debts: [
          {
            debt_type: 'credit_card',
            current_balance: 4500,
            interest_rate: 0.21,
            minimum_payment: 120,
          },
        ],
        profile: {
          ...baseInputs().profile!,
          emergency_fund_months: 2,
          employer_match_percent: 50,
          employer_match_limit_percent: 6,
        },
      });
      const out = run(i);
      const total = out.allocations.reduce((a, b) => a + b.amount_usd, 0);
      expect(total).toBe(surplus);
    }
  });

  it('produces no negative allocations', () => {
    const i = baseInputs();
    const out = run(i);
    for (const a of out.allocations) expect(a.amount_usd).toBeGreaterThanOrEqual(0);
  });

  it('share_pct values are within [0, 100]', () => {
    const i = baseInputs();
    const out = run(i);
    for (const a of out.allocations) {
      expect(a.share_pct).toBeGreaterThanOrEqual(0);
      expect(a.share_pct).toBeLessThanOrEqual(100.01);
    }
  });

  it('returns empty allocations when surplus is 0', () => {
    const i = baseInputs({ monthly_surplus: 0 });
    expect(buildAllocation(scoreAll(i), 0)).toEqual([]);
  });
});

describe('decision-preference weighting', () => {
  it('minimize_stress + a moderately scored EF biases more toward emergency_fund', () => {
    // EF months=4 puts the rule below the hard-priority saturation point,
    // so the decision-preference multiplier should produce a measurable
    // lift over the neutral baseline.
    const baseline = baseInputs({
      profile: { ...baseInputs().profile!, emergency_fund_months: 4 },
    });
    const stressed = baseInputs({
      profile: { ...baseInputs().profile!, emergency_fund_months: 4 },
      decision_preferences: [{ axis: 'minimize_stress', weight: 1 }],
    });
    const baseEf =
      run(baseline).allocations.find((a) => a.category === 'emergency_fund')?.amount_usd ?? 0;
    const stressEf =
      run(stressed).allocations.find((a) => a.category === 'emergency_fund')?.amount_usd ?? 0;
    expect(stressEf).toBeGreaterThanOrEqual(baseEf);
  });

  it('maximize_long_term_net_worth lifts retirement allocations when a match is available', () => {
    const baseline = baseInputs({
      profile: {
        ...baseInputs().profile!,
        employer_match_percent: 50,
        employer_match_limit_percent: 6,
      },
    });
    const wealthy = baseInputs({
      profile: {
        ...baseInputs().profile!,
        employer_match_percent: 50,
        employer_match_limit_percent: 6,
      },
      decision_preferences: [{ axis: 'maximize_long_term_net_worth', weight: 1 }],
    });
    const baseRet =
      run(baseline).allocations.find((a) => a.category === 'retirement_match')?.amount_usd ?? 0;
    const wealthyRet =
      run(wealthy).allocations.find((a) => a.category === 'retirement_match')?.amount_usd ?? 0;
    expect(wealthyRet).toBeGreaterThanOrEqual(baseRet);
  });
});

describe('true-goal inference', () => {
  it('infers debt-payoff stated goal as financial fragility reduction', () => {
    const out = inferTrueGoal(baseInputs({ stated_goal: 'pay off my credit cards' }));
    expect(out.inferred_true_goal.toLowerCase()).toContain('cash flow');
  });

  it('infers retirement / FI as portfolio coverage', () => {
    const out = inferTrueGoal(baseInputs({ stated_goal: 'I want to retire early' }));
    expect(out.inferred_true_goal.toLowerCase()).toContain('portfolio');
  });

  it('infers home-related stated goal as down-payment reach', () => {
    const out = inferTrueGoal(baseInputs({ stated_goal: 'save for a house' }));
    expect(out.inferred_true_goal.toLowerCase()).toContain('down-payment');
  });
});

describe('tradeoffs + next best action', () => {
  it('surfaces the match-vs-debt tradeoff when both are scored', () => {
    const i = baseInputs({
      profile: {
        ...baseInputs().profile!,
        employer_match_percent: 50,
        employer_match_limit_percent: 6,
      },
      debts: [
        {
          debt_type: 'credit_card',
          current_balance: 4500,
          interest_rate: 0.22,
          minimum_payment: 120,
        },
      ],
    });
    const allocations = run(i).allocations;
    const tradeoffs = buildTradeoffs(allocations);
    expect(
      tradeoffs.find((t) => t.axis_a === 'retirement_match' && t.axis_b === 'high_interest_debt')
    ).toBeDefined();
  });

  it('next-best-action references the top dollar allocation', () => {
    const i = baseInputs({
      debts: [
        {
          debt_type: 'credit_card',
          current_balance: 4500,
          interest_rate: 0.22,
          minimum_payment: 120,
        },
      ],
    });
    const out = run(i);
    expect(buildNextBestAction(out.allocations).toLowerCase()).toMatch(/high-apr|credit|debt/);
  });
});
