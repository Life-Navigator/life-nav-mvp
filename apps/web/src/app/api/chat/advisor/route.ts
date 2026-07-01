import { NextRequest, NextResponse } from 'next/server';
import { authedUserId } from '@/lib/chat/server-auth';
import { createThread } from '@/lib/chat/store';
import { sendAdvisorTurn } from '@/lib/chat/send-server';

export const dynamic = 'force-dynamic';
// Advisor turns can legitimately take ~40s (slow model + one bounded repair). Give the function room so a valid
// turn completes; send-server's 55s client deadline sits just under this and degrades gracefully past it.
export const maxDuration = 60;

/**
 * POST /api/chat/advisor — the Command Center send endpoint.
 *
 * Accepts { message, agent?, thread_id?, project_id? }. If no thread_id is supplied it mints one (so the
 * floating chat can start a conversation without first creating a thread), then routes to advisor mode
 * with the selected agent, persists the turn, and returns { assistant_message, citations, agent, thread_id }.
 * Always advisor mode — discovery/onboarding is never reachable from here.
 */
export async function POST(req: NextRequest) {
  const userId = await authedUserId();
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (!message) return NextResponse.json({ error: 'message_required' }, { status: 400 });
  const agent = body.agent ?? body.selected_agent ?? null;

  try {
    let threadId: string | null = typeof body.thread_id === 'string' ? body.thread_id : null;
    if (!threadId) {
      const thread = await createThread(userId, {
        title: message.slice(0, 120),
        mode: 'advisor',
        selected_agent: agent,
        project_id: body.project_id ?? null,
      });
      threadId = thread?.id ?? null;
    }
    const result = await sendAdvisorTurn({ userId, threadId, message, agent });
    // Always 200 so the client ALWAYS receives thread_id (even when the advisor was degraded/errored) and never
    // forks a duplicate thread on the next message. Degradation is carried in the body (`degraded`), not the
    // HTTP status. The user's message was already persisted, so the thread is reopenable regardless.
    return NextResponse.json({ ...result, thread_id: threadId }, { status: 200 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'send_failed' },
      { status: 500 }
    );
  }
}
