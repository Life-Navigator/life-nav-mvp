/**
 * GET /api/finance/analytics — BACKEND-OWNED finance analytics (Rule 1: no frontend business math).
 *
 * Reads persisted finance.transactions + finance.assets + finance.financial_accounts (user-scoped, RLS)
 * and delegates to computeAnalytics (pure, tested). Returns honest states everywhere: real · verified zero ·
 * unavailable. Fabricates nothing — "income but no expense transactions" reads as expenses UNAVAILABLE, never
 * $0 / 100% savings.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { computeAnalytics } from '@/lib/finance/computeAnalytics';

export const dynamic = 'force-dynamic';
const iso = (d: Date) => d.toISOString().slice(0, 10);

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
  // Account balances power the balance-grounded limited-data insights (Part 5).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let accountRows: any[] = [];
  try {
    const { data } = await sb
      .schema('finance')
      .from('financial_accounts')
      .select('id, account_name, account_type, institution_name, current_balance, is_active')
      .eq('user_id', user.id);
    accountRows = (data || []).filter((a: { is_active?: boolean }) => a.is_active !== false);
  } catch {
    accountRows = [];
  }

  return NextResponse.json(computeAnalytics(txns, assetRows, accountRows, now));
}
