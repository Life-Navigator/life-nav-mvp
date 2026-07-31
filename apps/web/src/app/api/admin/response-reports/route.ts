/**
 * GET /api/admin/response-reports — render-only proxy for the advisor-response review queue.
 *
 * Forwards the user's Supabase JWT to the Core API, which enforces the narrow
 * `advisor_response_reviewer` capability. A 403 is passed straight through so the page can render
 * an honest denial. Hiding the nav link is NOT authorization — this route stays authorized upstream
 * even when requested directly.
 *
 * Only queue filters are forwarded. The upstream list returns minimized columns; no snapshot ever
 * transits this route.
 */
import { NextRequest, NextResponse } from 'next/server';

import { CORE_API, token } from '../../life/_helper';

export const dynamic = 'force-dynamic';

const ALLOWED_PARAMS = [
  'category',
  'review_status',
  'severity',
  'deployment_version',
  'prompt_version',
  'model_name',
  'assigned_to',
  'limit',
  'offset',
] as const;

export async function GET(req: NextRequest) {
  const t = await token();
  if (!t) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const incoming = req.nextUrl.searchParams;
  const qs = new URLSearchParams();
  for (const key of ALLOWED_PARAMS) {
    const v = incoming.get(key);
    if (v) qs.set(key, v);
  }
  try {
    const upstream = await fetch(`${CORE_API}/v1/analytics/admin/response-reports?${qs}`, {
      headers: { Authorization: `Bearer ${t}` },
      cache: 'no-store',
    });
    return NextResponse.json(await upstream.json().catch(() => ({})), { status: upstream.status });
  } catch {
    return NextResponse.json({ error: 'Review queue unavailable' }, { status: 502 });
  }
}
