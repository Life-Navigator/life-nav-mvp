/**
 * GET /api/discovery/[id]/state
 *
 * Returns the current discovery_session row + all goal_discovery_turns
 * linked to it. Read-only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = await params;

  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sb = supabase as any;
  const { data: session } = await sb
    .from('discovery_sessions')
    .select('*')
    .eq('user_id', user.id)
    .eq('id', sessionId)
    .maybeSingle();
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

  let turns: unknown[] = [];
  if (session.primary_session_token) {
    const { data } = await sb
      .from('goal_discovery_turns')
      .select('*')
      .eq('user_id', user.id)
      .eq('session_id', session.primary_session_token)
      .order('turn_index', { ascending: true });
    turns = data ?? [];
  }

  return NextResponse.json({ session, turns });
}
