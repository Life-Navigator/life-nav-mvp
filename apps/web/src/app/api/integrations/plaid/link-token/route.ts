import { NextRequest, NextResponse } from 'next/server';
import { CORE_API, sessionToken } from '../_core';
import { blockRealLinkIfBeta } from '@/lib/integrations/plaid/beta';

export const dynamic = 'force-dynamic';

// Proxy to core-api: the backend owns the Plaid credentials and creates the
// Link token. The beta guard stays on the frontend so real bank linking remains
// blocked during the beta (only sample personas are allowed).
export async function POST(_request: NextRequest) {
  const t = await sessionToken();
  if (!t) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const betaBlock = blockRealLinkIfBeta();
  if (betaBlock) return betaBlock;

  const r = await fetch(`${CORE_API}/v1/finance/plaid/link-token`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
    body: '{}',
    cache: 'no-store',
  });
  return NextResponse.json(
    await r.json().catch(() => ({ error: 'Bank connections are not available yet.' })),
    { status: r.status }
  );
}
