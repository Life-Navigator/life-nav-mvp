import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Persona-aware recommendation engine (deterministic, no model call).
 *
 * Reads PERSISTED finance data (finance.financial_accounts + finance.transactions)
 * and persona metadata (public.user_persona_profile) and returns a ranked set of
 * AT LEAST three recommendations per user — one immediate action, one risk
 * reduction, one growth/opportunity — tailored to the persona's stability,
 * income type, debt, and life stage.
 *
 * Source of truth for the rule design: RECOMMENDATION_GOLDEN_SET.md.
 *
 * Hard rules enforced here (Recommendation Quality Remediation Sprint):
 *  - Debt-before-invest: never recommend investing ahead of high-interest
 *    REVOLVING debt; the invest-themed growth slot is gated when it exists.
 *  - Fragile personas get STABILIZATION, never "send spare cash to the card"
 *    or "invest the surplus".
 *  - Self-employed personas get a tax set-aside (a RANGE, not a promise).
 *  - Bonus-eligible personas get a bonus/equity allocation ladder.
 *  - Compliance language: no "guaranteed / certain / will earn / risk-free".
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Svc = SupabaseClient<any, any, any>;

export type RecSeverity = 'risk' | 'caution' | 'positive' | 'neutral';
export type RecCategory = 'immediate_action' | 'risk_reduction' | 'growth_opportunity';

export interface Recommendation {
  category: RecCategory;
  title: string; // the < 10s line
  detail: string; // one or two supporting sentences (the "why")
  action: string; // the concrete next step
  metric: string; // the number that makes it real
  severity: RecSeverity;
  /** Internal theme tag used to keep the three slots distinct. */
  theme: string;
  /** Overall priority; lower = more urgent. */
  rank: number;
}

export interface RecommendationSet {
  persona_id?: string;
  has_data: boolean;
  recommendations: Recommendation[];
}

/** Words that imply certainty we cannot promise. Used by the engine AND tests. */
export const PROHIBITED_LANGUAGE: RegExp[] = [
  /\bguaranteed?\b/i,
  /\bcertain(ly)?\b/i,
  /\bwill earn\b/i,
  /\brisk[-\s]?free\b/i,
];

/** Returns the first prohibited phrase found in `text`, or null. */
export function findProhibitedLanguage(text: string): string | null {
  for (const re of PROHIBITED_LANGUAGE) {
    const m = text.match(re);
    if (m) return m[0];
  }
  return null;
}

interface AccountRow {
  account_type: string;
  current_balance: number | null;
  available_balance: number | null;
  credit_limit: number | null;
  interest_rate: number | null; // APR as a decimal, e.g. 0.2799
}
interface TxnRow {
  amount: number | null;
  transaction_type: string; // 'income' | 'expense' (persist.ts mapping)
  transaction_date: string;
}

const usd = (n: number) =>
  n >= 1000 ? `$${Math.round(n).toLocaleString('en-US')}` : `$${Math.max(0, n).toFixed(0)}`;
const pct = (x: number) => `${Math.round(x * 100)}%`;

const ASSET_TYPES = new Set(['checking', 'savings', 'investment', 'retirement']);

// --- Documented assumptions (deterministic, defensible). ---
const SAVINGS_APY = 0.045; // conservative high-yield savings rate, 2026
const MARKET_HIST = 0.07; // long-run nominal historical stock average (cited, not promised)
const HIGH_APR = 0.15; // threshold for "high-interest" revolving debt
const YEARS_TO_RETIRE: Record<string, number> = {
  early_career: 37,
  mid_career: 27,
  self_employed: 27,
  business_owner: 25,
  family: 25,
  general: 25,
  peak_earning: 12,
  recovery: 25,
  hourly_worker: 25,
};
const futureValue = (annual: number, years: number) =>
  annual * ((Math.pow(1 + MARKET_HIST, years) - 1) / MARKET_HIST);

