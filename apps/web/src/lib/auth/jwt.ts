/**
 * Auth helpers — backed by Supabase session cookies.
 * The 15+ scenario-lab routes import getUserIdFromJWT / verifyToken from here.
 * Instead of rewriting each route, we make these functions extract the user
 * from the Supabase session that the middleware already established.
 */

import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface JwtPayload {
  sub: string;
  tenant_id: string;
  userId?: string;
}

export async function verifyJwt(_token?: any): Promise<JwtPayload | null> {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return {
    sub: user.id,
    tenant_id: 'default',
    userId: user.id,
  };
}

export const verifyToken = verifyJwt;

export async function getUserIdFromJWT(_request?: any): Promise<string | null> {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}
