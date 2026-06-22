import { NextResponse } from 'next/server';

import { CORE_API, token } from '@/app/api/life/_helper';

// GET /api/documents/conflicts — detected contradictions across documents + user-entered domain data.
// Defaults to open conflicts; ?include_resolved=true or ?status=… to widen. Proxies to core-api.
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const t = await token();
  if (!t) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const qs = new URL(req.url).searchParams.toString();
  const r = await fetch(`${CORE_API}/v1/documents/conflicts${qs ? `?${qs}` : ''}`, {
    headers: { Authorization: `Bearer ${t}` },
    cache: 'no-store',
  });
  return NextResponse.json(await r.json().catch(() => ({})), { status: r.status });
}
