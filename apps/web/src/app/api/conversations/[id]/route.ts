/**
 * GET /api/conversations/[id] — return the messages for one conversation,
 * scoped to the authenticated user via RLS.
 *
 * Used by the chat page (`/dashboard/chat?id=...`) to play back a session.
 *
 * DELETE /api/conversations/[id] — remove a conversation + cascade messages.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'service_unavailable' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  try {
    const headRes = await sb
      .from('chat_conversations')
      .select('id, title, last_message_at, message_count, metadata, created_at')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle();
    if (!headRes?.data) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }

    const msgRes = await sb
      .from('chat_messages')
      .select('id, role, content, governance_audit_id, metadata, created_at')
      .eq('conversation_id', id)
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(500);

    return NextResponse.json({
      conversation: headRes.data,
      messages: msgRes?.data ?? [],
    });
  } catch {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'service_unavailable' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  const svc = createServiceRoleClient();
  if (!svc) return NextResponse.json({ error: 'service_unavailable' }, { status: 503 });

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = svc as any;
    await sb.from('chat_conversations').delete().eq('id', id).eq('user_id', user.id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'delete_failed' }, { status: 500 });
  }
}
