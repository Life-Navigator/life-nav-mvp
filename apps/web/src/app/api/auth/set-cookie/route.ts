import { NextResponse } from 'next/server';

/**
 * Deprecated — Supabase SSR handles session cookies automatically.
 * This endpoint is kept to avoid 404s from any stale client code.
 */
export async function POST() {
  return NextResponse.json(
    { error: 'This endpoint is deprecated. Auth is handled by Supabase SSR.' },
    { status: 410 }
  );
}
