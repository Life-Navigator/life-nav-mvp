/**
 * GET /api/admin/pilot-analytics — render-only proxy for the Pilot Analytics Dashboard.
 * Forwards the user's Supabase JWT to the Core API /v1/admin/pilot-analytics (counts/rates only,
 * no PII). The upstream is admin-gated and returns 403 for non-admins — we pass that status
 * straight through so the dashboard can surface an honest "admin only" state.
 */
import { NextResponse } from 'next/server';

import { CORE_API, token } from '../../life/_helper';

export const dynamic = 'force-dynamic';

export async function GET() {
  const t = await token();
  if (!t) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const upstream = await fetch(`${CORE_API}/v1/admin/pilot-analytics`, {
      headers: { Authorization: `Bearer ${t}` },
      cache: 'no-store',
    });
    return NextResponse.json(await upstream.json().catch(() => ({})), { status: upstream.status });
  } catch {
    return NextResponse.json({ error: 'Pilot analytics unavailable' }, { status: 502 });
  }
}
