import { NextResponse } from 'next/server';
import { CORE_API, token } from '../../life/_helper';
export const dynamic = 'force-dynamic';
export async function GET(req: Request) {
  const t = await token();
  if (!t) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const agent = new URL(req.url).searchParams.get('agent') || '';
  const r = await fetch(`${CORE_API}/v1/life/advisor/welcome?agent=${encodeURIComponent(agent)}`, {
    headers: { Authorization: `Bearer ${t}` },
    cache: 'no-store',
  });
  return NextResponse.json(await r.json().catch(() => ({})), { status: r.status });
}
