import { NextRequest, NextResponse } from 'next/server';
import { authedUserId } from '@/lib/chat/server-auth';
import { listProjects, createProject } from '@/lib/chat/store';

export const dynamic = 'force-dynamic';

export async function GET() {
  const userId = await authedUserId();
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  return NextResponse.json({ projects: await listProjects(userId) });
}

export async function POST(req: NextRequest) {
  const userId = await authedUserId();
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) return NextResponse.json({ error: 'name_required' }, { status: 400 });
  try {
    const project = await createProject(userId, {
      name,
      description: body.description ?? null,
      domain: body.domain ?? null,
    });
    return NextResponse.json({ project }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'create_failed' },
      { status: 500 }
    );
  }
}
