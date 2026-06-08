/**
 * GET /api/family/summary
 * Render-only proxy: forwards the user's Supabase JWT to the Core API /v1/family/summary
 * and returns the Family DomainViewModel. Only the user JWT travels (no service-role/Gemini).
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
    const upstream = await fetch(`${CORE_API}/v1/family/summary`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${session.access_token}` },
      cache: 'no-store',
    });
    const body = await upstream.json().catch(() => ({}));
    return NextResponse.json(body, { status: upstream.status });
  } catch {
    return NextResponse.json({ error: 'Family summary unavailable' }, { status: 502 });
  }
}
