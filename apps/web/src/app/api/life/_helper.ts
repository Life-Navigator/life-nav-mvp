import { createServerSupabaseClient } from '@/lib/supabase/server';
export const CORE_API = (
  process.env.CORE_API_URL || 'https://lifenavigator-core-api.fly.dev'
).replace(/\/$/, '');
export async function token() {
  const s = await createServerSupabaseClient();
  if (!s) return null;
  const {
    data: { session },
  } = await s.auth.getSession();
  return session?.access_token ?? null;
}