interface Metrics {
  cash: number;
  assets: number;
  invested: number;
  mortgageBalance: number;
  loanBalance: number;
  cardBalance: number;
  cardLimit: number;
  utilization: number;
  worstApr: number | null;
  worstCardBalance: number;
  hasRetirement: boolean;
  hasMortgage: boolean;
  consumerDebt: number;
  netWorth: number;
  monthlyIncome: number;
  monthlySpend: number;
  runwayMonths: number | null;
  bonusAmount: number;
  isSelfEmployed: boolean;
  bonusEligible: boolean;
  usesEWA: boolean;
  isFragile: boolean;
  isVariableIncome: boolean;
  isWealthy: boolean;
  isFamily: boolean;
  stage: string;
  incomeType: string;
  goal: string;
}

function computeMetrics(
  accounts: AccountRow[],
  txns: TxnRow[],
  persona: Record<string, unknown> | null
): Metrics {
  const bal = (a: AccountRow) => Number(a.current_balance ?? 0);
  const sumWhere = (pred: (a: AccountRow) => boolean) =>
    accounts.filter(pred).reduce((n, a) => n + bal(a), 0);

  const cash = sumWhere((a) => a.account_type === 'checking' || a.account_type === 'savings');
  const assets = sumWhere((a) => ASSET_TYPES.has(a.account_type));
  const invested = sumWhere(
    (a) => a.account_type === 'investment' || a.account_type === 'retirement'
  );
  const mortgageBalance = sumWhere((a) => a.account_type === 'mortgage');
  const loanBalance = sumWhere((a) => a.account_type === 'loan');
  const cards = accounts.filter((a) => a.account_type === 'credit_card');
  const cardBalance = cards.reduce((n, a) => n + bal(a), 0);
  const cardLimit = cards.reduce((n, a) => n + Number(a.credit_limit ?? 0), 0);
  const utilization = cardLimit > 0 ? cardBalance / cardLimit : 0;
  const worst = cards
    .filter((c) => bal(c) > 50 && (c.interest_rate ?? 0) > 0)
    .sort((a, b) => (b.interest_rate ?? 0) - (a.interest_rate ?? 0))[0];
  const worstApr = worst ? (worst.interest_rate as number) : null;
  const worstCardBalance = worst ? bal(worst) : 0;
  const hasRetirement = accounts.some((a) => a.account_type === 'retirement');
  const hasMortgage = accounts.some((a) => a.account_type === 'mortgage');
  const consumerDebt = cardBalance; // mortgages/loans are asset-backed; judge solvency on cards
  const netWorth = assets - consumerDebt;

  // Income/spend estimate from ~1 month of persisted txns. persist.ts maps a
  // negative Plaid amount (money in) to 'income' and a positive one to 'expense'.
  const incomeTxns = txns
    .filter((t) => t.transaction_type === 'income')
    .map((t) => Math.abs(Number(t.amount ?? 0)));
  const expenseSum = txns
    .filter((t) => t.transaction_type === 'expense')
    .reduce((n, t) => n + Math.abs(Number(t.amount ?? 0)), 0);
  const monthlyIncome = incomeTxns.reduce((n, v) => n + v, 0);
  // When explicit expense txns are thin (sandbox often persists few), fall back
  // to a conservative fraction of income so runway is still meaningful.
  const monthlySpend = expenseSum >= 200 ? expenseSum : monthlyIncome > 0 ? monthlyIncome * 0.8 : 0;
  const runwayMonths = monthlySpend > 0 ? cash / monthlySpend : null;

  const incomeType = String(persona?.income_type ?? '');
  const stage = String(persona?.life_stage ?? '');
  const personaId = String(persona?.persona_id ?? '');
  const goal =
    Array.isArray(persona?.primary_goals) && (persona!.primary_goals as unknown[]).length
      ? String((persona!.primary_goals as unknown[])[0])
      : 'reach your next financial goal';

  const isSelfEmployed =
    /1099|self|freelanc|contractor|consultant|business revenue|irregular|owner draw|commission|real estate/i.test(
      incomeType
    ) || ['self_employed', 'business_owner'].includes(stage);
  const bonusEligible =
    ['salary_plus_bonus', 'high_income_executive'].includes(personaId) ||
    /bonus|equity|commission|rsu/i.test(incomeType);

  // Bonus / windfall: a lump income txn well above the regular cadence — only
  // meaningful for bonus-eligible W-2 earners. For the self-employed a large
  // client deposit is regular revenue, NOT a windfall, so never treat it as one.
  const sortedIncome = [...incomeTxns].sort((a, b) => b - a);
  const top = sortedIncome[0] ?? 0;
  const rest = sortedIncome.slice(1);
  const median = rest.length ? rest[Math.floor(rest.length / 2)] : 0;
  const bonusAmount =
    bonusEligible && !isSelfEmployed && top >= 5000 && (median === 0 || top >= 1.6 * median)
      ? top
      : 0;
  const usesEWA = /advance|earned[-\s]?wage/i.test(incomeType);
  const isVariableIncome =
    isSelfEmployed ||
    usesEWA ||
    ['hourly_worker', 'recovery', 'self_employed', 'business_owner'].includes(stage);
  const isWealthy = assets >= 500000 || invested >= 250000;
  const isFamily = stage === 'family';
  const isFragile =
    (runwayMonths !== null && runwayMonths < 1) ||
    cash < 1000 ||
    (usesEWA && cash < 3000) ||
    (stage === 'recovery' && cash < 2000);

  return {
    cash,
    assets,
    invested,
    mortgageBalance,
    loanBalance,
    cardBalance,
    cardLimit,
    utilization,
    worstApr,
    worstCardBalance,
    hasRetirement,
    hasMortgage,
    consumerDebt,
    netWorth,
    monthlyIncome,
    monthlySpend,
    runwayMonths,
    bonusAmount,
    isSelfEmployed,
    bonusEligible,
    usesEWA,
    isFragile,
    isVariableIncome,
    isWealthy,
    isFamily,
    stage,
    incomeType,
    goal,
  };
}

