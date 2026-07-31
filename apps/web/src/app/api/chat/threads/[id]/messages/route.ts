import { NextRequest, NextResponse } from 'next/server';
import { authedUserId } from '@/lib/chat/server-auth';
import { getMessages } from '@/lib/chat/store';
import { sendAdvisorTurn } from '@/lib/chat/send-server';

export const dynamic = 'force-dynamic';

// GET — playback of one thread's messages (oldest first), scoped to the caller.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await authedUserId();
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await params;
  const rows = await getMessages(userId, id);
  // B-25: lift the persisted turn id out of metadata so history responses are reportable.
  // ASSISTANT ONLY — a user or system message must never carry an advisor turn id. Nothing else
  // from metadata is exposed: it may hold diagnostic fields the client has no business seeing.
  const messages = rows.map((m: Record<string, unknown>) => {
    const meta = (m.metadata ?? {}) as Record<string, unknown>;
    const turnId =
      m.role === 'assistant' && typeof meta.turn_id === 'string' ? meta.turn_id : undefined;
    const { metadata: _drop, ...rest } = m;
    return turnId ? { ...rest, turn_id: turnId } : rest;
  });
  return NextResponse.json({ messages });
}

// POST — send a message in this thread. Routes to advisor mode (with the thread's/selected agent),
// persists both turns with citations, returns the assistant reply.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await authedUserId();
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (!message) return NextResponse.json({ error: 'message_required' }, { status: 400 });
  try {
    const result = await sendAdvisorTurn({
      userId,
      threadId: id,
      message,
      agent: body.agent ?? body.selected_agent ?? null,
    });
    return NextResponse.json(result, { status: result.status });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'send_failed' },
      { status: 500 }
    );
  }
}
