/**
 * Token management and rotation functionality
 */
import { JWTCustomPayload, generateToken, verifyToken } from './auth';
import { db } from '@/lib/db';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

// Constants
const SESSION_COOKIE_NAME = 'next-auth.session-token';
const JWT_ROTATION_INTERVAL = 1000 * 60 * 60 * 2; // 2 hours

/**
 * Check if token needs rotation
 */
export function shouldRotateToken(payload: JWTCustomPayload): boolean {
  // Tokens are rotated every 2 hours
  const lastRotation = payload.rotationTimestamp || payload.iat * 1000;
  const now = Date.now();
  return now - lastRotation > JWT_ROTATION_INTERVAL;
}

/**
 * Rotate token and update cookie
 */
export async function rotateToken(payload: JWTCustomPayload): Promise<string> {
  // Generate new token
  const newToken = await generateToken(
    payload.sub as string,
    payload.email as string,
    payload.role as string,
    payload.deviceId
  );
  
  // Store rotation timestamp
  const now = Date.now();
  
  // Log the token rotation
  await db.securityAuditLog.create({
    data: {
      userId: payload.sub as string,
      eventType: 'token_rotated',
      data: {
        oldJti: payload.jti,
        iat: payload.iat,
        rotatedAt: now,
      },
    },
  });
  
  return newToken;
}

/**
 * Handle token rotation in response
 */
export async function handleTokenRotation(req: NextRequest, res: NextResponse): Promise<NextResponse> {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  
  if (!token) {
    return res;
  }
  
  const payload = await verifyToken(token);
  
  if (!payload) {
    return res;
  }
  
  // Check if token needs rotation
  if (shouldRotateToken(payload)) {
    const newToken = await rotateToken(payload);
    
    // Check if production environment
    const isProduction = process.env.NODE_ENV === 'production';
    
    // Set the new token in a cookie
    const cookieOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      path: '/',
      maxAge: 8 * 60 * 60, // 8 hours
    };
    
    // Clone the response to add the new cookie
    const response = new NextResponse(res.body, {
      status: res.status,
      headers: res.headers,
    });
    
    // Add the new cookie
    response.cookies.set(SESSION_COOKIE_NAME, newToken, cookieOptions as any);
    
    return response;
  }
  
  return res;
}

/**
 * Revoke a specific token
 */
export async function revokeSpecificToken(jti: string, userId: string, reason?: string): Promise<boolean> {
  try {
    // Get the token information
    const token = await db.session.findFirst({
      where: {
        sessionToken: jti,
        userId,
      },
    });
    
    if (!token) {
      return false;
    }
    
    // Calculate expiry (use original expiry if available, or default to 8 hours)
    const expiresAt = token.expires || new Date(Date.now() + 1000 * 60 * 60 * 8);
    
    // Add to revoked tokens table
    await db.revokedToken.create({
      data: {
        jti,
        userId,
        reason: reason || 'manually_revoked',
        expiresAt,
      },
    });
    
    // Remove from active sessions
    await db.session.delete({
      where: {
        id: token.id,
      },
    });
    
    // Log the revocation
    await db.securityAuditLog.create({
      data: {
        userId,
        eventType: 'token_revoked',
        data: {
          jti,
          reason,
        },
      },
    });
    
    return true;
  } catch (error) {
    console.error('Token revocation error:', error);
    return false;
  }
}

/**
 * Revoke all tokens for a user
 */
export async function revokeAllTokens(userId: string, reason?: string): Promise<boolean> {
  try {
    // Get all active sessions
    const sessions = await db.session.findMany({
      where: {
        userId,
      },
    });
    
    // Revoke each token
    for (const session of sessions) {
      await revokeSpecificToken(session.sessionToken, userId, reason);
    }
    
    // Log the mass revocation
    await db.securityAuditLog.create({
      data: {
        userId,
        eventType: 'all_tokens_revoked',
        data: {
          reason,
          sessionCount: sessions.length,
        },
      },
    });
    
    return true;
  } catch (error) {
    console.error('All tokens revocation error:', error);
    return false;
  }
}

/**
 * Revoke tokens for a specific device
 */
export async function revokeDeviceTokens(userId: string, deviceId: string, reason?: string): Promise<boolean> {
  try {
    // Get sessions for this device
    const sessions = await db.session.findMany({
      where: {
        userId,
        deviceId,
      },
    });
    
    // Revoke each token
    for (const session of sessions) {
      await revokeSpecificToken(session.sessionToken, userId, reason);
    }
    
    // Mark device as revoked
    await db.userDevice.updateMany({
      where: {
        userId,
        deviceId,
      },
      data: {
        isRevoked: true,
      },
    });
    
    // Log the device revocation
    await db.securityAuditLog.create({
      data: {
        userId,
        eventType: 'device_tokens_revoked',
        data: {
          deviceId,
          reason,
          sessionCount: sessions.length,
        },
      },
    });
    
    return true;
  } catch (error) {
    console.error('Device tokens revocation error:', error);
    return false;
  }
}

/**
 * Clean up expired tokens
 * This should be run periodically via a cron job
 */
export async function cleanupExpiredTokens(): Promise<number> {
  try {
    // Delete expired sessions
    const deletedSessions = await db.session.deleteMany({
      where: {
        expires: {
          lt: new Date(),
        },
      },
    });
    
    // Delete expired revoked tokens (to keep the table size manageable)
    const deletedRevokedTokens = await db.revokedToken.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });
    
    return deletedSessions.count + deletedRevokedTokens.count;
  } catch (error) {
    console.error('Token cleanup error:', error);
    return 0;
  }
}