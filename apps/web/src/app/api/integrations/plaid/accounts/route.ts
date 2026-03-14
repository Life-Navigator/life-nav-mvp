import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getAccounts } from '@/lib/integrations/plaid/client';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { data: items, error } = await (supabase as any)
      .from('plaid_items')
      .select('*')
      .eq('user_id', user.id);

    if (error) throw error;
    if (!items || items.length === 0) {
      return NextResponse.json({ accounts: [] });
    }

    const allAccounts = [];
    for (const item of items) {
      try {
        const accounts = await getAccounts(item.access_token);
        allAccounts.push(
          ...accounts.map((a: any) => ({
            ...a,
            institution_name: item.institution_name,
            item_id: item.item_id,
          }))
        );
      } catch {
        // Skip items with expired tokens
      }
    }

    return NextResponse.json({ accounts: allAccounts });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
