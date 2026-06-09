/**
 * GET /api/data/financial/accounts
 *
 * P0 fix: the Financial Overview page (+ useFinancialAccounts hook) called this route, which did
 * not exist → 404 → empty overview. Returns a BARE array of finance.financial_accounts rows in the
 * granular shape the hook/page expect (account_type kept raw: checking/savings/credit_card/
 * investment/loan; current_balance). Same persisted source as the working /api/financial route.
 */
import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { safeApiError } from '@/lib/security/safe-error';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;
    const { data, error } = await sb
      .schema('finance')
      .from('financial_accounts')
      .select(
        'id, account_name, account_type, institution_name, current_balance, available_balance, credit_limit, interest_rate, currency, is_active, is_manual, last_synced_at, created_at, updated_at'
      )
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('current_balance', { ascending: false });
    if (error) throw new Error(error.message);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const accounts = (data || []).map((a: Record<string, any>) => ({
      id: String(a.id ?? ''),
      account_name: String(a.account_name ?? 'Account'),
      account_type: String(a.account_type ?? 'other'),
      institution_name: a.institution_name ?? undefined,
      currency: String(a.currency ?? 'USD'),
      current_balance: Number(a.current_balance ?? 0),
      available_balance: a.available_balance == null ? undefined : Number(a.available_balance),
      credit_limit: a.credit_limit == null ? undefined : Number(a.credit_limit),
      interest_rate: a.interest_rate == null ? undefined : Number(a.interest_rate),
      status: a.is_active ? 'active' : 'closed',
      is_manual: Boolean(a.is_manual),
      last_synced_at: a.last_synced_at ?? undefined,
      created_at: String(a.created_at ?? ''),
      updated_at: String(a.updated_at ?? ''),
    }));
    return NextResponse.json(accounts);
  } catch (err) {
    return safeApiError({ code: 'internal_error', internal: err });
  }
}
