/**
 * Account lockout protection
 */
import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { apiGateways } from '@/lib/middleware/api-gateway';

// Constants
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 15;

/**
 * Check if an account is locked out
 */
export async function isAccountLocked(email: string): Promise<boolean> {
  try {
    // Find user by email
    const user = await db.user.findUnique({
      where: { email },
      select: { 
        id: true, 
        lockedUntil: true 
      },
    });
    
    // If user not found, return false (don't reveal user existence)
    if (!user) {
      return false;
    }
    
    // If lockout time exists and is in the future, account is locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error checking account lock status:', error);
    return false;
  }
}

/**
 * Get account lockout details
 */
export async function getLockoutDetails(email: string): Promise<{
  locked: boolean;
  remainingSeconds: number;
  attemptsRemaining: number;
}> {
  try {
    // Default response (don't reveal if account exists)
    const defaultResponse = {
      locked: false,
      remainingSeconds: 0,
      attemptsRemaining: MAX_FAILED_ATTEMPTS,
    };
    
    // Find user by email
    const user = await db.user.findUnique({
      where: { email },
      select: { 
        id: true, 
        lockedUntil: true,
        failedLoginAttempts: true
      },
    });
    
    // If user not found, return default response
    if (!user) {
      return defaultResponse;
    }
    
    // If account is locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const now = new Date();
      const remainingMs = user.lockedUntil.getTime() - now.getTime();
      const remainingSeconds = Math.ceil(remainingMs / 1000);
      
      return {
        locked: true,
        remainingSeconds,
        attemptsRemaining: 0,
      };
    }
    
    // Account is not locked
    return {
      locked: false,
      remainingSeconds: 0,
      attemptsRemaining: MAX_FAILED_ATTEMPTS - (user.failedLoginAttempts || 0),
    };
  } catch (error) {
    console.error('Error getting lockout details:', error);
    return {
      locked: false,
      remainingSeconds: 0,
      attemptsRemaining: MAX_FAILED_ATTEMPTS,
    };
  }
}

/**
 * Record a failed login attempt and lock account if needed
 */
export async function recordFailedLoginAttempt(email: string): Promise<boolean> {
  try {
    // Find user by email
    const user = await db.user.findUnique({
      where: { email },
      select: { 
        id: true, 
        failedLoginAttempts: true 
      },
    });
    
    // If user not found, return false (don't reveal user existence)
    if (!user) {
      return false;
    }
    
    // Increment failed attempts
    const attempts = (user.failedLoginAttempts || 0) + 1;
    
    // Check if account should be locked
    if (attempts >= MAX_FAILED_ATTEMPTS) {
      // Calculate lock expiry (15 minutes from now)
      const lockedUntil = new Date();
      lockedUntil.setMinutes(lockedUntil.getMinutes() + LOCKOUT_DURATION_MINUTES);
      
      // Update user with lock info
      await db.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: attempts,
          lockedUntil,
          updatedAt: new Date(),
        },
      });
      
      // Log the lockout event
      await db.securityAuditLog.create({
        data: {
          userId: user.id,
          eventType: 'account_locked',
          data: {
            reason: 'max_failed_attempts',
            attempts,
            lockedUntil,
          },
        },
      });
      
      return true; // Account is now locked
    } else {
      // Just update the attempt count
      await db.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: attempts,
          updatedAt: new Date(),
        },
      });
      
      return false; // Account is not locked yet
    }
  } catch (error) {
    console.error('Error recording failed login attempt:', error);
    return false;
  }
}

/**
 * Reset failed login attempts after successful login
 */
export async function resetFailedLoginAttempts(userId: string): Promise<void> {
  try {
    await db.user.update({
      where: { id: userId },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        updatedAt: new Date(),
      },
    });
    
    // Log the reset
    await db.securityAuditLog.create({
      data: {
        userId,
        eventType: 'login_attempts_reset',
        data: {
          reason: 'successful_login',
        },
      },
    });
  } catch (error) {
    console.error('Error resetting failed login attempts:', error);
  }
}

/**
 * API handler to check account lockout status
 */
export async function lockoutStatusHandler(req: NextRequest) {
  try {
    // Only allow POST method
    if (req.method !== 'POST') {
      return NextResponse.json(
        { error: 'Method not allowed' },
        { status: 405 }
      );
    }
    
    // Parse the request body
    const body = await req.json();
    const { email } = body;
    
    // Validate email
    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }
    
    // Get lockout details
    const lockoutDetails = await getLockoutDetails(email);
    
    return NextResponse.json(lockoutDetails);
    
  } catch (error) {
    console.error('Lockout status error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

// Export the rate-limited API handler
export const lockoutStatusApiHandler = apiGateways.authInfo(lockoutStatusHandler);