/**
 * Re-export from the Supabase-backed auth module.
 * Several routes import from '@/lib/jwt' — this ensures they all use
 * Supabase session cookies instead of custom JWT verification.
 */

export { verifyJwt as verifyJWT, verifyToken, getUserIdFromJWT } from '@/lib/auth/jwt';
export type { JwtPayload as JWTPayload } from '@/lib/auth/jwt';
