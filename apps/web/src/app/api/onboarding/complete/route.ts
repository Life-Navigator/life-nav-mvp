import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(_request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Verify the user has submitted at least basic profile data and one goal
  // before allowing onboarding completion. Prevents bypassing the flow.
  const { data: profile } = await (supabase as any)
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .single();

  const { count: goalCount } = await (supabase as any)
    .from('goals')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id);

  if (!profile?.display_name && (goalCount ?? 0) === 0) {
    return NextResponse.json(
      {
        error:
          'Please complete at least the basic profile or set a goal before finishing onboarding.',
      },
      { status: 400 }
    );
  }

  const { error } = await (supabase as any)
    .from('profiles')
    .update({
      setup_completed: true,
      setup_completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ success: true });
}
