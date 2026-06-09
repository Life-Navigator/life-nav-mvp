/** Recommendation Inbox proxy. GET → prioritized list; POST → sync; PUT {id,status} → lifecycle. */
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
export const dynamic = 'force-dynamic';
const CORE_API = (process.env.CORE_API_URL || 'https://lifenavigator-core-api.fly.dev').replace(
  /\/$/,
  ''
);
async function tok() {
  const s = await createServerSupabaseClient();
  if (!s) return null;
  const {
    data: { session },
  } = await s.auth.getSession();
  return session?.access_token ?? null;
}
export async function GET() {
  const t = await tok();
  if (!t) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const r = await fetch(`${CORE_API}/v1/recommendations/prioritize?top=20`, {
    headers: { Authorization: `Bearer ${t}` },
    cache: 'no-store',
  });
  return NextResponse.json(await r.json().catch(() => ({})), { status: r.status });
}
export async function POST() {
  const t = await tok();
  if (!t) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const r = await fetch(`${CORE_API}/v1/recommendations/sync`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${t}` },
    cache: 'no-store',
  });
  return NextResponse.json(await r.json().catch(() => ({})), { status: r.status });
}
export async function PUT(req: NextRequest) {
  const t = await tok();
  if (!t) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id, status } = await req.json().catch(() => ({}));
  const r = await fetch(`${CORE_API}/v1/recommendations/${id}/status`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
    cache: 'no-store',
  });
  return NextResponse.json(await r.json().catch(() => ({})), { status: r.status });
}
