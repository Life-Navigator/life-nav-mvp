import { NextRequest, NextResponse } from 'next/server';
import { authedUserId } from '@/lib/chat/server-auth';
import { listThreads, createThread } from '@/lib/chat/store';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const userId = await authedUserId();
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const projectId = req.nextUrl.searchParams.get('project_id');
  return NextResponse.json({ threads: await listThreads(userId, projectId) });
}

export async function POST(req: NextRequest) {
  const userId = await authedUserId();
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  try {
    const thread = await createThread(userId, {
      title: body.title ?? null,
      mode: body.mode ?? 'advisor',
      selected_agent: body.selected_agent ?? body.agent ?? null,
      project_id: body.project_id ?? null,
    });
    return NextResponse.json({ thread }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'create_failed' },
      { status: 500 }
    );
  }
}
