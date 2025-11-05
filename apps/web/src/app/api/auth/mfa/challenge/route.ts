/**
 * MFA Challenge Endpoint
 *
 * Verifies TOTP code or recovery code from user during authentication
 */

import { NextRequest, NextResponse } from 'next/server';
import { db as prisma } from '@/lib/db';
import { authenticator } from 'otplib';
import { compare } from 'bcryptjs';

// POST /api/auth/mfa/challenge
// Verify TOTP code from user
export async function POST(request: NextRequest) {
  try {
    const { email, code } = await request.json();

    if (!email || !code) {
      return NextResponse.json(
        { error: 'Email and code required' },
        { status: 400 }
      );
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if user has MFA enabled
    if (!user.mfaEnabled || !user.mfaSecret) {
      return NextResponse.json(
        { error: 'MFA not enabled for this user' },
        { status: 400 }
      );
    }

    // Check lockout status
    if (user.lockedUntil && new Date() < user.lockedUntil) {
      const remainingTime = Math.ceil(
        (user.lockedUntil.getTime() - Date.now()) / 1000
      );
      return NextResponse.json(
        {
          error: 'Account locked due to too many failed attempts',
          retry_after: remainingTime,
          locked: true,
        },
        { status: 429 }
      );
    }

    // Try TOTP verification using otplib
    const totpVerified = authenticator.verify({
      token: code,
      secret: user.mfaSecret,
    });

    if (totpVerified) {
      // Reset failed attempts
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });

      return NextResponse.json({
        success: true,
        data: {
          message: 'MFA verification successful',
          user_id: user.id,
          email: user.email,
        },
      });
    }

    // Try recovery code (if not used already)
    if (user.recoveryCodes) {
      let recoveryCodes: string[];
      try {
        recoveryCodes = JSON.parse(user.recoveryCodes);
      } catch (e) {
        recoveryCodes = [];
      }

      if (recoveryCodes && recoveryCodes.length > 0) {
        for (let i = 0; i < recoveryCodes.length; i++) {
          const hashedCode = recoveryCodes[i];
          const matched = await compare(code, hashedCode);

          if (matched) {
            // Remove used recovery code
            const updatedCodes = recoveryCodes.filter((_, idx) => idx !== i);

            await prisma.user.update({
              where: { id: user.id },
              data: {
                recoveryCodes: JSON.stringify(updatedCodes),
                failedLoginAttempts: 0,
                lockedUntil: null,
              },
            });

            return NextResponse.json({
              success: true,
              data: {
                message: 'MFA verified with recovery code',
                user_id: user.id,
                email: user.email,
                recovery_codes_remaining: updatedCodes.length,
                warning:
                  updatedCodes.length === 0
                    ? 'All recovery codes used. Please generate new ones.'
                    : updatedCodes.length <= 2
                    ? 'Low recovery codes remaining. Consider generating new ones.'
                    : undefined,
              },
            });
          }
        }
      }
    }

    // Code verification failed
    const newFailedAttempts = (user.failedLoginAttempts || 0) + 1;
    const shouldLock = newFailedAttempts >= 5;
    const lockDuration = shouldLock ? 15 * 60 * 1000 : null; // 15 min lock

    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: newFailedAttempts,
        lockedUntil: lockDuration ? new Date(Date.now() + lockDuration) : null,
      },
    });

    return NextResponse.json(
      {
        error: 'Invalid MFA code',
        attempts_remaining: Math.max(0, 5 - newFailedAttempts),
        locked: shouldLock,
        lock_duration_minutes: shouldLock ? 15 : undefined,
      },
      { status: 401 }
    );
  } catch (error) {
    console.error('MFA challenge error:', error);
    return NextResponse.json(
      { error: 'MFA verification failed' },
      { status: 500 }
    );
  }
}
