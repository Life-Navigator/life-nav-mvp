/** GET /api/reports/[type]/pdf — stream a branded report PDF from the Core API (user JWT only). */
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
  const upstream = await fetch(`${CORE_API}/v1/reports/${type}/pdf`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
    cache: 'no-store',
  });
  if (!upstream.ok)
    return NextResponse.json({ error: 'PDF unavailable' }, { status: upstream.status });
  return new NextResponse(await upstream.arrayBuffer(), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="lifenavigator-${type}-report.pdf"`,
    },
  });
}