// ----------------------------------------------------------------------------
// Recommendation builders. Each returns a Recommendation or null. Strings are
// authored to be compliance-clean; a scan test enforces it.
// ----------------------------------------------------------------------------

function stabilizeRec(m: Metrics): Recommendation {
  const advanceFraming = m.usesEWA
    ? `Wage advances are among the most expensive money you can use — a flat fee on a small advance works out to a very high effective rate. `
    : `If you're leaning on overdrafts or short-term advances, those fees compound the squeeze. `;
  return {
    category: 'immediate_action',
    title: `Steady your cash flow before anything else`,
    detail: `${advanceFraming}With about ${usd(m.cash)} on hand, the highest-value move right now is breaking that cycle and bringing any past-due minimums current so it doesn't set back your credit.`,
    action: m.usesEWA
      ? `Build a small ${usd(300)} buffer (even ${usd(20)}/week) so you can stop advancing your pay, then bring any past-due minimums current.`
      : `Bring any past-due minimums current, then start a small ${usd(20)}/week buffer to stop the overdraft cycle.`,
    metric: usd(m.cash),
    severity: 'risk',
    theme: 'stabilize',
    rank: 0,
  };
}

function debtPayoffRec(m: Metrics, rank: number, asImmediate: boolean): Recommendation | null {
  if (m.worstApr === null || m.worstCardBalance < 250) return null;
  const apr = m.worstApr;
  const b = m.worstCardBalance;
  const annualInterest = Math.round(b * apr);
  return {
    category: asImmediate ? 'immediate_action' : 'risk_reduction',
    title: `Pay down your ${pct(apr)} card before adding to investments`,
    detail:
      `That ${usd(b)} balance is accruing an estimated ${usd(annualInterest)}/yr in interest. ` +
      `Paying it down is comparable to locking in a ${pct(apr)} return — well above the ~${pct(
        MARKET_HIST
      )} long-run historical stock-market average, and with far less uncertainty.`,
    action: `Direct spare cash to this balance before adding to savings or investments.`,
    metric: `${pct(apr)} APR`,
    severity: 'risk',
    theme: 'debt',
    rank,
  };
}

