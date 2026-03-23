import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { persona, prioritizedGoals } = body;

    // Store persona in user profile metadata
    if (persona) {
      await (supabase as any)
        .from('profiles')
        .update({
          persona_type: persona,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);
    }

    // Store prioritized goals as user preferences
    if (prioritizedGoals && typeof prioritizedGoals === 'object') {
      await (supabase as any).from('user_preferences').upsert(
        {
          user_id: user.id,
          prioritized_goals: prioritizedGoals,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Persona goals POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
