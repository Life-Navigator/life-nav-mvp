import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { fetchBadges } from '@/lib/integrations/credly/client';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    // Get stored Credly username
    const { data: integration } = await (supabase as any)
      .from('integrations')
      .select('metadata')
      .eq('user_id', user.id)
      .eq('provider', 'credly')
      .single();

    const username = integration?.metadata?.username;
    if (!username) {
      return NextResponse.json({ error: 'Credly not connected' }, { status: 400 });
    }

    const badges = await fetchBadges(username);
    return NextResponse.json({ badges });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
