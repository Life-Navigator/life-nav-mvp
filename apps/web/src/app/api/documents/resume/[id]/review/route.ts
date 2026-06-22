import { NextResponse } from 'next/server';

import { CORE_API, token } from '@/app/api/life/_helper';

// GET /api/documents/resume/[id]/review — the Resume Import Review payload (records grouped by section).
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const t = await token();
  if (!t) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const r = await fetch(`${CORE_API}/v1/documents/resume/${encodeURIComponent(id)}/review`, {
    headers: { Authorization: `Bearer ${t}` },
    cache: 'no-store',
  });
  return NextResponse.json(await r.json().catch(() => ({})), { status: r.status });
}
