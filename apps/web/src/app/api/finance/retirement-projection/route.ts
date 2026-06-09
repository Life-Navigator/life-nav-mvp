import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
export const dynamic = 'force-dynamic';
const CORE_API = (process.env.CORE_API_URL || 'https://lifenavigator-core-api.fly.dev').replace(
  /\/$/,
  ''
);
export async function GET(req: NextRequest) {
  const s = await createServerSupabaseClient();
  if (!s) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const {
    data: { session },
  } = await s.auth.getSession();
  if (!session?.access_token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const age = req.nextUrl.searchParams.get('current_age');
  const qs = age ? `?current_age=${encodeURIComponent(age)}` : '';
  const r = await fetch(`${CORE_API}/v1/finance/retirement-projection${qs}`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
    cache: 'no-store',
  });
  return NextResponse.json(await r.json().catch(() => ({})), { status: r.status });
}
