import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getTransactions } from '@/lib/integrations/plaid/client';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const searchParams = request.nextUrl.searchParams;
  const startDate =
    searchParams.get('start_date') ||
    new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  const endDate = searchParams.get('end_date') || new Date().toISOString().split('T')[0];

  try {
    const { data: items, error } = await (supabase as any)
      .from('plaid_items')
      .select('*')
      .eq('user_id', user.id);

    if (error) throw error;
    if (!items || items.length === 0) {
      return NextResponse.json({ transactions: [], totalTransactions: 0 });
    }

    const allTransactions = [];
    let total = 0;

    for (const item of items) {
      try {
        const result = await getTransactions(item.access_token, startDate, endDate);
        allTransactions.push(...result.transactions);
        total += result.totalTransactions;
      } catch {
        // Skip items with expired tokens
      }
    }

    return NextResponse.json({ transactions: allTransactions, totalTransactions: total });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
