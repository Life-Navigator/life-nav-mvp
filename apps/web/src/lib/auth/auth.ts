/**
 * Core authentication utilities for LifeNavigator
 */
import { JWTPayload, SignJWT, jwtVerify } from 'jose';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { parseAuthHeader } from './secure-cookie-config';

const JWT_SECRET = new TextEncoder().encode(process.env.NEXTAUTH_SECRET || 'development-secret');
const JWT_EXPIRY = '8h'; // 8 hours
const JWT_ROTATION_INTERVAL = 1000 * 60 * 60 * 2; // 2 hours

export interface JWTCustomPayload extends JWTPayload {
  jti: string;
  sub: string;
  email: string;
  role: string;
  deviceId?: string;
  iat: number;
  exp: number;
  rotationTimestamp?: number;
}

/**
 * Generate a new JWT token
 */
export async function generateToken(
  userId: string,
  email: string,
  role: string = 'user',
  deviceId?: string
): Promise<string> {
  const jti = uuidv4(); // Unique token ID for revocation
  const iat = Math.floor(Date.now() / 1000);
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 8; // 8 hours
  
  const token = await new SignJWT({ email, role, deviceId })
    .setProtectedHeader({ alg: 'HS256' })
    .setJti(jti)
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRY)
    .setSubject(userId)
    .sign(JWT_SECRET);
  
  // Log the token creation
  await db.securityAuditLog.create({
    data: {
      userId,
      eventType: 'token_created',
      data: {
        jti,
        deviceId,
      },
    },
  });
  
  return token;
}

/**
 * Verify a JWT token and return the payload
 */
export async function verifyToken(token: string): Promise<JWTCustomPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    
    // Check if token has been revoked
    const revokedToken = await db.revokedToken.findUnique({
      where: { jti: payload.jti as string },
    });
    
    if (revokedToken) {
      return null;
    }
    
    // Check if token needs rotation
    const needsRotation = shouldRotateToken(payload as JWTCustomPayload);
    
    return {
      ...payload,
      needsRotation,
    } as JWTCustomPayload;
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

/**
 * Determine if token should be rotated based on age
 */
function shouldRotateToken(payload: JWTCustomPayload): boolean {
  const lastRotation = payload.rotationTimestamp || payload.iat * 1000;
  const now = Date.now();
  return now - lastRotation > JWT_ROTATION_INTERVAL;
}

/**
 * Rotate a JWT token
 */
export async function rotateToken(oldPayload: JWTCustomPayload): Promise<string> {
  return generateToken(
    oldPayload.sub as string,
    oldPayload.email as string,
    oldPayload.role as string,
    oldPayload.deviceId
  );
}

/**
 * Revoke a JWT token
 */
export async function revokeToken(token: string, reason?: string): Promise<boolean> {
  try {
    const payload = await verifyToken(token);
    
    if (!payload) {
      return false;
    }
    
    await db.revokedToken.create({
      data: {
        jti: payload.jti,
        userId: payload.sub,
        expiresAt: new Date(payload.exp * 1000),
        reason,
      },
    });
    
    // Log the token revocation
    await db.securityAuditLog.create({
      data: {
        userId: payload.sub,
        eventType: 'token_revoked',
        data: {
          jti: payload.jti,
          reason,
        },
      },
    });
    
    return true;
  } catch (error) {
    console.error('Token revocation failed:', error);
    return false;
  }
}

/**
 * Validate session from request
 */
export async function validateSession(request: NextRequest): Promise<JWTCustomPayload | null> {
  const token = parseAuthHeader(request.cookies, request.headers.get('authorization'));
  
  if (!token) {
    return null;
  }
  
  return verifyToken(token);
}

/**
 * Get authenticated user from request
 */
export async function getAuthenticatedUser(request: NextRequest) {
  const payload = await validateSession(request);
  
  if (!payload) {
    return null;
  }
  
  const userId = payload.sub;
  
  // Get user from database
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      mfaEnabled: true,
      emailVerified: true,
    },
  });
  
  return user;
}

/**
 * Log security event
 */
export async function logSecurityEvent(userId: string, eventType: string, data?: any) {
  await db.securityAuditLog.create({
    data: {
      userId,
      eventType,
      data,
    },
  });
}

/**
 * Check if account is locked out
 */
export async function isAccountLocked(email: string): Promise<boolean> {
  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, lockedUntil: true },
  });
  
  if (!user) {
    return false;
  }
  
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    return true;
  }
  
  return false;
}

/**
 * Record failed login attempt
 */
export async function recordFailedLoginAttempt(email: string): Promise<boolean> {
  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, failedLoginAttempts: true },
  });
  
  if (!user) {
    return false;
  }
  
  const attempts = (user.failedLoginAttempts || 0) + 1;
  const MAX_ATTEMPTS = 5;
  
  // Lock account after max attempts
  if (attempts >= MAX_ATTEMPTS) {
    const lockedUntil = new Date();
    lockedUntil.setMinutes(lockedUntil.getMinutes() + 15); // 15 minute lockout
    
    await db.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: attempts,
        lockedUntil,
      },
    });
    
    await logSecurityEvent(user.id, 'account_locked', {
      reason: 'exceeded_max_attempts',
      attempts,
      lockedUntil,
    });
    
    return true;
  } else {
    await db.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: attempts,
      },
    });
    
    return false;
  }
}

/**
 * Reset failed login attempts
 */
export async function resetFailedLoginAttempts(userId: string): Promise<void> {
  await db.user.update({
    where: { id: userId },
    data: {
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
  });
}

/**
 * Track device information
 */
export async function trackUserDevice(userId: string, req: NextRequest): Promise<string> {
  const userAgent = req.headers.get('user-agent') || 'unknown';
  const ip = req.headers.get('x-forwarded-for') || req.ip || 'unknown';
  const deviceId = uuidv4();
  
  await db.userDevice.create({
    data: {
      userId,
      deviceId,
      ipAddress: ip.toString(),
      userAgent,
    },
  });
  
  return deviceId;
}