import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';

export interface JWTPayload {
  sub: string; // user ID
  tenant_id: string;
  exp: number;
  iat: number;
  type?: string;
}

/**
 * Verify and decode JWT token from cookies or Authorization header
 */
export async function verifyJWT(request?: Request): Promise<JWTPayload | null> {
  try {
    let token: string | null = null;

    // Try to get token from cookies first (check both cookie names for compatibility)
    const cookieStore = await cookies();
    token = cookieStore.get('access_token')?.value || cookieStore.get('token')?.value || null;

    // If not in cookies, try Authorization header
    if (!token && request) {
      const authHeader = request.headers.get('authorization');
      if (authHeader?.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }

    if (!token) {
      return null;
    }

    // Verify token (we'll use the same JWT_SECRET as backend)
    const secret = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET;
    if (!secret) {
      console.error('JWT_SECRET not configured');
      return null;
    }

    const decoded = jwt.verify(token, secret) as JWTPayload;

    // Verify it's an access token (not refresh token)
    if (decoded.type && decoded.type !== 'access') {
      return null;
    }

    return decoded;
  } catch (error) {
    console.error('JWT verification failed:', error);
    return null;
  }
}

/**
 * Get user ID from JWT token
 */
export async function getUserIdFromJWT(request?: Request): Promise<string | null> {
  const payload = await verifyJWT(request);
  return payload?.sub || null;
}
