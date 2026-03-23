import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Discovery benefits endpoint.
 * GET — fetch user's saved benefit selections per domain
 * POST — save benefit selections
 *
 * Benefits are stored as JSONB in user_preferences.benefit_selections
 * Shape: { [domain: string]: string[] }
 */
export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: prefs } = await (supabase as any)
      .from('user_preferences')
      .select('benefit_selections')
      .eq('user_id', user.id)
      .single();

    return NextResponse.json({ benefits: prefs?.benefit_selections || {} });
  } catch (err) {
    console.error('Discovery benefits GET error:', err);
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
    const { benefits } = body;

    if (!benefits || typeof benefits !== 'object') {
      return NextResponse.json({ error: 'Benefits object required' }, { status: 400 });
    }

    const { error } = await (supabase as any).from('user_preferences').upsert(
      {
        user_id: user.id,
        benefit_selections: benefits,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Discovery benefits POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
