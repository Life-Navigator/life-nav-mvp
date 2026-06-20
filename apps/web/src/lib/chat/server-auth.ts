import 'server-only';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/** The authenticated user's id, or null. Every /api/chat/* route uses this to scope data to the caller. */
export async function authedUserId(): Promise<string | null> {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}
