import { NextResponse } from 'next/server';

import { CORE_API, token } from '@/app/api/life/_helper';

// POST /api/documents/conflicts/[id]/resolve — keep (item_id) / value (corrected) / ignore.
export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const t = await token();
  if (!t) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const r = await fetch(`${CORE_API}/v1/documents/conflicts/${encodeURIComponent(id)}/resolve`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      resolution: body.resolution,
      value: body.value ?? '',
      item_id: body.item_id ?? '',
    }),
    cache: 'no-store',
  });
  return NextResponse.json(await r.json().catch(() => ({})), { status: r.status });
}
