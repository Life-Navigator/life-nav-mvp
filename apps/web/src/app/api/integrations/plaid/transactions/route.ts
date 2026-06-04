import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { safeApiError } from '@/lib/security/safe-error';

export const dynamic = 'force-dynamic';

/**
 * GET transactions — reads PERSISTED finance.transactions (populated by persona
 * activation / sync), not live Plaid. RLS scopes rows to the authenticated user.
 */
export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sp = request.nextUrl.searchParams;
  const startDate =
    sp.get('start_date') || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  const endDate = sp.get('end_date') || new Date().toISOString().split('T')[0];

  try {
    const { data, error } = await (supabase as any)
      .schema('finance')
      .from('transactions')
      .select(
        'id, account_id, amount, currency, transaction_date, description, merchant, category, transaction_type, plaid_transaction_id'
      )
      .eq('user_id', user.id)
      .gte('transaction_date', startDate)
      .lte('transaction_date', endDate)
      .order('transaction_date', { ascending: false })
      .limit(500);

    if (error) throw error;

    const transactions = (data ?? []).map((t: any) => ({
      transaction_id: t.plaid_transaction_id || t.id,
      account_id: t.account_id,
      // Re-express stored magnitude + direction as Plaid's signed amount.
      amount: t.transaction_type === 'income' ? -Number(t.amount) : Number(t.amount),
      iso_currency_code: t.currency || 'USD',
      date: t.transaction_date,
      name: t.description,
      merchant_name: t.merchant,
      category: t.category ? [t.category] : [],
    }));

    return NextResponse.json({ transactions, totalTransactions: transactions.length });
  } catch (err) {
    return safeApiError({ code: 'internal_error', internal: err });
  }
}
