import { NextRequest, NextResponse } from 'next/server';
import { CORE_API, token } from '../_helper';

export const dynamic = 'force-dynamic';

// Surfacing primitive: extracted document facts (life.facts) for the dashboard "recently learned" strip
// and per-domain evidence. Read-only proxy to the Core API; honest empty when none.
export async function GET(req: NextRequest) {
  const t = await token();
  if (!t) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const qs = new URLSearchParams();
  const domain = searchParams.get('domain');
  const limit = searchParams.get('limit');
  if (domain) qs.set('domain', domain);
  if (limit) qs.set('limit', limit);
  const r = await fetch(`${CORE_API}/v1/life/facts${qs.toString() ? `?${qs}` : ''}`, {
    headers: { Authorization: `Bearer ${t}` },
    cache: 'no-store',
  });
  return NextResponse.json(await r.json().catch(() => ({ facts: [] })), { status: r.status });
}