function taxSetAsideRec(m: Metrics, rank: number, asImmediate: boolean): Recommendation {
  const base = m.monthlyIncome > 0 ? m.monthlyIncome : m.cash; // rough monthly inflow
  const low = Math.round((base * 0.25) / 50) * 50;
  const high = Math.round((base * 0.3) / 50) * 50;
  return {
    category: asImmediate ? 'immediate_action' : 'risk_reduction',
    title: `Set aside an estimated 25–30% of income for taxes`,
    detail:
      `As ${m.incomeType.toLowerCase() || 'a self-employed earner'}, taxes aren't withheld for you. ` +
      `Based on current data, reserving an estimated 25–30% of each payment in a separate account helps avoid a quarterly-tax surprise — roughly ${usd(
        low
      )}–${usd(high)}/month on recent inflows.`,
    action: `Open a separate "taxes" account and move 25–30% of each deposit the day it lands.`,
    metric: `25–30%`,
    severity: 'caution',
    theme: 'tax',
    rank,
  };
}

function bonusAllocationRec(m: Metrics, rank: number): Recommendation {
  const hasLump = m.bonusAmount > 0;
  const amt = hasLump ? m.bonusAmount : 0;
  return {
    category: hasLump ? 'immediate_action' : 'growth_opportunity',
    title: hasLump
      ? `Run your ${usd(amt)} bonus through a priority ladder`
      : `Have a plan ready for your next bonus or equity vest`,
    detail:
      `${hasLump ? `A larger-than-usual deposit of about ${usd(amt)} landed recently. ` : `Variable comp lands in lumps, so the decision is where it goes. `}` +
      `A common sequence: clear any high-interest debt, top up your emergency reserve, set aside estimated taxes on it, add to tax-advantaged retirement, then taxable investments or liquidity.`,
    action: `Allocate it in that order — debt, reserve, tax, retirement, then liquidity — rather than letting it sit in checking.`,
    metric: hasLump ? usd(amt) : 'plan',
    severity: 'caution',
    theme: 'bonus',
    rank,
  };
}

function deployIdleCashRec(m: Metrics, rank: number): Recommendation {
  const buffer = m.monthlySpend > 0 ? m.monthlySpend * 6 : 25000;
  const idle = Math.max(0, m.cash - buffer);
  const drag = Math.round(idle * (MARKET_HIST - SAVINGS_APY));
  return {
    category: 'immediate_action',
    title: `Put your idle cash to work`,
    detail: `About ${usd(idle)} is sitting in cash beyond a 6-month buffer, earning roughly ${pct(
      SAVINGS_APY
    )} or less. Historically a diversified portfolio has returned more over long periods, though with more short-term variability — an estimated ${usd(
      drag
    )}/yr of opportunity cost at recent rates.`,
    action: `Move the excess above your buffer into a high-yield or invested account on a phased (dollar-cost-averaged) schedule aligned to your risk profile.`,
    metric: `${usd(drag)}/yr`,
    severity: 'caution',
    theme: 'deploy',
    rank,
  };
}

function retirementStartRec(m: Metrics, rank: number, asImmediate: boolean): Recommendation {
  const years = YEARS_TO_RETIRE[m.stage] ?? 25;
  const annualContrib = Math.min(7000, Math.max(1000, Math.round((m.cash * 0.15) / 500) * 500));
  const fv = futureValue(annualContrib, years);
  let detail: string;
  let action: string;
  let metric = usd(fv);
  if (m.isSelfEmployed) {
    detail = `As an owner you can shelter far more than an employee, but no SEP-IRA or Solo 401(k) is showing up — that's tax-deductible retirement room going unused each year.`;
    action = `Open a SEP-IRA before your next quarterly tax payment so this year's contribution is deductible.`;
    metric = '25% of net';
  } else if (m.isFamily) {
    detail = `You're clearly saving for the family, but nothing is going to your own retirement yet — the gap most dual-income households miss.`;
    action = `Each earner confirm the employer 401(k) match is fully captured — that's the highest-return dollar before extra mortgage paydown.`;
    metric = 'employer match';
  } else {
    detail = `You have about ${years} years of compounding ahead — your biggest advantage — and nothing is going into a tax-advantaged account yet. At a historical ~${pct(
      MARKET_HIST
    )} average, ${usd(annualContrib)}/yr could grow to an estimated ${usd(
      fv
    )} by retirement; actual results may vary.`;
    action = `Open a Roth IRA and automate a ${usd(Math.round(annualContrib / 12))}/month contribution this week.`;
  }
  return {
    category: asImmediate ? 'immediate_action' : 'growth_opportunity',
    title: m.isFamily
      ? `Capture your employer 401(k) match — it's the highest-return dollar`
      : m.isSelfEmployed
        ? `Open tax-advantaged retirement room (SEP-IRA / Solo 401(k))`
        : `Start retirement now — ${usd(annualContrib)}/yr could become an estimated ${usd(fv)}`,
    detail,
    action,
    metric,
    severity: 'caution',
    theme: 'retirement',
    rank,
  };
}

