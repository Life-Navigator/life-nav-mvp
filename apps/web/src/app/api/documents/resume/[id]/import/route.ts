import { NextResponse } from 'next/server';

import { CORE_API, token } from '@/app/api/life/_helper';

// POST /api/documents/resume/[id]/import — import approved items into Career + Education.
// Body: { item_ids?: string[] } — omit to import every non-ignored item.
export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const t = await token();
  if (!t) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const r = await fetch(`${CORE_API}/v1/documents/resume/${encodeURIComponent(id)}/import`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ item_ids: body.item_ids ?? null }),
    cache: 'no-store',
  });
  return NextResponse.json(await r.json().catch(() => ({})), { status: r.status });
}
