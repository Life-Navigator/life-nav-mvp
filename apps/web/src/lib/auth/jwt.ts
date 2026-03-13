// STUB — Custom JWT auth removed during Supabase migration
// Stale API routes still import this. Will be removed when routes are rewritten.
export interface JwtPayload { sub: string; tenant_id: string; }
export async function verifyJwt(): Promise<JwtPayload | null> { return null; }
export async function getUserIdFromJWT(): Promise<string | null> { return null; }
