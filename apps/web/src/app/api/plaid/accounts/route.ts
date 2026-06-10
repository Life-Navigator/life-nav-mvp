/**
 * GET /api/plaid/accounts — accounts in the shape the Financial Overview sub-widgets
 * (AccountsSummary) expect: { accounts: [{ id, name, type, subtype, institution, currentBalance }] }.
 * Reads canonical finance.financial_accounts (RLS + explicit user_id). These widgets previously
 * called this URL and got 404 ("Unable to load accounts"); this is the missing route.
 */
import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rows: any[] = [];
  try {
    const { data } = await sb
      .schema('finance')
      .from('financial_accounts')
      .select('id, account_name, account_type, institution_name, current_balance')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('current_balance', { ascending: false });
    rows = data || [];
  } catch {
    rows = [];
  }

  const accounts = rows.map((a) => ({
    id: a.id,
    name: a.account_name || 'Account',
    type: a.account_type,
    subtype: a.account_type,
    institution: a.institution_name || null,
    currentBalance: Number(a.current_balance ?? 0),
  }));

  return NextResponse.json({ accounts });
}
