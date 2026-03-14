import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { removeItem } from '@/lib/integrations/plaid/client';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { itemId } = await request.json();
    if (!itemId) return NextResponse.json({ error: 'Missing itemId' }, { status: 400 });

    const { data: item, error } = await (supabase as any)
      .from('plaid_items')
      .select('access_token')
      .eq('user_id', user.id)
      .eq('item_id', itemId)
      .single();

    if (error || !item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    await removeItem(item.access_token);

    await (supabase as any)
      .from('plaid_items')
      .delete()
      .eq('user_id', user.id)
      .eq('item_id', itemId);

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
