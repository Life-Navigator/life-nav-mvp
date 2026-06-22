import { NextResponse } from 'next/server';

import { CORE_API, token } from '@/app/api/life/_helper';

// POST /api/documents/resume/items/[itemId] — per-item review: edit (fields) / ignore / reset.
export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: Promise<{ itemId: string }> }) {
  const t = await token();
  if (!t) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { itemId } = await params;
  const body = await req.json().catch(() => ({}));
  const r = await fetch(`${CORE_API}/v1/documents/resume/items/${encodeURIComponent(itemId)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: body.action, fields: body.fields ?? null }),
    cache: 'no-store',
  });
  return NextResponse.json(await r.json().catch(() => ({})), { status: r.status });
}
