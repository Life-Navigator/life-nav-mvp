/**
 * GET /api/career/summary
 *
 * Render-only proxy for the Career dashboard. Forwards the signed-in user's Supabase
 * JWT to the Core API and returns the Career DomainViewModel directly — NO business
 * logic here, and only the user's own JWT travels (never the service-role or Gemini
 * keys). Core API URL defaults to the prod deployment.
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
    if (!session?.access_token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const upstream = await fetch(`${CORE_API}/v1/career/summary`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${session.access_token}` },
      cache: 'no-store',
    });
    const body = await upstream.json().catch(() => ({}));
    return NextResponse.json(body, { status: upstream.status });
  } catch {
    // Degrade gracefully — the page renders missing-data prompts, never fake data.
    return NextResponse.json({ error: 'Career summary unavailable' }, { status: 502 });
  }
}
