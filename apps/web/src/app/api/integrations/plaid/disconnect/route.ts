import { NextRequest, NextResponse } from 'next/server';
import { CORE_API, sessionToken } from '../_core';

export const dynamic = 'force-dynamic';

// Proxy to core-api: the backend revokes the Plaid item (creds are Fly secrets)
// and deletes the finance.plaid_items row for the caller's own item only.
export async function POST(request: NextRequest) {
  const t = await sessionToken();
  if (!t) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { itemId } = await request.json().catch(() => ({}));
  if (!itemId) return NextResponse.json({ error: 'Missing itemId' }, { status: 400 });

  const r = await fetch(`${CORE_API}/v1/finance/plaid/disconnect`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ item_id: itemId }),
    cache: 'no-store',
  });
  return NextResponse.json(await r.json().catch(() => ({ error: 'Disconnect failed.' })), {
    status: r.status,
  });
}
