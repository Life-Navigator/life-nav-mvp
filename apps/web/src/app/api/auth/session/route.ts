import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * Session endpoint — returns current user from Supabase session cookies.
 */
export async function GET() {
  const noSession = NextResponse.json(
    { user: null, expires: null },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } }
  );

  const supabase = await createServerSupabaseClient();
  if (!supabase) return noSession;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return noSession;

  const session = {
    user: {
      id: user.id,
      email: user.email || null,
      name: user.user_metadata?.full_name || user.user_metadata?.name || null,
      role: user.role || 'user',
    },
    expires: null,
  };

  return NextResponse.json(session, {
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}
