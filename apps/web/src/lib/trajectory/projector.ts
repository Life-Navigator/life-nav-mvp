/**
 * Deterministic month-by-month life-trajectory projector.
 *
 * Inputs are pure data (`ProjectorState` + scheduled `ScenarioDecision`s).
 * Output is the per-month metric series + final headline numbers. No I/O.
 *
 * The projector is intentionally simple and explicit so every assumption
 * is auditable:
 *   - Investment returns compound at a constant monthly rate
 *     (expected_real_return_pct / 12). No Monte Carlo here — that's a
 *     follow-up wrapper.
 *   - Debt is paid down highest-APR first ("avalanche"); extra payment
 *     is applied to the top-APR balance after minimums.
 *   - Inflation lifts expenses at expected_inflation_pct / 12 per month.
 *   - Income grows at expected_income_growth_pct / 12 per month.
 *   - Health-cost exposure is annualised premium + expected OOP.
 *
 * Every assumption is also returned in `output.assumptions` so callers
 * can persist them alongside the run.
 */

import type {
  ProjectorAssumption,
  ProjectorDebt,
  ProjectorMetricsPoint,
  ProjectorOutput,
  ProjectorState,
  ScenarioDecision,
} from '@/types/trajectory';

export const PROJECTOR_VERSION = 'v1';

function monthlyRate(annualPct: number): number {
  // Exact monthly compounding equivalent of an annual rate.
  return Math.pow(1 + annualPct, 1 / 12) - 1;
}

