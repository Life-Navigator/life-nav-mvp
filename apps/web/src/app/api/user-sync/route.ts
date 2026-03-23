import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * User sync endpoint — looks up or creates a profile entry for backend sync.
 * GET ?lookup=<supabase_user_id> — check if user exists
 * POST — sync user data to profiles table
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const lookupId = request.nextUrl.searchParams.get('lookup');
    if (!lookupId || lookupId !== user.id) {
      return NextResponse.json({ error: 'Invalid lookup' }, { status: 400 });
    }

    const { data: profile } = await (supabase as any)
      .from('profiles')
      .select('id, dgx_user_id, display_name, pilot_role, pilot_enabled')
      .eq('id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ exists: false });
    }

    return NextResponse.json({
      exists: true,
      backend_user_id: profile.dgx_user_id || profile.id,
      tenant_id: profile.id,
      email: user.email,
      display_name: profile.display_name,
      pilot_role: profile.pilot_role || 'user',
      pilot_enabled: profile.pilot_enabled || false,
    });
  } catch (err) {
    console.error('User-sync GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();

    // Upsert profile with sync data
    const { data: profile, error } = await (supabase as any)
      .from('profiles')
      .upsert(
        {
          id: user.id,
          display_name: body.display_name || user.user_metadata?.name || user.email?.split('@')[0],
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      )
      .select('id, dgx_user_id, display_name, pilot_role, pilot_enabled')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({
      success: true,
      backend_user_id: profile.dgx_user_id || profile.id,
      tenant_id: profile.id,
      email: user.email,
      display_name: profile.display_name,
      pilot_role: profile.pilot_role || 'user',
      pilot_enabled: profile.pilot_enabled || false,
    });
  } catch (err) {
    console.error('User-sync POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