function taxOptimizationRec(m: Metrics, rank: number): Recommendation {
  return {
    category: 'growth_opportunity',
    title: `Optimize taxes across your accounts`,
    detail: `With about ${usd(
      m.invested
    )} invested alongside a taxable account, asset location and tax-loss harvesting may reduce your tax drag. At your net worth, a one-time review of equity comp and estate basics could add meaningful value.`,
    action: `Place tax-inefficient assets inside tax-advantaged accounts, harvest losses in the taxable account, and discuss equity-comp and beneficiaries with a tax-aware advisor.`,
    metric: usd(m.invested),
    severity: 'positive',
    theme: 'tax_opt',
    rank,
  };
}

function concentrationRec(m: Metrics, rank: number): Recommendation {
  return {
    category: 'risk_reduction',
    title: `Review concentration and a liquidity plan`,
    detail: `A large share of your wealth sits in a small number of holdings. Diversification and a clear liquidity plan reduce the impact if any single position drops, and keep cash available without forced selling.`,
    action: `Check single-position concentration, set a target allocation, and keep a defined cash/liquidity sleeve.`,
    metric: usd(m.invested),
    severity: 'caution',
    theme: 'concentration',
    rank,
  };
}

function insuranceRec(m: Metrics, rank: number): Recommendation {
  return {
    category: 'risk_reduction',
    title: `Protect both incomes with term life + disability`,
    detail: `With dependents and a ${usd(
      m.mortgageBalance
    )} mortgage, term life and disability coverage for both earners may be the largest unhedged risk in your plan — it comes before extra payments on a low-rate mortgage.`,
    action: `Get term life + disability quotes for both earners and confirm beneficiaries.`,
    metric: usd(m.mortgageBalance),
    severity: 'caution',
    theme: 'insurance',
    rank,
  };
}

function emergencyReserveRec(m: Metrics, rank: number): Recommendation | null {
  const low = m.isVariableIncome ? 6 : 3;
  const high = m.isVariableIncome ? 12 : 6;
  if (m.runwayMonths === null) {
    // No reliable spend signal — still give a target range without a false number.
    return {
      category: 'risk_reduction',
      title: `Build an emergency reserve toward ${low}–${high} months`,
      detail: `For ${m.isVariableIncome ? 'variable' : 'steady'} income, a ${low}–${high}-month reserve is a common target to absorb a job loss or surprise expense without taking on debt.`,
      action: `Automate a weekly transfer to a separate high-yield savings account until you reach the lower end of that range.`,
      metric: `${low}–${high} mo`,
      severity: 'caution',
      theme: 'reserve',
      rank,
    };
  }
  // Only nudge if below the floor for stable income, or below the high band for variable.
  const trigger = m.isVariableIncome ? m.runwayMonths < high : m.runwayMonths < low;
  if (!trigger) return null;
  return {
    category: 'risk_reduction',
    title: `Build your emergency reserve toward ${low}–${high} months`,
    detail: `Your ${usd(m.cash)} in cash covers an estimated ${m.runwayMonths.toFixed(
      1
    )} months of spending. For ${m.isVariableIncome ? 'variable' : 'steady'} income, a ${low}–${high}-month range is a common target.`,
    action: `Automate a weekly transfer until you reach at least ${low} months of expenses.`,
    metric: `${m.runwayMonths.toFixed(1)} mo`,
    severity: 'caution',
    theme: 'reserve',
    rank,
  };
}

