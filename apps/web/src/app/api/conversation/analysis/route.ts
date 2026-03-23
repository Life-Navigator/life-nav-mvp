import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Conversation analysis endpoint.
 * POST — save analysis results from the discovery conversation.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { analysis } = body;

    if (!analysis) {
      return NextResponse.json({ error: 'Analysis data required' }, { status: 400 });
    }

    // Store analysis in user_preferences as conversation_analysis JSONB
    const { error } = await (supabase as any).from('user_preferences').upsert(
      {
        user_id: user.id,
        conversation_analysis: analysis,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Conversation analysis POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