function clamp(n: number, lo: number, hi: number): number {
  if (Number.isNaN(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}

function cloneDebt(d: ProjectorDebt): ProjectorDebt {
  return { ...d };
}

function totalDebt(debts: ProjectorDebt[]): number {
  return debts.reduce((a, d) => a + Math.max(0, d.balance), 0);
}

/**
 * Apply a scheduled decision at a given month. Mutates `state` in place.
 * Returns the impact deltas the caller may want to log as an event.
 */
function applyDecision(state: WorkingState, d: ScenarioDecision): Record<string, number> {
  const impact: Record<string, number> = {};
  const amt = Math.max(0, Number(d.amount ?? 0));
  switch (d.decision_type) {
    case 'pay_debt': {
      // Pay against the highest-APR balance.
      const debts = state.debts.slice().sort((a, b) => b.apr - a.apr);
      let remaining = amt;
      for (const orig of debts) {
        if (remaining <= 0) break;
        const cur = state.debts.find((x) => x === orig);
        if (!cur || cur.balance <= 0) continue;
        const take = Math.min(remaining, cur.balance);
        cur.balance -= take;
        state.cash -= take;
        remaining -= take;
        impact[`pay_debt_${cur.label}`] = -take;
      }
      break;
    }
    case 'invest_taxable':
      state.cash -= amt;
      state.taxable_investments += amt;
      impact.taxable_investments = amt;
      break;
    case 'contribute_retirement':
      state.cash -= amt;
      state.retirement_balance += amt;
      impact.retirement_balance = amt;
      break;
    case 'contribute_hsa':
      state.cash -= amt;
      state.hsa_balance += amt;
      impact.hsa_balance = amt;
      break;
    case 'add_to_emergency_fund':
      impact.cash = amt;
      // Cash already accumulates from cash flow; this lets the user
      // explicitly schedule top-ups in addition to default flow.
      state.cash += 0; // no-op marker — left for clarity
      break;
    case 'add_to_down_payment':
      state.cash -= amt;
      state.home_equity += amt;
      impact.home_equity = amt;
      break;
    case 'home_purchase': {
      const downPayment = amt;
      const homeValue = Number(d.parameters?.home_value ?? amt * 5);
      const mortgageBalance = Math.max(0, homeValue - downPayment);
      const mortgageApr = Number(d.parameters?.mortgage_apr ?? 0.06);
      const mortgageTerm = Number(d.parameters?.mortgage_term_months ?? 360);
      state.cash -= downPayment;
      state.home_equity += downPayment;
      if (mortgageBalance > 0) {
        const r = mortgageApr / 12;
        const n = mortgageTerm;
        const monthlyPmt = (mortgageBalance * r) / (1 - Math.pow(1 + r, -n));
        state.debts.push({
          label: 'mortgage',
          balance: mortgageBalance,
          apr: mortgageApr,
          minimum_payment: monthlyPmt,
        });
        impact.mortgage_initiated = mortgageBalance;
      }
      impact.home_purchase = downPayment;
      break;
    }
    case 'enroll_education': {
      // Charge tuition out of cash; income uplift applied at completion if provided.
      state.cash -= amt;
      impact.education_outlay = -amt;
      const completionMonth = Number(d.parameters?.completion_month);
      const incomeUpliftAnnual = Number(d.parameters?.income_uplift_annual ?? 0);
      if (Number.isFinite(completionMonth) && incomeUpliftAnnual > 0) {
        state.pendingIncomeUplifts.push({ at_month: completionMonth, annual: incomeUpliftAnnual });
      }
      break;
    }
    case 'career_change': {
      const newAnnualIncome = Number(d.parameters?.annual_income ?? state.annual_gross_income);
      state.annual_gross_income = newAnnualIncome;
      state.monthly_take_home = Number(d.parameters?.monthly_take_home ?? state.monthly_take_home);
      impact.annual_income_set = newAnnualIncome;
      break;
    }
    case 'retire': {
      // From this month forward, treat employment income as zero.
      state.retired_at = state.month_index;
      impact.retired = 1;
      break;
    }
    default:
      // 'other' or unknown — log only.
      impact.note = 0;
  }
  return impact;
}

interface WorkingState {
  month_index: number;
  annual_gross_income: number;
  monthly_take_home: number;
  monthly_expenses: number;
  cash: number;
  taxable_investments: number;
  retirement_balance: number;
  hsa_balance: number;
  home_equity: number;
  debts: ProjectorDebt[];
  retired_at: number | null;
  pendingIncomeUplifts: Array<{ at_month: number; annual: number }>;
}

function netWorth(s: WorkingState): number {
  return (
    s.cash +
    s.taxable_investments +
    s.retirement_balance +
    s.hsa_balance +
    s.home_equity -
    totalDebt(s.debts)
  );
}

function emergencyMonths(s: WorkingState): number {
  if (s.monthly_expenses <= 0) return Infinity;
  return s.cash / s.monthly_expenses;
}

function annualizedHealthCost(s: ProjectorState): number {
  return Math.max(0, s.annual_health_premium + s.expected_annual_oop);
}

function applyDebtMonthly(s: WorkingState): {
  interest_charged: number;
  principal_paid: number;
  minimum_total: number;
} {
  let interest_charged = 0;
  let principal_paid = 0;
  let minimum_total = 0;
  for (const d of s.debts) {
    if (d.balance <= 0) continue;
    const interest = d.balance * (d.apr / 12);
    d.balance += interest;
    interest_charged += interest;
    const pay = Math.min(d.minimum_payment, d.balance);
    d.balance -= pay;
    principal_paid += Math.max(0, pay - interest);
    minimum_total += pay;
  }
  return { interest_charged, principal_paid, minimum_total };
}

function applyExtraDebtPayment(s: WorkingState, extra: number): number {
  if (extra <= 0) return 0;
  let remaining = extra;
  const debts = s.debts.slice().sort((a, b) => b.apr - a.apr);
  for (const orig of debts) {
    if (remaining <= 0) break;
    const cur = s.debts.find((x) => x === orig);
    if (!cur || cur.balance <= 0) continue;
    const take = Math.min(remaining, cur.balance);
    cur.balance -= take;
    remaining -= take;
  }
  return extra - remaining;
}

/**
 * Run the projector. Pure: same input → same output.
 */
export function project(
  initial: ProjectorState,
  decisions: ScenarioDecision[] = []
): ProjectorOutput {
  const horizon = Math.max(1, Math.min(720, initial.horizon_months));
  const incomeMonthlyRate = monthlyRate(initial.expected_income_growth_pct);
  const inflationMonthlyRate = monthlyRate(initial.expected_inflation_pct);
  const taxableReturnMonthly = monthlyRate(initial.expected_real_return_pct);
  const retirementReturnMonthly = monthlyRate(initial.expected_retirement_return_pct);

  const state: WorkingState = {
    month_index: 0,
    annual_gross_income: initial.annual_gross_income,
    monthly_take_home: initial.monthly_take_home,
    monthly_expenses: initial.monthly_expenses,
    cash: initial.cash,
    taxable_investments: initial.taxable_investments,
    retirement_balance: initial.retirement_balance,
    hsa_balance: initial.hsa_balance,
    home_equity: initial.home_equity,
    debts: initial.debts.map(cloneDebt),
    retired_at: null,
    pendingIncomeUplifts: [],
  };

  // Index decisions by month for O(1) per-month lookup.
  const decisionsByMonth = new Map<number, ScenarioDecision[]>();
  for (const d of decisions) {
    const m = Math.max(0, Math.min(horizon, Math.floor(d.at_month)));
    const list = decisionsByMonth.get(m) ?? [];
    list.push(d);
    decisionsByMonth.set(m, list);
  }

  const metrics: ProjectorMetricsPoint[] = [];
  const events: ProjectorOutput['events'] = [];

  // Month 0 snapshot.
  metrics.push(snapshot(state, 0, initial));

  for (let m = 1; m <= horizon; m++) {
    state.month_index = m;

    // Apply pending income uplifts (from completed education, etc.).
    const remaining: Array<{ at_month: number; annual: number }> = [];
    for (const p of state.pendingIncomeUplifts) {
      if (p.at_month === m) {
        state.annual_gross_income += p.annual;
        // Approximation: take-home moves with gross by the same ratio.
        const ratio = initial.monthly_take_home / Math.max(1, initial.annual_gross_income / 12);
        state.monthly_take_home += (p.annual / 12) * ratio;
        events.push({
          at_month: m,
          event_type: 'income_uplift',
          description: 'Education completion raised annual income.',
          impact: { annual_income_added: p.annual },
        });
      } else {
        remaining.push(p);
      }
    }
    state.pendingIncomeUplifts = remaining;

    // Drift income + expenses (very slow at monthly cadence).
    if (state.retired_at == null) {
      state.annual_gross_income *= 1 + incomeMonthlyRate;
      state.monthly_take_home *= 1 + incomeMonthlyRate;
    }
    state.monthly_expenses *= 1 + inflationMonthlyRate;

    // Income for this month.
    const monthIncome = state.retired_at == null ? state.monthly_take_home : 0;
    state.cash += monthIncome;
    state.cash -= state.monthly_expenses;

    // Employer match — only while employed.
    if (
      state.retired_at == null &&
      initial.employer_match_pct > 0 &&
      initial.employer_match_limit_pct > 0
    ) {
      const employee = Math.min(
        initial.monthly_retirement_contribution,
        (state.annual_gross_income / 12) * initial.employer_match_limit_pct
      );
      const employer = employee * initial.employer_match_pct;
      // Employee contribution moves cash → retirement.
      state.cash -= employee;
      state.retirement_balance += employee + employer;
    } else if (initial.monthly_retirement_contribution > 0) {
      state.cash -= initial.monthly_retirement_contribution;
      state.retirement_balance += initial.monthly_retirement_contribution;
    }

    if (initial.monthly_hsa_contribution > 0) {
      state.cash -= initial.monthly_hsa_contribution;
      state.hsa_balance += initial.monthly_hsa_contribution;
    }
    if (initial.monthly_taxable_investing > 0) {
      state.cash -= initial.monthly_taxable_investing;
      state.taxable_investments += initial.monthly_taxable_investing;
    }

    // Debt: interest then minimum payment, then extra.
    const debtSummary = applyDebtMonthly(state);
    applyExtraDebtPayment(state, initial.monthly_extra_debt_payment);

    // Investment growth.
    state.taxable_investments *= 1 + taxableReturnMonthly;
    state.retirement_balance *= 1 + retirementReturnMonthly;
    state.hsa_balance *= 1 + retirementReturnMonthly;

    // Discrete scheduled decisions.
    const decs = decisionsByMonth.get(m);
    if (decs) {
      for (const d of decs) {
        const impact = applyDecision(state, d);
        events.push({
          at_month: m,
          event_type: d.decision_type,
          description: d.description ?? '',
          impact,
        });
      }
    }

    metrics.push(snapshot(state, m, initial, debtSummary.minimum_total));
  }

  const final = metrics[metrics.length - 1];
  const retirementReady =
    state.retirement_balance + state.taxable_investments + state.hsa_balance >=
    state.monthly_expenses * 12 * 25;

  const risks = buildRisks(state, initial, final);
  const upsides = buildUpsides(state, initial, final);

  return {
    final_net_worth: final.net_worth,
    final_debt: final.total_debt,
    final_annual_income: state.annual_gross_income,
    final_emergency_months: final.emergency_months,
    final_health_cost_exposure: final.health_cost_exposure,
    retirement_ready: retirementReady,
    recommended: false, // generator decides this across the cohort
    rationale: rationaleFor(state, initial),
    risks,
    upside_factors: upsides,
    metrics,
    events,
    assumptions: buildAssumptions(initial),
    engine_version: PROJECTOR_VERSION,
  };
}

function snapshot(
  s: WorkingState,
  m: number,
  initial: ProjectorState,
  minimum_debt_payment: number = 0
): ProjectorMetricsPoint {
  const nw = netWorth(s);
  return {
    at_month: m,
    net_worth: round(nw),
    cash: round(s.cash),
    taxable_investments: round(s.taxable_investments),
    retirement_balance: round(s.retirement_balance),
    hsa_balance: round(s.hsa_balance),
    total_debt: round(totalDebt(s.debts)),
    emergency_months: round(clamp(emergencyMonths(s), 0, 100)),
    annual_income: round(s.annual_gross_income),
    monthly_cash_flow: round(s.monthly_take_home - s.monthly_expenses - minimum_debt_payment),
    health_cost_exposure: round(annualizedHealthCost(initial)),
  };
}

function rationaleFor(s: WorkingState, initial: ProjectorState): string {
  const pieces: string[] = [];
  if (s.cash > initial.monthly_expenses * 6) {
    pieces.push('comfortable cash cushion at horizon');
  }
  if (totalDebt(s.debts) === 0) pieces.push('all debt paid off');
  if (s.retirement_balance + s.taxable_investments > initial.monthly_expenses * 12 * 20) {
    pieces.push('investment balance approaches retirement readiness');
  }
  return pieces.length ? pieces.join('; ') : 'baseline projection with no major inflection';
}

function buildRisks(
  s: WorkingState,
  initial: ProjectorState,
  final: ProjectorMetricsPoint
): string[] {
  const r: string[] = [];
  if (final.emergency_months < 3) r.push('Emergency fund below 3 months at horizon.');
  if (final.total_debt > 0)
    r.push(`Outstanding debt of $${final.total_debt.toLocaleString()} at horizon.`);
  if (s.cash < 0) r.push('Projected cash deficit — surplus assumptions may be too aggressive.');
  if (initial.expected_real_return_pct > 0.09) {
    r.push('Investment return assumption (>9% real) is optimistic relative to long-run averages.');
  }
  return r;
}

function buildUpsides(
  s: WorkingState,
  initial: ProjectorState,
  final: ProjectorMetricsPoint
): string[] {
  const u: string[] = [];
  if (final.total_debt === 0) u.push('Debt-free at horizon.');
  if (initial.employer_match_pct > 0 && initial.monthly_retirement_contribution > 0) {
    u.push('Capturing employer retirement match.');
  }
  if (final.net_worth > initial.annual_gross_income * 5) {
    u.push('Net worth approaches 5x current annual income.');
  }
  return u;
}

function buildAssumptions(s: ProjectorState): ProjectorAssumption[] {
  return [
    {
      key: 'compounding',
      value: 'monthly',
      rationale:
        'Investments and inflation compound monthly. Returns are deterministic — Monte Carlo is a follow-up wrapper.',
    },
    {
      key: 'expected_real_return_pct',
      value: s.expected_real_return_pct,
      rationale:
        'Long-run real return on taxable investments before fees. Conservative defaults are recommended.',
    },
    {
      key: 'expected_retirement_return_pct',
      value: s.expected_retirement_return_pct,
      rationale:
        'Long-run return on the retirement portfolio (typically lower than taxable due to glide-path).',
    },
    {
      key: 'expected_inflation_pct',
      value: s.expected_inflation_pct,
      rationale: 'Annual inflation lifts the expense line monthly.',
    },
    {
      key: 'expected_income_growth_pct',
      value: s.expected_income_growth_pct,
      rationale: 'Annual income growth lifts take-home pay monthly until retirement.',
    },
    {
      key: 'debt_strategy',
      value: 'avalanche_with_minimums',
      rationale:
        'Minimum payments are honored every month; extra payment is applied to the highest-APR balance.',
    },
    {
      key: 'retirement_readiness_threshold',
      value: '25x_expenses',
      rationale:
        'A common rule-of-thumb that 25× annual expenses indicates retirement readiness. Replace with your own thresholds when you customize.',
    },
    {
      key: 'planning_language_only',
      value: true,
      rationale:
        'This is a scenario projection, not a guarantee, recommendation, or individualized investment advice.',
    },
  ];
}

function round(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}
