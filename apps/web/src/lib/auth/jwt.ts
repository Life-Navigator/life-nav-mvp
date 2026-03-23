/**
 * Auth helpers for API route handlers.
 * Extracts user identity from Supabase session (cookie-based).
 *
 * Replaces the legacy JWT decoding with Supabase server client.
 */

import { NextRequest } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * Get the authenticated user's ID from the Supabase session.
 * Works in API route handlers where cookies are available.
 */
export async function getUserIdFromJWT(_request?: NextRequest | Request): Promise<string | null> {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user?.id ?? null;
}

/**
 * Verify that a request is authenticated. Returns true if valid.
 */
export async function verifyToken(_request?: NextRequest | Request): Promise<boolean> {
  const userId = await getUserIdFromJWT(_request);
  return !!userId;
}

// Legacy exports for backward compatibility
export interface JwtPayload {
  sub?: string;
  id?: string;
  email?: string;
}
