import { NextResponse } from 'next/server';
import { CORE_API, token } from '../_helper';
export const dynamic = 'force-dynamic';
export async function GET() {
  const t = await token();
  if (!t) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const r = await fetch(`${CORE_API}/v1/life/my-life`, {
    headers: { Authorization: `Bearer ${t}` },
    cache: 'no-store',
  });
  return NextResponse.json(await r.json().catch(() => ({})), { status: r.status });
}
