import { NextResponse } from 'next/server';

import { CORE_API, token } from '@/app/api/life/_helper';

// POST /api/documents/conflicts/scan — re-run deterministic conflict detection now.
export const dynamic = 'force-dynamic';

export async function POST() {
  const t = await token();
  if (!t) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const r = await fetch(`${CORE_API}/v1/documents/conflicts/scan`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${t}` },
    cache: 'no-store',
  });
  return NextResponse.json(await r.json().catch(() => ({})), { status: r.status });
}
