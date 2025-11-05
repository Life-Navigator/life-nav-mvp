/**
 * Account Lockout Status Endpoint
 *
 * Check if a user account is locked due to failed login attempts
 */

import { NextRequest, NextResponse } from 'next/server';
import { db as prisma } from '@/lib/db';

// GET /api/auth/lockout-status?email=user@example.com
export async function GET(request: NextRequest) {
  try {
    const email = request.nextUrl.searchParams.get('email');

    if (!email) {
      return NextResponse.json(
        { error: 'Email required' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        lockedUntil: true,
        failedLoginAttempts: true,
      },
    });

    if (!user) {
      // For security, don't reveal that user doesn't exist
      // Return unlocked status to prevent user enumeration
      return NextResponse.json({
        success: true,
        data: {
          locked: false,
          failed_attempts: 0,
        },
      });
    }

    const now = new Date();
    const isLocked = user.lockedUntil && now < user.lockedUntil;

    if (isLocked && user.lockedUntil) {
      const remainingTime = Math.ceil(
        (user.lockedUntil.getTime() - now.getTime()) / 1000
      );

      return NextResponse.json({
        success: true,
        data: {
          locked: true,
          locked_until: user.lockedUntil.toISOString(),
          remaining_seconds: remainingTime,
          remaining_minutes: Math.ceil(remainingTime / 60),
          message: `Account is locked. Try again in ${Math.ceil(remainingTime / 60)} minute(s).`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        locked: false,
        failed_attempts: user.failedLoginAttempts || 0,
        attempts_remaining: Math.max(0, 5 - (user.failedLoginAttempts || 0)),
        message:
          user.failedLoginAttempts && user.failedLoginAttempts > 0
            ? `${user.failedLoginAttempts} failed attempt(s). Account will lock after 5 failed attempts.`
            : 'Account is not locked.',
      },
    });
  } catch (error) {
    console.error('Lockout status error:', error);
    return NextResponse.json(
      { error: 'Failed to check lockout status' },
      { status: 500 }
    );
  }
}
