/**
 * GET /api/conversations — list the authenticated user's chat conversations.
 *
 * RLS scopes the rows; nothing other than the caller's own conversations come
 * back. Returns a compact list ordered by most-recent message.
 */

import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'service_unavailable' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  try {
    const { data, error } = await sb
      .from('chat_conversations')
      .select('id, title, last_message_at, message_count, created_at')
      .eq('user_id', user.id)
      .order('last_message_at', { ascending: false })
      .limit(100);
    if (error) {
      // Table missing (migration not yet applied) → empty list, not 500.
      return NextResponse.json({ conversations: [] });
    }
    return NextResponse.json({ conversations: data ?? [] });
  } catch {
    return NextResponse.json({ conversations: [] });
  }
}
