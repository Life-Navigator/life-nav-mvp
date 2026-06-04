import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Server-side "First Insight" engine.
 *
 * Reads the user's PERSISTED finance data (finance.financial_accounts +
 * finance.transactions) and persona metadata (public.user_persona_profile),
 * computes a few real metrics, and returns ONE specific, plain-language insight
 * + recommendation — understandable in < 10 seconds. Deterministic (no model
 * call), so it can be server-rendered on the first dashboard paint.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Svc = SupabaseClient<any, any, any>;

export type InsightSeverity = 'risk' | 'caution' | 'positive' | 'neutral';

export interface FirstInsight {
  headline: string; // the < 10s line
  detail: string; // one supporting sentence
  recommendation: string; // a specific next step
  severity: InsightSeverity;
  metric: string; // the number that makes it real (e.g. "$33,640")
  persona_id?: string;
  has_data: boolean;
}

interface AccountRow {
  account_type: string;
  current_balance: number | null;
  available_balance: number | null;
  credit_limit: number | null;
  interest_rate: number | null; // APR as a decimal, e.g. 0.2199
}
interface TxnRow {
  amount: number | null;
  transaction_type: string;
  transaction_date: string;
}

const usd = (n: number) =>
  n >= 1000 ? `$${Math.round(n).toLocaleString('en-US')}` : `$${n.toFixed(0)}`;
const ASSET_TYPES = new Set(['checking', 'savings', 'investment', 'retirement']);
const DEBT_TYPES = new Set(['credit_card', 'loan', 'mortgage']);

// --- Assumptions (documented so the math is defensible & deterministic). ---
const SAVINGS_APY = 0.045; // ~conservative high-yield savings rate, 2026
const INVEST_RETURN = 0.07; // nominal long-run return for compounding estimates
// Years-to-retirement by life stage (used for opportunity-cost framing).
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
// Future value of a level annual contribution at INVEST_RETURN over `years`.
const futureValue = (annual: number, years: number) =>
  annual * ((Math.pow(1 + INVEST_RETURN, years) - 1) / INVEST_RETURN);

