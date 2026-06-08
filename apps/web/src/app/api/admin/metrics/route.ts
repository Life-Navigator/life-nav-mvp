/**
 * GET /api/admin/metrics — render-only proxy for the Executive Dashboard.
 * Forwards the user's Supabase JWT to the Core API /v1/admin/metrics (aggregate counts only).
 */
import { NextResponse } from 'next/server';

import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const CORE_API = (process.env.CORE_API_URL || 'https://lifenavigator-core-api.fly.dev').replace(
  /\/$/,
  ''
);

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const upstream = await fetch(`${CORE_API}/v1/admin/metrics`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
      cache: 'no-store',
    });
    return NextResponse.json(await upstream.json().catch(() => ({})), { status: upstream.status });
  } catch {
    return NextResponse.json({ error: 'Metrics unavailable' }, { status: 502 });
  }
}
