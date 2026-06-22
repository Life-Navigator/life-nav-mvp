import { NextResponse } from 'next/server';

import { CORE_API, token } from '@/app/api/life/_helper';

// GET /api/documents/[id]/evidence — the "View Evidence" payload: document + every field with page,
// section, char span, confidence, method, review status. Proxies to core-api (user JWT, tenant-scoped).
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const t = await token();
  if (!t) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const r = await fetch(`${CORE_API}/v1/documents/${encodeURIComponent(id)}/evidence`, {
    headers: { Authorization: `Bearer ${t}` },
    cache: 'no-store',
  });
  return NextResponse.json(await r.json().catch(() => ({})), { status: r.status });
}