export async function getFirstInsight(svc: Svc, userId: string): Promise<FirstInsight> {
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
    return {
      headline: 'Activate a sample financial profile to see your first insight.',
      detail: 'Pick a profile and your office will read the accounts and brief you in seconds.',
      recommendation: 'Choose a sample financial profile to begin.',
      severity: 'neutral',
      metric: '',
      has_data: false,
    };
  }

  const bal = (a: AccountRow) => Number(a.current_balance ?? 0);
  const sumWhere = (pred: (a: AccountRow) => boolean) =>
    accounts.filter(pred).reduce((n, a) => n + bal(a), 0);

  const cash = sumWhere((a) => a.account_type === 'checking' || a.account_type === 'savings');
  const assets = sumWhere((a) => ASSET_TYPES.has(a.account_type));
  const mortgageBalance = sumWhere((a) => a.account_type === 'mortgage');
  const loanBalance = sumWhere((a) => a.account_type === 'loan');
  const cards = accounts.filter((a) => a.account_type === 'credit_card');
  const cardBalance = cards.reduce((n, a) => n + bal(a), 0);
  const cardLimit = cards.reduce((n, a) => n + Number(a.credit_limit ?? 0), 0);
  const utilization = cardLimit > 0 ? cardBalance / cardLimit : 0;
  const hasRetirement = accounts.some((a) => a.account_type === 'retirement');
  const hasMortgage = accounts.some((a) => a.account_type === 'mortgage');
  // Plaid returns loan/mortgage LIABILITIES but not the backing assets (home,
  // education, business), so counting them makes net worth misleadingly
  // negative. Judge solvency on credit-card ("consumer") debt; surface loans
  // separately.
  const consumerDebt = cardBalance;
  const netWorth = assets - consumerDebt;

  // Monthly outflow estimate from persisted expense transactions. Gate on a
  // few txns so a 1-2-row sandbox fluke can't drive a runway claim (sandbox
  // override txns frequently persist as 0, leaving runway null — handled).
  const expenses = transactions.filter((t) => t.transaction_type === 'expense');
  const monthlyExpenses = expenses.reduce((n, t) => n + Math.abs(Number(t.amount ?? 0)), 0);
  const runwayMonths =
    expenses.length >= 3 && monthlyExpenses > 200 ? cash / monthlyExpenses : null;

  const personaId = persona?.persona_id as string | undefined;
  const base = { persona_id: personaId, has_data: true as const };

  // --- Rule ladder: most salient, money-relevant insight wins. ---

  // 0. High-APR revolving debt vs. what cash earns — the clearest trade-off and
  //    the highest guaranteed "return" available. Fires only when the balance is
  //    large relative to liquid cash (a revolver, not a transactor who clears it
  //    monthly), so a small balance never preempts a bigger-picture insight.
  const worstCard = cards
    .filter((c) => bal(c) > 100 && (c.interest_rate ?? 0) > 0)
    .sort((a, b) => (b.interest_rate ?? 0) - (a.interest_rate ?? 0))[0];
  if (
    worstCard &&
    (worstCard.interest_rate as number) >= 0.1 &&
    bal(worstCard) >= Math.max(300, cash * 0.5)
  ) {
    const apr = worstCard.interest_rate as number;
    const b = bal(worstCard);
    const annualInterest = b * apr;
    const spread = apr - SAVINGS_APY;
    return {
      ...base,
      severity: 'risk',
      metric: `${(apr * 100).toFixed(0)}% APR`,
      headline: `Paying off this ${(apr * 100).toFixed(0)}% card beats any investment you could make right now.`,
      detail: `That ${usd(b)} balance costs about ${usd(annualInterest)}/yr in interest. Cash earns only ~${(SAVINGS_APY * 100).toFixed(1)}%, so every dollar you send to this card is a guaranteed ${(spread * 100).toFixed(0)}% return — beating the market with zero risk.`,
      recommendation: `Send any spare cash to this card before adding to savings or investing.`,
    };
  }

  // 1. High credit-card utilization (fallback when APR isn't available).
  if (utilization >= 0.5 && cardBalance >= 250) {
    return {
      ...base,
      severity: 'risk',
      metric: `${Math.round(utilization * 100)}%`,
      headline: `Your credit cards are ${Math.round(utilization * 100)}% used — that high-interest balance is costing you.`,
      detail: `You're carrying ${usd(cardBalance)} against a ${usd(cardLimit)} limit. Card interest almost always beats what savings earn.`,
      recommendation: `Prioritize paying this down before adding to savings or investing.`,
    };
  }

  // 2. Thin emergency reserves.
  if (runwayMonths !== null && runwayMonths < 3) {
    const weeks = Math.max(1, Math.round(runwayMonths * 4.3));
    return {
      ...base,
      severity: 'caution',
      metric: `${runwayMonths.toFixed(1)} mo`,
      headline: `You have less than 3 months of emergency reserves (about ${weeks} weeks).`,
      detail: `Your ${usd(cash)} in cash covers ~${runwayMonths.toFixed(1)} months of spending. Most plans target 3–6 months.`,
      recommendation: `Automate a weekly transfer to build toward a 3-month cushion.`,
    };
  }

  // 3. Consumer (non-mortgage) debt exceeds savings/assets.
  if (netWorth < 0 && consumerDebt > 0) {
    return {
      ...base,
      severity: 'risk',
      metric: usd(netWorth),
      headline: `Your non-mortgage debt exceeds your savings by ${usd(Math.abs(netWorth))}.`,
      detail: `You hold ${usd(assets)} in assets against ${usd(consumerDebt)} in consumer debt${mortgageBalance > 0 ? ` (plus a ${usd(mortgageBalance)} mortgage)` : ''}. There's a clear fastest path to positive.`,
      recommendation: `Attack the highest-interest balance first while protecting a small cash buffer.`,
    };
  }

  // 4. Idle cash earning less than inflation (genuinely cash-heavy profiles).
  //    Threshold is high so a normal family buffer doesn't read as "idle wealth";
  //    this targets profiles sitting on large cash piles beside invested money.
  if (runwayMonths !== null && runwayMonths > 9 && cash > 75000) {
    const idle = Math.max(0, cash - monthlyExpenses * 6);
    const drag = Math.round(idle * SAVINGS_APY);
    return {
      ...base,
      severity: 'caution',
      metric: `${usd(drag)}/yr`,
      headline: `That idle cash is quietly costing you about ${usd(drag)} a year in foregone yield.`,
      detail: `${usd(cash)} is sitting in cash — well beyond a 6-month buffer. Roughly ${usd(idle)} could be earning ~${(SAVINGS_APY * 100).toFixed(1)}% in a high-yield or invested account instead of ~0%.`,
      recommendation: `Move the excess into a high-yield savings or invested account aligned to your risk profile.`,
    };
  }

  // 5. No retirement account showing up — framed as quantified OPPORTUNITY COST
  //    (future dollars), not a flat "not found". Contribution capacity is
  //    anchored to actual cash; horizon to life stage; growth at INVEST_RETURN.
  if (!hasRetirement && persona?.life_stage && assets >= 2000) {
    const stage = persona.life_stage as string;
    const incomeType = (persona.income_type as string | undefined) ?? '';
    const years = YEARS_TO_RETIRE[stage] ?? 25;
    const annualContrib = Math.min(7000, Math.max(1000, Math.round((cash * 0.15) / 500) * 500));
    const fv = futureValue(annualContrib, years);
    let detail: string;
    let recommendation: string;
    if (stage === 'business_owner' || stage === 'self_employed' || incomeType === 'self_employed') {
      detail = `As an owner you can shelter far more than an employee, but no SEP-IRA or Solo 401(k) is showing up — that's tax-deductible retirement room you're leaving on the table every year.`;
      recommendation = `Open a SEP-IRA before your next quarterly tax payment to deduct this year's contribution.`;
    } else if (stage === 'family') {
      detail = `You're clearly saving for the family, but nothing is going to your own retirement — the gap most dual-income households miss.`;
      recommendation = `Each of you confirm your employer 401(k) match is fully captured — that's free money before anything else.`;
    } else {
      detail = `You have about ${years} years of compounding ahead — your single biggest advantage — and nothing is going into a tax-advantaged account yet.`;
      recommendation = `Open a Roth IRA and automate a ${usd(Math.round(annualContrib / 12))}/month contribution this week.`;
    }
    return {
      ...base,
      severity: 'caution',
      metric: usd(fv),
      headline: `Putting even ${usd(annualContrib)}/yr into retirement now could be worth about ${usd(fv)} by the time you retire.`,
      detail,
      recommendation,
    };
  }

  // 6. Fallback for financially-healthy profiles — quantify the next lever
  //    rather than just reading back a balance. If they hold meaningful cash
  //    beside real investments, the highest-value move is deploying idle cash;
  //    otherwise affirm progress and tie to their goal with a number.
  const invested = sumWhere(
    (a) => a.account_type === 'investment' || a.account_type === 'retirement'
  );
  const goal =
    Array.isArray(persona?.primary_goals) && persona!.primary_goals.length
      ? (persona!.primary_goals[0] as string)
      : 'reach your next financial goal';
  const deployable = Math.max(0, cash - 10000); // keep a flat buffer
  if (invested > 5000 && deployable > 3000) {
    const drag = Math.round(deployable * (INVEST_RETURN - SAVINGS_APY));
    return {
      ...base,
      severity: 'caution',
      metric: `${usd(drag)}/yr`,
      headline: `Your investments are compounding, but ~${usd(deployable)} in spare cash is sitting on the sidelines.`,
      detail: `At your risk level that idle cash could add roughly ${usd(drag)}/yr if invested like the rest of your portfolio instead of sitting in checking.`,
      recommendation: `Move the spare cash above a buffer into your brokerage or a high-yield account this month.`,
    };
  }
  return {
    ...base,
    severity: 'positive',
    metric: usd(assets),
    headline: hasMortgage
      ? `You're managing ${usd(assets)} in savings & investments alongside a ${usd(mortgageBalance)} mortgage.`
      : `You've built ${usd(assets)} across savings & investments — a strong base to ${String(goal).toLowerCase()}.`,
    detail: `Your office has read your accounts and is ready to help you ${String(goal).toLowerCase()}.`,
    recommendation: `Ask your advisor how to ${String(goal).toLowerCase()} from here.`,
  };
}
