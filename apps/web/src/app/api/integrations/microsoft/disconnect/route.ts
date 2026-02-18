import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getUserIdFromJWT } from '@/lib/jwt';

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromJWT(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase admin client unavailable' }, { status: 500 });
    }

    const { error } = await supabase.rpc('disconnect_integration', {
      p_user_id: userId,
      p_provider: 'microsoft',
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || 'Internal server error' },
      { status: 500 },
    );
  }
}
