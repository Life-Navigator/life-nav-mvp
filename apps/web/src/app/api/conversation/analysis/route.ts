import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { guardOutgoing, subjectTextFromPayload } from '@/lib/governance/route-guard';
import { safeApiError } from '@/lib/security/safe-error';

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

    if (error) return safeApiError({ code: 'validation_failed', internal: error });

    const g = await guardOutgoing({
      supabase,
      user_id: user.id,
      subject: { kind: 'advisor_message', text: subjectTextFromPayload(analysis) },
      emitter: { agent_kind: 'advisor', agent_name: 'advisor.core' },
    });
    if (!g.ok) return g.response;

    return NextResponse.json({ success: true, governance: { verdict: g.decision.verdict } });
  } catch (err) {
    console.error('Conversation analysis POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
