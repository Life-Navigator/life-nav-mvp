// STUB — Custom JWT auth removed during Supabase migration.
// Stale API routes still import these. Will be removed when routes are rewritten.
export interface JwtPayload {
  sub: string;
  tenant_id: string;
  userId?: string;
}
export async function verifyJwt(_token?: any): Promise<JwtPayload | null> {
  return null;
}
export const verifyToken = verifyJwt;
export async function getUserIdFromJWT(_request?: any): Promise<string | null> {
  return null;
}
