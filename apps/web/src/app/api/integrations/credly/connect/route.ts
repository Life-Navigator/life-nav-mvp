import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { validateUsername } from '@/lib/integrations/credly/client';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { username } = await request.json();
    if (!username || typeof username !== 'string') {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }

    const valid = await validateUsername(username.trim());
    if (!valid) {
      return NextResponse.json({ error: 'Credly username not found' }, { status: 404 });
    }

    // Store Credly username in user's integration metadata
    const { error } = await (supabase as any).from('integrations').upsert(
      {
        user_id: user.id,
        provider: 'credly',
        status: 'connected',
        metadata: { username: username.trim() },
      },
      { onConflict: 'user_id,provider' }
    );

    if (error) throw error;

    return NextResponse.json({ success: true, username: username.trim() });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