function keepCardPaidRec(m: Metrics, rank: number): Recommendation | null {
  if (m.cardBalance < 50 || m.worstApr === null) return null;
  return {
    category: 'risk_reduction',
    title: `Keep your card paid in full each month`,
    detail: `Your ${usd(m.cardBalance)} card balance is low relative to your limit, which suggests you're using it as a payment tool. At ${pct(
      m.worstApr
    )}, carrying it even occasionally is an expensive habit to avoid.`,
    action: `Set autopay to the statement balance so the card never starts accruing interest.`,
    metric: pct(m.worstApr),
    severity: 'neutral',
    theme: 'card',
    rank,
  };
}

function maxTaxAdvantagedRec(m: Metrics, rank: number): Recommendation {
  return {
    category: 'growth_opportunity',
    title: `Max your tax-advantaged space, then invest the rest`,
    detail: `You already hold about ${usd(
      m.invested
    )} invested. Filling tax-advantaged accounts first (401(k) toward the annual max, then a backdoor Roth) shelters more growth than a taxable account before adding there.`,
    action: `Confirm your 401(k) is on pace to the annual max, then route surplus to a backdoor Roth and finally taxable.`,
    metric: usd(m.invested),
    severity: 'positive',
    theme: 'max_contrib',
    rank,
  };
}

function startSmallSaveRec(m: Metrics, rank: number): Recommendation {
  return {
    category: 'growth_opportunity',
    title: `Once cash flow steadies, automate a small save`,
    detail: `Building even a tiny automatic habit now sets up the emergency reserve that ends the reliance on advances and overdrafts. Growth comes after stability, not before it.`,
    action: `When your buffer is in place, automate ${usd(20)}/week into a separate savings account and raise it as income allows.`,
    metric: `${usd(20)}/wk`,
    severity: 'positive',
    theme: 'habit',
    rank,
  };
}

function keepInvestingRec(m: Metrics, rank: number): Recommendation {
  return {
    category: 'growth_opportunity',
    title: `Keep investing consistently toward your goal`,
    detail: `With debt under control and a reserve in place, steady automated contributions are the highest-leverage habit to ${m.goal.toLowerCase()}.`,
    action: `Automate or increase a monthly contribution to a low-cost diversified account aligned to your risk profile.`,
    metric: usd(m.invested),
    severity: 'positive',
    theme: 'invest_surplus',
    rank,
  };
}

// ----------------------------------------------------------------------------
// Assembly: choose distinct recs for the three required slots (+ extras).
// ----------------------------------------------------------------------------

