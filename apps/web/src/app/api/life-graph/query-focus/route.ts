import { NextRequest, NextResponse } from 'next/server';
import { CORE_API, token } from '../../life/_helper';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const t = await token();
  if (!t) return NextResponse.json({ nodeRelevance: {} });

  try {
    const res = await fetch(`${CORE_API}/v1/life-graph/query-focus`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify(body),
    });
    if (!res.ok) return NextResponse.json({ nodeRelevance: {} });
    return NextResponse.json(await res.json().catch(() => ({ nodeRelevance: {} })));
  } catch {
    return NextResponse.json({ nodeRelevance: {} });
  }
}
