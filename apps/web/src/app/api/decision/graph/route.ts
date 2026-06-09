/** POST /api/decision/graph {decision_type} — Decision Intelligence Graph (nodes + edges). */
import { NextRequest, NextResponse } from 'next/server';

import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
const CORE_API = (process.env.CORE_API_URL || 'https://lifenavigator-core-api.fly.dev').replace(
  /\/$/,
  ''
);

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const r = await fetch(`${CORE_API}/v1/decision/workspace/graph`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  return NextResponse.json(await r.json().catch(() => ({})), { status: r.status });
}
