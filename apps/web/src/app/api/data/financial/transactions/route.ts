/**
 * GET /api/data/financial/transactions
 *
 * P0 fix: the Financial Overview page (+ useTransactions hook) called this route, which did not
 * exist → 404 → empty overview. Returns a BARE array of finance.transactions rows in the shape the
 * hook expects (transaction_date, amount, transaction_type). Same persisted source as /api/financial.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { safeApiError } from '@/lib/security/safe-error';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') ?? 100), 500);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;
    const { data, error } = await sb
      .schema('finance')
      .from('transactions')
      .select(
        'id, account_id, amount, currency, transaction_date, description, merchant, category, transaction_type'
      )
      .eq('user_id', user.id)
      .order('transaction_date', { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const txns = (data || []).map((t: Record<string, any>) => ({
      id: String(t.id ?? ''),
      account_id: String(t.account_id ?? ''),
      transaction_date: String(t.transaction_date ?? '').slice(0, 10),
      amount: Number(t.amount ?? 0),
      currency: String(t.currency ?? 'USD'),
      description: String(t.description ?? ''),
      merchant_name: t.merchant ?? undefined,
      category: t.category ?? undefined,
      type: String(t.transaction_type ?? ''),
    }));
    return NextResponse.json(txns);
  } catch (err) {
    return safeApiError({ code: 'internal_error', internal: err });
  }
}