function assemble(m: Metrics): Recommendation[] {
  const hasHighAprDebt = m.worstApr !== null && m.worstApr >= HIGH_APR && m.worstCardBalance >= 250;
  // A card is "revolving debt to clear before investing" only when it looks
  // carried (high utilization or large vs. income/cash), not paid-in-full.
  const revolvingDebt =
    hasHighAprDebt &&
    (m.utilization >= 0.3 ||
      m.worstCardBalance > m.monthlyIncome * 0.5 ||
      m.worstCardBalance > m.cash);

  const used = new Set<string>();
  const out: Recommendation[] = [];
  const take = (rec: Recommendation | null): boolean => {
    if (!rec || used.has(rec.theme)) return false;
    used.add(rec.theme);
    out.push(rec);
    return true;
  };

  // ---- Slot 1: immediate action -------------------------------------------
  if (m.isFragile) {
    take(stabilizeRec(m));
  } else if (revolvingDebt) {
    take(debtPayoffRec(m, 0, true));
  } else if (m.bonusAmount > 0) {
    take(bonusAllocationRec(m, 0));
  } else if (m.isSelfEmployed) {
    take(taxSetAsideRec(m, 0, true));
  } else if (m.isWealthy && m.cash > 50000 && m.invested > 0) {
    take(deployIdleCashRec(m, 0));
  } else if (!m.hasRetirement && m.stage) {
    take(retirementStartRec(m, 0, true));
  } else {
    take(keepInvestingRec(m, 0));
  }
  if (out.length === 0) take(keepInvestingRec(m, 0)); // safety net

  // ---- Slot 2: risk reduction (first applicable, distinct theme) ----------
  // Only frame the card as a paydown target when it looks CARRIED (high util or
  // a large balance); otherwise it's a transactor → "keep it paid in full".
  const carriedCard = hasHighAprDebt && (m.utilization >= 0.3 || m.worstCardBalance >= 5000);
  const riskCandidates: Array<Recommendation | null> = [
    m.isSelfEmployed ? taxSetAsideRec(m, 1, false) : null,
    m.isFamily ? insuranceRec(m, 1) : null,
    carriedCard ? debtPayoffRec(m, 1, false) : null,
    emergencyReserveRec(m, 1),
    m.isWealthy ? concentrationRec(m, 1) : null,
    keepCardPaidRec(m, 1),
  ];
  let gotRisk = false;
  for (const c of riskCandidates) {
    if (c && c.category === 'risk_reduction' && take(c)) {
      gotRisk = true;
      break;
    }
  }
  if (!gotRisk) {
    // Always provide a risk slot.
    take(
      emergencyReserveRec({ ...m, runwayMonths: m.runwayMonths ?? 0 }, 1) ?? {
        category: 'risk_reduction',
        title: `Keep a defined emergency reserve`,
        detail: `A clear, separate reserve keeps a surprise expense from turning into high-interest debt.`,
        action: `Hold 3–6 months of expenses in a separate high-yield account and avoid dipping into it.`,
        metric: `3–6 mo`,
        severity: 'caution',
        theme: 'reserve',
        rank: 1,
      }
    );
  }

  // ---- Slot 3: growth / opportunity (debt-before-invest gated) ------------
  const growthCandidates: Array<Recommendation | null> = m.isFragile
    ? [startSmallSaveRec(m, 2)]
    : revolvingDebt
      ? [
          // Capturing an employer match can make sense even while paying debt;
          // otherwise defer investing until the balance is cleared.
          !m.hasRetirement && m.isFamily ? retirementStartRec(m, 2, false) : null,
          startSmallSaveRec(m, 2),
        ]
      : [
          !m.hasRetirement && m.stage ? retirementStartRec(m, 2, false) : null,
          m.isWealthy ? taxOptimizationRec(m, 2) : null,
          m.hasRetirement ? maxTaxAdvantagedRec(m, 2) : null,
          m.bonusEligible ? bonusAllocationRec(m, 2) : null,
          keepInvestingRec(m, 2),
        ];
  let gotGrowth = false;
  for (const c of growthCandidates) {
    if (c && take(c)) {
      gotGrowth = true;
      break;
    }
  }
  if (!gotGrowth) take(keepInvestingRec(m, 2));

  // ---- Extras: ensure bonus-eligible always see bonus guidance ------------
  if (m.bonusEligible && !used.has('bonus')) {
    out.push(bonusAllocationRec(m, 3));
    used.add('bonus');
  }
  // Self-employed with a carried card also benefit from the explicit paydown.
  if (m.isSelfEmployed && hasHighAprDebt && !used.has('debt')) {
    const d = debtPayoffRec(m, 4, false);
    if (d) {
      out.push(d);
      used.add('debt');
    }
  }

  return out.sort((a, b) => a.rank - b.rank);
}

export async function getRecommendations(svc: Svc, userId: string): Promise<RecommendationSet> {
  const [{ data: accts }, { data: txns }, { data: persona }] = await Promise.all([
    svc
      .schema('finance')
      .from('financial_accounts')
      .select('account_type, current_balance, available_balance, credit_limit, interest_rate')
      .eq('user_id', userId),
    svc
      .schema('finance')
      .from('transactions')
      .select('amount, transaction_type, transaction_date')
      .eq('user_id', userId),
    svc
      .from('user_persona_profile')
      .select('persona_id, display_name, income_type, risk_profile, life_stage, primary_goals')
      .eq('user_id', userId)
      .maybeSingle(),
  ]);

  const accounts = (accts ?? []) as AccountRow[];
  const transactions = (txns ?? []) as TxnRow[];

  if (accounts.length === 0) {
    return { has_data: false, recommendations: [] };
  }

  const m = computeMetrics(accounts, transactions, persona ?? null);
  const recommendations = assemble(m);
  return {
    persona_id: (persona?.persona_id as string | undefined) ?? undefined,
    has_data: true,
    recommendations,
  };
}
