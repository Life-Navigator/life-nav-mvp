/**
 * GET /api/finance/analytics — BACKEND-OWNED finance analytics (Rule 1: no frontend business math).
 *
 * Computes — server-side, from persisted finance.transactions + finance.assets — the values the five
 * Financial Overview widgets used to derive in the browser:
 *   cash_flow (income/expense/net/savings/savings_rate), spending_trends (category totals + %),
 *   financial_insights (month-over-month category change), upcoming_bills (recurring detection),
 *   assets (equity/appreciation + classified totals).
 * Returns null + missing_state when a value cannot be computed from real data. Fabricates nothing.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type MissingState = { reason: string; how_to_provide: string; unlocks: string };
const iso = (d: Date) => d.toISOString().slice(0, 10);
const round2 = (n: number) => Math.round(n * 100) / 100;

export async function GET(_req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const now = Date.now();
  const start60 = iso(new Date(now - 60 * 86400000));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let txns: any[] = [];
  try {
    const { data } = await sb
      .schema('finance')
      .from('transactions')
      .select(
        'id, account_id, amount, currency, transaction_type, transaction_date, category, merchant, description'
      )
      .eq('user_id', user.id)
      .gte('transaction_date', start60)
      .order('transaction_date', { ascending: false })
      .limit(2000);
    txns = data || [];
  } catch {
    txns = [];
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let assetRows: any[] = [];
  try {
    const { data } = await sb.schema('finance').from('assets').select('*').eq('user_id', user.id);
    assetRows = data || [];
  } catch {
    assetRows = [];
  }
  const lastUpdated = txns[0]?.transaction_date || null;
  const isIncome = (t: { transaction_type?: string }) => t.transaction_type === 'income';
  const cat = (t: { category?: string | null }) =>
    (t.category || 'Other').split(',')[0]?.trim() || 'Other';

  // --- cash flow (last 30 days) ---
  const cut30 = iso(new Date(now - 30 * 86400000));
  const m = txns.filter((t) => (t.transaction_date || '') >= cut30);
  const noTx = txns.length === 0;
  const txMissing: MissingState = {
    reason: 'No transactions on file for the selected period.',
    how_to_provide: 'Activate a Plaid sandbox persona or connect transactions.',
    unlocks: 'cash-flow, spending trends, bills, and insights',
  };
  let income_total = 0,
    expense_total = 0;
  for (const t of m) {
    const a = Math.abs(Number(t.amount ?? 0));
    if (isIncome(t)) income_total += a;
    else expense_total += a;
  }
  income_total = round2(income_total);
  expense_total = round2(expense_total);
  const savings_amount = round2(income_total - expense_total);
  const cash_flow = noTx
    ? {
        income_total: null,
        expense_total: null,
        net_cash_flow: null,
        savings_amount: null,
        savings_rate: null,
        source: 'finance.transactions',
        last_updated: lastUpdated,
        missing_state: txMissing,
      }
    : {
        income_total,
        expense_total,
        net_cash_flow: savings_amount,
        savings_amount,
        savings_rate: income_total > 0 ? round2((savings_amount / income_total) * 100) : null,
        source: 'finance.transactions',
        last_updated: lastUpdated,
      };

  // --- spending trends (expense categories, last 30 days) ---
  const spendByCat: Record<string, number> = {};
  const spendByDay: Record<string, number> = {};
  for (const t of m)
    if (!isIncome(t)) {
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
  const spending_trends = noTx
    ? {
        total_spending: null,
        categories: [],
        daily: [],
        trend_direction: 'unknown' as const,
        source: 'finance.transactions',
        last_updated: lastUpdated,
        missing_state: txMissing,
      }
    : {
        total_spending,
        categories,
        daily,
        trend_direction: 'unknown' as const,
        source: 'finance.transactions',
        last_updated: lastUpdated,
      };

  // --- recent transactions (newest first, last 60 days, capped) — same canonical
  //     finance.transactions source the overview reads. Lets the legacy dashboard and
  //     the transactions page render a real list whether or not the /api/financial
  //     proxy is on (the proxy's DomainViewModel summary carries no transaction rows). ---
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

  // --- financial insights (this 30d vs prior 30d, per category) ---
  const prevStart = iso(new Date(now - 60 * 86400000));
  const prev = txns.filter(
    (t) => (t.transaction_date || '') >= prevStart && (t.transaction_date || '') < cut30
  );
  const prevByCat: Record<string, number> = {};
  for (const t of prev)
    if (!isIncome(t))
      prevByCat[cat(t)] = (prevByCat[cat(t)] || 0) + Math.abs(Number(t.amount ?? 0));
  const insights: Array<{
    title: string;
    description: string;
    severity: string;
    metric?: string;
    value?: number;
    percent_change?: number | null;
    source: string;
  }> = [];
  for (const [category, thisAmt] of Object.entries(spendByCat)) {
    const lastAmt = prevByCat[category] || 0;
    if (lastAmt > 0 && thisAmt > 100) {
      const pc = round2(((thisAmt - lastAmt) / lastAmt) * 100);
      if (Math.abs(pc) >= 25)
        insights.push({
          title: `${category} spending is ${pc > 0 ? 'up' : 'down'}`,
          description: `${category} ${pc > 0 ? 'rose' : 'fell'} ${Math.abs(pc)}% vs the prior 30 days.`,
          severity: pc > 0 ? 'warning' : 'opportunity',
          metric: category,
          value: round2(thisAmt),
          percent_change: pc,
          source: 'finance.transactions',
        });
    }
  }
  const financial_insights = {
    insights: insights.slice(0, 5),
    source: 'finance.transactions',
    last_updated: lastUpdated,
  };

  // --- upcoming bills (recurring merchant detection over 60 days) ---
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
  const upcoming_bills = noTx
    ? {
        bills: [],
        source: 'finance.transactions',
        last_updated: lastUpdated,
        missing_state: txMissing,
      }
    : { bills, source: 'finance.transactions', last_updated: lastUpdated };

  // --- assets (equity/appreciation; classified totals) ---
  const ACCOUNT_MIRROR = (r: { asset_type?: string; metadata?: { source?: string } }) =>
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
      debt: null as number | null, // per-asset loans not yet wired (finance.asset_loans)
      equity: round2(value), // equity = value until loans are wired
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

  return NextResponse.json({
    cash_flow,
    spending_trends,
    financial_insights,
    upcoming_bills,
    assets,
    recent_transactions,
  });
}
