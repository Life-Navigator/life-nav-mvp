import { createServerSupabaseClient } from '@/lib/supabase/server';

// The backend (Fly core-api) owns the Plaid integration and its credentials.
// These frontend routes are thin authenticated proxies: they forward the
// caller's Supabase JWT so the backend does every Plaid call and all finance.*
// persistence. Falls back to the public Fly URL when CORE_API_URL is unset,
// matching every other proxied route.
export const CORE_API = (
  process.env.CORE_API_URL || 'https://lifenavigator-core-api.fly.dev'
).replace(/\/$/, '');

/** The current session's access token, or null when unauthenticated. */
export async function sessionToken(): Promise<string | null> {
  const s = await createServerSupabaseClient();
  if (!s) return null;
  const {
    data: { session },
  } = await s.auth.getSession();
  return session?.access_token ?? null;
}
