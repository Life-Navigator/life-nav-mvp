import { NextRequest, NextResponse } from 'next/server';
import { CORE_API, sessionToken } from '../_core';
import { blockRealLinkIfBeta } from '@/lib/integrations/plaid/beta';

export const dynamic = 'force-dynamic';

// Proxy to core-api: the backend exchanges the browser-obtained public_token
// (Plaid creds are Fly secrets) and persists the item + accounts into finance.*.
// The beta guard stays here so real linking is blocked during the beta.
export async function POST(request: NextRequest) {
  const t = await sessionToken();
  if (!t) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const betaBlock = blockRealLinkIfBeta();
  if (betaBlock) return betaBlock;

  const { publicToken } = await request.json().catch(() => ({}));
  if (!publicToken) {
    return NextResponse.json({ error: 'Missing publicToken' }, { status: 400 });
  }

  const r = await fetch(`${CORE_API}/v1/finance/plaid/exchange`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ public_token: publicToken }),
    cache: 'no-store',
  });
  const data = await r.json().catch(() => ({}));
  // Preserve the prior response contract (accountsLinked) for existing callers.
  return NextResponse.json(
    { ...data, accountsLinked: data?.accounts_linked ?? data?.accountsLinked ?? 0 },
    { status: r.status }
  );
}
