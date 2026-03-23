/**
 * Legacy JWT module — redirects to Supabase-based auth.
 *
 * This file exists only for backward compatibility with routes
 * that import from '@/lib/jwt'. All auth is now handled by Supabase.
 *
 * TODO: Update all 7 importing files to use '@/lib/auth/jwt' directly,
 * then delete this file.
 */

export { getUserIdFromJWT, verifyToken } from '@/lib/auth/jwt';
export type { JwtPayload } from '@/lib/auth/jwt';

// Alias used by some routes
export const verifyJWT = async (request?: Request): Promise<{ sub?: string } | null> => {
  const { getUserIdFromJWT } = await import('@/lib/auth/jwt');
  const userId = await getUserIdFromJWT();
  return userId ? { sub: userId } : null;
};
