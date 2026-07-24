import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { recordUserEvent } from '@/lib/analytics/events';
import { CORE_API } from '../_core';
import { blockRealLinkIfBeta } from '@/lib/integrations/plaid/beta';

export const dynamic = 'force-dynamic';

// Proxy to core-api: the backend exchanges the browser-obtained public_token (Plaid creds are Fly secrets)
// and persists the item + accounts into finance.*. The beta guard stays here so real linking is blocked in
// beta. The `plaid_connected` funnel event stays on the frontend (server-side, best-effort) — no Plaid
// credentials or direct Plaid calls remain here.
export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!user || !session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const betaBlock = blockRealLinkIfBeta();
  if (betaBlock) return betaBlock;

  const { publicToken, institutionId } = await request.json().catch(() => ({}));
  if (!publicToken) {
    return NextResponse.json({ error: 'Missing publicToken' }, { status: 400 });
  }

  const r = await fetch(`${CORE_API}/v1/finance/plaid/exchange`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ public_token: publicToken }),
    cache: 'no-store',
  });
  const data = await r.json().catch(() => ({}));
  const accountsLinked = data?.accounts_linked ?? data?.accountsLinked ?? 0;

  // Funnel: a successful real-account connect. Best-effort, server-side; never fails the request.
  if (r.ok) {
    await recordUserEvent(supabase, {
      user_id: user.id,
      event_type: 'plaid_connected',
      event_metadata: { institution_id: institutionId ?? null, accounts_linked: accountsLinked },
      subject_kind: 'plaid_item',
      subject_id: null,
    }).catch(() => {});
  }
  // Preserve the prior response contract (accountsLinked) for existing callers.
  return NextResponse.json({ ...data, accountsLinked }, { status: r.status });
}
