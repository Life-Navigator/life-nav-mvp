import { JWT } from 'next-auth/jwt';
import { decode, sign } from 'jsonwebtoken';
import { randomUUID } from 'crypto';

// Token expiration times
const ACCESS_TOKEN_EXPIRY = 60 * 60 * 8; // 8 hours in seconds
const REFRESH_TOKEN_EXPIRY = 60 * 60 * 24 * 30; // 30 days in seconds

// JWT token handler with rotation
export async function rotateToken(token: JWT): Promise<JWT> {
  // If token was just created, no need to rotate
  if (Date.now() < (token.iat as number) * 1000 + 5000) {
    return token;
  }

  // Calculate token age
  const tokenAge = Math.floor(Date.now() / 1000) - (token.iat as number);
  
  // If token is past expiry, don't rotate (let it expire for security)
  if (tokenAge > ACCESS_TOKEN_EXPIRY) {
    return token;
  }
  
  // Rotate at half-life of token
  const shouldRotate = tokenAge > ACCESS_TOKEN_EXPIRY / 2;
  
  if (shouldRotate) {
    const secret = process.env.NEXTAUTH_SECRET;
    
    if (!secret) {
      console.error('NEXTAUTH_SECRET is not defined');
      return token;
    }
    
    // Create refresh token if it doesn't exist or is expired
    if (!token.refreshToken || (token.refreshTokenExpires && 
        new Date(token.refreshTokenExpires as number * 1000) < new Date())) {
      
      token.refreshToken = randomUUID();
      token.refreshTokenExpires = Math.floor(Date.now() / 1000) + REFRESH_TOKEN_EXPIRY;
    }
    
    // Create new JWT with refreshed expiration
    const newToken: JWT = {
      ...token,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + ACCESS_TOKEN_EXPIRY,
      jti: randomUUID(),
    };
    
    return newToken;
  }
  
  return token;
}

// Verify if token is near expiration and needs refresh
export function needsRefresh(token: JWT | null): boolean {
  if (!token) return true;
  
  // Get expiration time
  let expiration = token.exp as number;
  if (!expiration) {
    // If no expiration in token, try to decode it manually
    try {
      const decoded = decode(token as unknown as string);
      if (decoded && typeof decoded === 'object' && 'exp' in decoded) {
        expiration = decoded.exp as number;
      }
    } catch (e) {
      return true;
    }
  }
  
  if (!expiration) return true;
  
  // Calculate time until expiration (in seconds)
  const timeUntilExpiry = expiration - Math.floor(Date.now() / 1000);
  
  // Refresh if less than 15 minutes until expiry
  return timeUntilExpiry < 15 * 60;
}

// Create a new token
export function createToken(payload: Record<string, any>, secret: string): string {
  return sign(
    {
      ...payload,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + ACCESS_TOKEN_EXPIRY,
      jti: randomUUID(),
    },
    secret
  );
}

// Invalidate a token (typically on logout)
export function invalidateToken(token: JWT): JWT {
  return {
    ...token,
    exp: Math.floor(Date.now() / 1000), // Expire immediately
    refreshToken: null,
    refreshTokenExpires: null,
  };
}