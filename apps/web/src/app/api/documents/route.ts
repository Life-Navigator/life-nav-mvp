/**
 * /api/documents — render-only proxy for the Document Intelligence Platform.
 * GET  → readiness (Core API GET /v1/documents). POST → register+extract a document.
 * Forwards the user's Supabase JWT only.
 */
import { NextRequest, NextResponse } from 'next/server';

import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
const CORE_API = (process.env.CORE_API_URL || 'https://lifenavigator-core-api.fly.dev').replace(/\/$/, '');

async function token() {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return null;
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

export async function GET() {
  const t = await token();
  if (!t) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const r = await fetch(`${CORE_API}/v1/documents`, { headers: { Authorization: `Bearer ${t}` }, cache: 'no-store' });
  return NextResponse.json(await r.json().catch(() => ({})), { status: r.status });
}

export async function POST(req: NextRequest) {
  const t = await token();
  if (!t) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const r = await fetch(`${CORE_API}/v1/documents`, {
    method: 'POST', headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body), cache: 'no-store',
  });
  return NextResponse.json(await r.json().catch(() => ({})), { status: r.status });
}
