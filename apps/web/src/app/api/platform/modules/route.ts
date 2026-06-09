/** GET /api/platform/modules — server-authoritative module visibility for the current user. */
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
    if (!supabase) return NextResponse.json({ modules: {} }, { status: 200 });
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) return NextResponse.json({ modules: {} }, { status: 200 });
    const r = await fetch(`${CORE_API}/v1/platform/modules`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
      cache: 'no-store',
    });
    return NextResponse.json(await r.json().catch(() => ({ modules: {} })), { status: r.status });
  } catch {
    return NextResponse.json({ modules: {} }, { status: 200 });
  }
}
