import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

// GET /api/onboarding/status — the single client-side signal for "has this user finished onboarding?".
// Both advisor chat surfaces read it to pick mode (advisor vs discovery) and the right initial message.
// Mirrors the middleware gate (proxy.ts): setup_completed + onboarding_completed on profiles.
export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 503 });
  }
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { data: profile } = await (supabase as any)
    .from('profiles')
    .select('setup_completed, onboarding_completed')
    .eq('id', user.id)
    .single();

  return NextResponse.json({
    setup_completed: !!profile?.setup_completed,
    onboarding_completed: !!profile?.onboarding_completed,
  });
}
