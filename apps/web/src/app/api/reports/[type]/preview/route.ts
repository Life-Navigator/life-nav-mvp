/** GET /api/reports/[type]/preview — pass-through the full report JSON from the Core API
 *  (user JWT only). Mirrors the sibling pdf/route.ts proxy; returns the
 *  { format, report } payload from GET /v1/reports/{type}/preview unchanged. */
import { NextRequest, NextResponse } from 'next/server';

import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
const CORE_API = (process.env.CORE_API_URL || 'https://lifenavigator-core-api.fly.dev').replace(
  /\/$/,
  ''
);
const TYPES = ['full', 'financial', 'decision', 'family', 'compensation', 'education', 'health'];

export async function GET(req: NextRequest, ctx: { params: Promise<{ type: string }> }) {
  const { type } = await ctx.params;
  if (!TYPES.includes(type))
    return NextResponse.json({ error: 'unknown report type' }, { status: 400 });
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const upstream = await fetch(`${CORE_API}/v1/reports/${type}/preview`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
    cache: 'no-store',
  });
  return NextResponse.json(await upstream.json().catch(() => ({})), { status: upstream.status });
}
