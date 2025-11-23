/**
 * JWT Token Utilities
 * Verify and decode JWT tokens for authentication
 */

import { jwtVerify, SignJWT } from 'jose';

// Get JWT secret as Uint8Array for jose
function getJwtSecret(): Uint8Array {
  const secret = process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET || 'fallback-secret-change-in-production';
  return new TextEncoder().encode(secret);
}

export interface JwtPayload {
  userId: string;
  email?: string;
  name?: string;
  role?: string;
  pilotRole?: string;
  pilotEnabled?: boolean;
  type?: string;
  sub?: string;
  iat?: number;
  exp?: number;
}

/**
 * Verify a JWT token and return the payload
 */
export async function verifyToken(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    return payload as JwtPayload;
  } catch (error) {
    console.error('[JWT] Token verification failed:', error);
    return null;
  }
}

/**
 * Create a new JWT token
 */
export async function createToken(
  payload: Omit<JwtPayload, 'iat' | 'exp'>,
  expiresIn: number = 30 * 60 // 30 minutes default
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(now)
    .setExpirationTime(now + expiresIn)
    .setSubject(payload.userId)
    .sign(getJwtSecret());
}

/**
 * Decode a JWT token without verification (for debugging)
 */
export function decodeToken(token: string): JwtPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payload = JSON.parse(
      Buffer.from(parts[1], 'base64url').toString('utf-8')
    );
    return payload;
  } catch {
    return null;
  }
}

/**
 * Check if a token is expired
 */
export function isTokenExpired(token: string): boolean {
  const payload = decodeToken(token);
  if (!payload?.exp) return true;

  const now = Math.floor(Date.now() / 1000);
  return payload.exp < now;
}
