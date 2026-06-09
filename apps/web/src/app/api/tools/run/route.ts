import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
export const dynamic = 'force-dynamic';
const CORE_API = (process.env.CORE_API_URL || 'https://lifenavigator-core-api.fly.dev').replace(
  /\/$/,
  ''
);
export async function POST(req: NextRequest) {
  const s = await createServerSupabaseClient();
  if (!s) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const {
    data: { session },
  } = await s.auth.getSession();
  if (!session?.access_token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { name, inputs } = await req.json().catch(() => ({ name: '', inputs: {} }));
  const r = await fetch(`${CORE_API}/v1/tools/${encodeURIComponent(name)}/run`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ inputs }),
    cache: 'no-store',
  });
  return NextResponse.json(await r.json().catch(() => ({})), { status: r.status });
}
