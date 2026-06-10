/**
 * GET /api/finance/transaction-summary — BACKEND-OWNED income/expense/net totals.
 *
 * The transactions page must not sum money in the frontend (Rule 1). The client may FILTER
 * (date range + accounts); the server does the SUMMATION over that filter and returns the totals.
 *
 * Query: start, end (ISO or YYYY-MM-DD); optional accounts=id,id
 * Returns: { income, expenses, net, count, start, end }  (income/expenses are positive magnitudes)
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
  const toDate = (v: string | null, fallbackDaysAgo: number) =>
    (v || new Date(Date.now() - fallbackDaysAgo * 86400000).toISOString()).slice(0, 10);
  const start = toDate(sp.get('start') || sp.get('startDate'), 365);
  const end = toDate(sp.get('end') || sp.get('endDate'), 0);
  const accounts = (sp.get('accounts') || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rows: any[] = [];
  try {
    let q = sb
      .schema('finance')
      .from('transactions')
      .select('amount, transaction_type, account_id')
      .eq('user_id', user.id)
      .gte('transaction_date', start)
      .lte('transaction_date', end)
      .limit(5000);
    if (accounts.length) q = q.in('account_id', accounts);
    const { data } = await q;
    rows = data || [];
  } catch {
    rows = [];
  }

  let income = 0;
  let expenses = 0;
  for (const t of rows) {
    const amt = Math.abs(Number(t.amount ?? 0));
    if (t.transaction_type === 'income') income += amt;
    else expenses += amt;
  }
  income = Math.round(income * 100) / 100;
  expenses = Math.round(expenses * 100) / 100;

  return NextResponse.json({
    income,
    expenses,
    net: Math.round((income - expenses) * 100) / 100,
    count: rows.length,
    start,
    end,
  });
}
