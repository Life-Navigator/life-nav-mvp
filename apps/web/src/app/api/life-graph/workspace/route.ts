import { NextResponse } from 'next/server';
import { CORE_API, token } from '../../life/_helper';

export const dynamic = 'force-dynamic';

const EMPTY = {
  nodes: [],
  edges: [],
  metrics: {
    totalNodes: 0,
    totalEdges: 0,
    avgConfidence: null,
    avgStrength: null,
    lastUpdated: null,
  },
};

export async function GET() {
  const t = await token();
  if (!t) return NextResponse.json(EMPTY, { status: 200 });

  try {
    const res = await fetch(`${CORE_API}/v1/life-graph/workspace`, {
      headers: { Authorization: `Bearer ${t}` },
      cache: 'no-store',
    });
    if (!res.ok) return NextResponse.json(EMPTY, { status: 200 });
    return NextResponse.json(await res.json().catch(() => EMPTY), { status: 200 });
  } catch {
    return NextResponse.json(EMPTY, { status: 200 });
  }
}
