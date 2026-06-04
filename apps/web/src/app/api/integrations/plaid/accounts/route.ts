import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { safeApiError } from '@/lib/security/safe-error';

export const dynamic = 'force-dynamic';

/**
 * GET accounts — reads the user's PERSISTED finance.financial_accounts (the
 * source of truth populated by persona activation / sync), not live Plaid.
 * RLS scopes rows to the authenticated user.
 */
export async function GET() {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { data, error } = await (supabase as any)
      .schema('finance')
      .from('financial_accounts')
      .select(
        'id, account_name, account_type, institution_name, current_balance, available_balance, credit_limit, currency, plaid_account_id'
      )
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('current_balance', { ascending: false });

    if (error) throw error;

    const accounts = (data ?? []).map((a: any) => ({
      account_id: a.plaid_account_id || a.id,
      name: a.account_name,
      type: a.account_type,
      subtype: a.account_type,
      institution_name: a.institution_name,
      balances: {
        current: Number(a.current_balance ?? 0),
        available: a.available_balance != null ? Number(a.available_balance) : null,
        limit: a.credit_limit != null ? Number(a.credit_limit) : null,
        iso_currency_code: a.currency || 'USD',
      },
    }));

    return NextResponse.json({ accounts });
  } catch (err) {
    return safeApiError({ code: 'internal_error', internal: err });
  }
}
