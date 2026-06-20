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
  return NextResponse.json({ messages: await getMessages(userId, id) });
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
