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

export async function getFirstInsight(svc: Svc, userId: string): Promise<FirstInsight> {
  const [{ data: accts }, { data: txns }, { data: persona }] = await Promise.all([
    svc
      .schema('finance')
      .from('financial_accounts')
      .select('account_type, current_balance, available_balance, credit_limit')
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

  // Monthly outflow estimate from persisted expense transactions.
  const expenses = transactions.filter((t) => t.transaction_type === 'expense');
  const monthlyExpenses = expenses.reduce((n, t) => n + Math.abs(Number(t.amount ?? 0)), 0);
  const runwayMonths = monthlyExpenses > 200 ? cash / monthlyExpenses : null;

  const personaId = persona?.persona_id as string | undefined;
  const base = { persona_id: personaId, has_data: true as const };

  // --- Rule ladder: most salient, money-relevant insight wins. ---

  // 1. High credit-card utilization (high-interest debt eating into credit).
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
    const idle = cash - (monthlyExpenses * 6 || 0);
    return {
      ...base,
      severity: 'caution',
      metric: usd(cash),
      headline: `${usd(cash)} is sitting in cash — likely earning less than inflation.`,
      detail: `That's well beyond a 6-month buffer; roughly ${usd(Math.max(0, idle))} could be working harder.`,
      recommendation: `Move the excess into higher-yield or invested accounts aligned to your risk profile.`,
    };
  }

  // 5. No retirement account showing up. Framing is stage-aware: for early
  //    earners it's the single biggest opportunity (compounding), for
  //    established earners it's a gap. Requires a little savings so we don't
  //    nag someone with nothing to contribute yet.
  if (!hasRetirement && persona?.life_stage && assets >= 2000) {
    const earlyStage = ['early_career', 'mid_career'].includes(persona.life_stage as string);
    return {
      ...base,
      severity: earlyStage ? 'neutral' : 'caution',
      metric: '0',
      headline: `No retirement account is showing up yet.`,
      detail: earlyStage
        ? `Starting now is your single biggest advantage — decades of compounding work in your favor.`
        : `Tax-advantaged contributions are the highest-leverage move at your stage and aren't showing up yet.`,
      recommendation: `Open or fund a tax-advantaged retirement account (401(k)/IRA) this month.`,
    };
  }

  // 6. Fallback — a confident net-worth summary tied to the persona's goal.
  const goal =
    Array.isArray(persona?.primary_goals) && persona!.primary_goals.length
      ? (persona!.primary_goals[0] as string)
      : 'reach your next financial goal';
  const assetAccounts = accounts.filter((a) => ASSET_TYPES.has(a.account_type)).length;
  return {
    ...base,
    severity: 'positive',
    metric: usd(assets),
    headline: hasMortgage
      ? `You're managing ${usd(assets)} in savings & investments alongside a ${usd(mortgageBalance)} mortgage.`
      : `${usd(assets)} in savings & investments across ${assetAccounts} account${assetAccounts === 1 ? '' : 's'}.`,
    detail: `Your office has read your accounts and is ready to help you ${String(goal).toLowerCase()}.`,
    recommendation: `Ask your advisor how to ${String(goal).toLowerCase()} from here.`,
  };
}
