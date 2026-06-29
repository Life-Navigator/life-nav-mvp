// Backend-owned Financial Overview analytics — pure + tested. Computes cash flow, spending trends, upcoming
// bills, balance-grounded insights, and asset totals from REAL rows (finance.transactions / assets /
// financial_accounts). The cardinal rule: missing data is NEVER fabricated as $0 / 100% / "no spending".
// Three honest states everywhere: real value · verified zero (history exists, value truly 0) · unavailable
// (no history to evaluate). "Income but no expense transactions" = expenses UNAVAILABLE, not zero.

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface MissingState {
  reason: string;
  how_to_provide?: string;
  unlocks?: string;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;

const isIncome = (t: any) => t?.transaction_type === 'income';
const cat = (t: any) => (t?.category || 'Other').split(',')[0]?.trim() || 'Other';
const bal = (a: any) => Number(a?.current_balance ?? a?.balance ?? 0);

const LIAB = /credit|loan|mortgage|line_of_credit|liability|card|debt/i;
const LIQUID = /checking|savings|money_market|money market|cash|depository/i;
const INVEST = /invest|brokerage|retirement|ira|401k|roth|pension/i;
const isLiability = (a: any) => LIAB.test(String(a?.account_type || '')) || bal(a) < 0;

export function computeAnalytics(txns: any[], assetRows: any[], accountRows: any[], nowMs: number) {
  txns = txns || [];
  assetRows = assetRows || [];
  accountRows = accountRows || [];
  const lastUpdated = txns[0]?.transaction_date || null;
  const cut30 = isoDay(nowMs - 30 * 86400000);
  const m = txns.filter((t) => (t.transaction_date || '') >= cut30);
  const noTx = txns.length === 0;
  const expenseTxAny = txns.some((t) => !isIncome(t));
  const expenseTx30 = m.filter((t) => !isIncome(t));
  const incomeTx30 = m.filter((t) => isIncome(t));

  const txMissing: MissingState = {
    reason: 'No transaction history is connected for this period.',
    how_to_provide: 'Connect transactions or add expenses to see spending, bills, and cash flow.',
    unlocks: 'cash flow, spending trends, bills, and insights',
  };
  const expenseMissing: MissingState = {
    reason: 'Spending trends need transaction history.',
    how_to_provide: 'Connect transactions or add expenses to see spending patterns.',
    unlocks: 'spending trends, recurring bills, and savings rate',
  };

  // --- cash flow (last 30 days) ---
  let income_total = 0;
  for (const t of incomeTx30) income_total += Math.abs(Number(t.amount ?? 0));
  income_total = round2(income_total);
  let expense_total = 0;
  for (const t of expenseTx30) expense_total += Math.abs(Number(t.amount ?? 0));
  expense_total = round2(expense_total);

  let cash_flow: any;
  if (noTx) {
    cash_flow = {
      income_total: null,
      expense_total: null,
      net_cash_flow: null,
      savings_amount: null,
      savings_rate: null,
      source: 'finance.transactions',
      last_updated: lastUpdated,
      missing_state: txMissing,
    };
  } else if (!expenseTxAny) {
    // Income may be present, but with NO expense transactions the expense side is unavailable — NOT $0.
    // Savings rate is unknowable, so net cash flow / savings / rate are unavailable (never 100%).
    cash_flow = {
      income_total: incomeTx30.length ? income_total : null,
      expense_total: null,
      net_cash_flow: null,
      savings_amount: null,
      savings_rate: null,
      expense_state: 'unavailable',
      note: 'Income is available, but expense history is needed to calculate savings rate.',
      source: 'finance.transactions',
      last_updated: lastUpdated,
    };
  } else {
    const savings_amount = round2(income_total - expense_total);
    cash_flow = {
      income_total,
      expense_total,
      net_cash_flow: savings_amount,
      savings_amount,
      savings_rate: income_total > 0 ? round2((savings_amount / income_total) * 100) : null,
      source: 'finance.transactions',
      last_updated: lastUpdated,
    };
  }

  // --- spending trends (expense categories, last 30 days) ---
  const spendByCat: Record<string, number> = {};
  const spendByDay: Record<string, number> = {};
  for (const t of expenseTx30) {
    const a = Math.abs(Number(t.amount ?? 0));
    spendByCat[cat(t)] = (spendByCat[cat(t)] || 0) + a;
    const day = String(t.transaction_date ?? '').slice(0, 10);
    if (day) spendByDay[day] = (spendByDay[day] || 0) + a;
  }
  const daily = Object.entries(spendByDay)
    .map(([date, amount]) => ({ date, amount: round2(amount) }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const total_spending = round2(Object.values(spendByCat).reduce((s, v) => s + v, 0));
  const categories = Object.entries(spendByCat)
    .map(([category, amount]) => ({
      category,
      amount: round2(amount),
      percentage: total_spending > 0 ? round2((amount / total_spending) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8);
  let spending_trends: any;
  if (noTx || !expenseTxAny) {
    spending_trends = {
      total_spending: null,
      categories: [],
      daily: [],
      trend_direction: 'unknown',
      source: 'finance.transactions',
      last_updated: lastUpdated,
      missing_state: noTx ? txMissing : expenseMissing,
    };
  } else if (categories.length === 0) {
    // Expense history EXISTS but none in the last 30 days → verified zero.
    spending_trends = {
      total_spending: 0,
      categories: [],
      daily,
      trend_direction: 'unknown',
      source: 'finance.transactions',
      last_updated: lastUpdated,
      verified_zero: true,
      missing_state: { reason: 'No spending detected in the last 30 days.' },
    };
  } else {
    spending_trends = {
      total_spending,
      categories,
      daily,
      trend_direction: 'unknown',
      source: 'finance.transactions',
      last_updated: lastUpdated,
    };
  }

  // --- recent transactions ---
  const recent_transactions = txns.slice(0, 50).map((t) => ({
    id: String(t.id ?? ''),
    account_id: String(t.account_id ?? ''),
    amount: Number(t.amount ?? 0),
    currency: String(t.currency ?? 'USD'),
    date: String(t.transaction_date ?? '').slice(0, 10),
    description: String(t.description ?? ''),
    merchant: String(t.merchant ?? ''),
    category: String(t.category ?? ''),
    type: String(t.transaction_type ?? ''),
  }));

  // --- upcoming bills (recurring merchant detection) ---
  const byMerchant: Record<string, number[]> = {};
  for (const t of txns)
    if (!isIncome(t)) {
      const key = (t.merchant || t.description || '').trim();
      if (key) (byMerchant[key] = byMerchant[key] || []).push(Math.abs(Number(t.amount ?? 0)));
    }
  const bills = Object.entries(byMerchant)
    .filter(([, amts]) => amts.length >= 2)
    .map(([name, amts]) => {
      const avg = amts.reduce((a, b) => a + b, 0) / amts.length;
      const variance = round2(Math.max(...amts) - Math.min(...amts));
      return {
        name,
        amount: round2(avg),
        due_date: null as string | null,
        variance,
        source: 'finance.transactions',
        _consistent: avg > 0 && variance / avg < 0.1,
      };
    })
    .filter((b) => b._consistent)
    .map(({ _consistent, ...b }) => b) // eslint-disable-line @typescript-eslint/no-unused-vars
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);
  let upcoming_bills: any;
  if (noTx || !expenseTxAny) {
    upcoming_bills = {
      bills: [],
      source: 'finance.transactions',
      last_updated: lastUpdated,
      missing_state: noTx
        ? txMissing
        : {
            reason: 'Recurring bills need recent transaction history.',
            how_to_provide: 'Connect transactions to detect recurring bills.',
            unlocks: 'recurring bill detection',
          },
    };
  } else if (bills.length === 0) {
    upcoming_bills = {
      bills: [],
      source: 'finance.transactions',
      last_updated: lastUpdated,
      missing_state: { reason: 'No recurring bills detected from available transactions.' },
    };
  } else {
    upcoming_bills = { bills, source: 'finance.transactions', last_updated: lastUpdated };
  }

  // --- financial insights: transaction MoM (if any) + balance-grounded limited-data insights ---
  const prevStart = isoDay(nowMs - 60 * 86400000);
  const prev = txns.filter(
    (t) => (t.transaction_date || '') >= prevStart && (t.transaction_date || '') < cut30
  );
  const prevByCat: Record<string, number> = {};
  for (const t of prev)
    if (!isIncome(t))
      prevByCat[cat(t)] = (prevByCat[cat(t)] || 0) + Math.abs(Number(t.amount ?? 0));
  const txnInsights: any[] = [];
  for (const [category, thisAmt] of Object.entries(spendByCat)) {
    const lastAmt = prevByCat[category] || 0;
    if (lastAmt > 0 && thisAmt > 100) {
      const pc = round2(((thisAmt - lastAmt) / lastAmt) * 100);
      if (Math.abs(pc) >= 25)
        txnInsights.push({
          title: `${category} spending is ${pc > 0 ? 'up' : 'down'}`,
          description: `${category} ${pc > 0 ? 'rose' : 'fell'} ${Math.abs(pc)}% vs the prior 30 days.`,
          severity: pc > 0 ? 'warning' : 'opportunity',
          percent_change: pc,
          source_data: ['finance.transactions'],
        });
    }
  }
  // Balance-grounded insights (real account data; no fabricated numbers).
  const balInsights: any[] = [];
  if (accountRows.length) {
    const liabs = accountRows.filter(isLiability);
    const liquidity = round2(
      accountRows
        .filter(
          (a) => !isLiability(a) && LIQUID.test(String(a.account_type || a.account_name || ''))
        )
        .reduce((s, a) => s + bal(a), 0)
    );
    const invest = round2(
      accountRows
        .filter((a) => INVEST.test(String(a.account_type || a.account_name || '')))
        .reduce((s, a) => s + Math.abs(bal(a)), 0)
    );
    if (liabs.length) {
      const top = liabs.reduce((a, b) => (Math.abs(bal(b)) > Math.abs(bal(a)) ? b : a));
      balInsights.push({
        title: `Your largest liability is ${top.account_name || top.name || 'a loan'}`,
        description: `At ${money(Math.abs(bal(top)))}, it's your biggest debt — its rate and payoff plan drive most of your interest cost.`,
        severity: 'info',
        source_data: ['finance.financial_accounts'],
        next_action: 'Confirm the interest rate and term so we can prioritize payoff vs investing.',
      });
    }
    if (liquidity > 0)
      balInsights.push({
        title: 'Liquidity looks healthy',
        description: `You hold ${money(liquidity)} in cash and checking — a solid base for an emergency fund and near-term goals.`,
        severity: 'opportunity',
        source_data: ['finance.financial_accounts'],
        next_action: 'Set an emergency-fund target so we can right-size this reserve.',
      });
    if (invest > 0)
      balInsights.push({
        title: 'Investment and retirement balances are significant',
        description: `${money(invest)} is held across investment and retirement accounts. Position-level holdings may be needed to analyze allocation, concentration, and risk capacity.`,
        severity: 'info',
        source_data: ['finance.financial_accounts'],
        next_action:
          'Add or connect holdings on the Investment Portfolio page to analyze allocation.',
      });
  }
  if (!expenseTxAny)
    balInsights.push({
      title: 'Expense and savings-rate analysis is limited',
      description:
        'Connect transactions or add expenses to unlock spending trends, recurring bills, and an accurate savings rate.',
      severity: 'info',
      source_data: ['finance.transactions (missing)'],
      next_action: 'Connect transactions or log expenses.',
    });
  const insights = [...txnInsights, ...balInsights].slice(0, 5);
  const insights_status = insights.length
    ? expenseTxAny
      ? 'available'
      : 'limited_data'
    : accountRows.length
      ? 'limited_data'
      : 'unavailable';
  const financial_insights = {
    insights,
    status: insights_status,
    missing_data: expenseTxAny ? [] : ['transaction history (expenses)'],
    generated_by: 'deterministic_fallback',
    source: 'finance.transactions + finance.financial_accounts',
    last_updated: lastUpdated,
  };

  // --- assets (equity/appreciation; classified totals) ---
  const ACCOUNT_MIRROR = (r: any) =>
    (r.asset_type || '').toLowerCase() === 'investment' ||
    (r.asset_type || '').toLowerCase() === 'retirement' ||
    r.metadata?.source === 'connected_account';
  const realAssets = assetRows.filter((r) => !ACCOUNT_MIRROR(r));
  const classify = (t?: string) => {
    const s = (t || '').toLowerCase();
    if (/real_estate|home|property|house/.test(s)) return 'real_estate';
    if (/vehicle|auto|car/.test(s)) return 'vehicles';
    if (/business/.test(s)) return 'business';
    return 'other';
  };
  const items = realAssets.map((r) => {
    const value = Number(r.current_value ?? 0);
    const purchase = r.purchase_price != null ? Number(r.purchase_price) : null;
    return {
      id: r.id,
      name: r.name || r.asset_type || 'Asset',
      asset_type: r.asset_type || 'other',
      value: round2(value),
      debt: null as number | null,
      equity: round2(value),
      appreciation: purchase && purchase > 0 ? round2(((value - purchase) / purchase) * 100) : null,
      source: 'finance.assets',
    };
  });
  const totals = {
    real_estate: 0,
    vehicles: 0,
    business: 0,
    other: 0,
    total_assets: 0,
    total_debt: 0,
    total_equity: 0,
  };
  for (const it of items) {
    const k = classify(it.asset_type) as 'real_estate' | 'vehicles' | 'business' | 'other';
    totals[k] = round2(totals[k] + it.value);
    totals.total_assets = round2(totals.total_assets + it.value);
    totals.total_equity = round2(totals.total_equity + (it.equity || 0));
  }
  const assets = items.length
    ? { items, totals, source: 'finance.assets', last_updated: null }
    : {
        items: [],
        totals,
        source: 'finance.assets',
        last_updated: null,
        missing_state: {
          reason: 'No non-account assets (home, vehicle, business) on file.',
          how_to_provide: 'Add an asset from the Assets page.',
          unlocks: 'equity and appreciation tracking',
        } as MissingState,
      };

  return {
    cash_flow,
    spending_trends,
    financial_insights,
    upcoming_bills,
    assets,
    recent_transactions,
  };
}
