import { NextRequest, NextResponse } from 'next/server';
import { CORE_API, token } from '../_helper';
export const dynamic = 'force-dynamic';
export async function POST(req: NextRequest) {
  const t = await token();
  if (!t) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const r = await fetch(`${CORE_API}/v1/life/goal`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  return NextResponse.json(await r.json().catch(() => ({})), { status: r.status });
}
