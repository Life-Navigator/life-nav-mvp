/**
 * POST /api/decision  { question }
 * Render-only proxy: forwards the user's Supabase JWT + question to the Core API
 * cross-domain Decision Engine (/v1/decision) and returns the persisted decision graph
 * (verdict + worst/expected/best scenarios + evidence + tradeoffs + confidence + boundary).
 * Only the user JWT travels (no service-role/Gemini key).
 */
import { NextRequest, NextResponse } from 'next/server';

import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const CORE_API = (process.env.CORE_API_URL || 'https://lifenavigator-core-api.fly.dev').replace(
  /\/$/,
  ''
);

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await request.json().catch(() => ({}));
    const question = typeof body?.question === 'string' ? body.question : '';
    if (!question.trim())
      return NextResponse.json({ error: 'A question is required' }, { status: 400 });
    const upstream = await fetch(`${CORE_API}/v1/decision`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ question }),
      cache: 'no-store',
    });
    const out = await upstream.json().catch(() => ({}));
    return NextResponse.json(out, { status: upstream.status });
  } catch {
    return NextResponse.json({ error: 'Decision engine unavailable' }, { status: 502 });
  }
}
