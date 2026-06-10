/**
 * GET /api/plaid/transactions — transactions in the shape the Financial Overview sub-widgets
 * (CashFlow, SpendingTrends, UpcomingBills, FinancialInsights) expect:
 *   { transactions: [{ id, amount, category, date, name, merchant }] }
 * where `amount` follows the widgets' sign convention (negative = income, positive = expense)
 * and `category` is a STRING. Reads canonical finance.transactions (RLS + explicit user_id).
 * These widgets previously called this URL and got 404 ("Unable to load …"); this is the missing route.
 *
 * Accepts startDate/endDate (ISO, as the widgets send) or start_date/end_date.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sp = new URL(req.url).searchParams;
  const toDate = (v: string | null, fallbackDaysAgo: number) => {
    const raw = v || new Date(Date.now() - fallbackDaysAgo * 86400000).toISOString();
    return raw.slice(0, 10); // transaction_date is a DATE column
  };
  const startDate = toDate(sp.get('startDate') || sp.get('start_date'), 30);
  const endDate = toDate(sp.get('endDate') || sp.get('end_date'), 0);
  const limit = Math.min(Number(sp.get('limit')) || 500, 1000);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rows: any[] = [];
  try {
    const { data } = await sb
      .schema('finance')
      .from('transactions')
      .select('id, amount, transaction_date, description, merchant, category, transaction_type')
      .eq('user_id', user.id)
      .gte('transaction_date', startDate)
      .lte('transaction_date', endDate)
      .order('transaction_date', { ascending: false })
      .limit(limit);
    rows = data || [];
  } catch {
    rows = [];
  }

  const transactions = rows.map((t) => ({
    id: t.id,
    // widgets treat negative as income, positive as expense
    amount: t.transaction_type === 'income' ? -Number(t.amount ?? 0) : Number(t.amount ?? 0),
    category: t.category || 'Other',
    date: t.transaction_date,
    name: t.description || t.merchant || 'Transaction',
    merchant: t.merchant || null,
  }));

  return NextResponse.json({ transactions, totalTransactions: transactions.length });
}
