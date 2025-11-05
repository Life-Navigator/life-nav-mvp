/**
 * Password Reset Endpoint
 *
 * Request and complete password reset with secure tokens
 */

import { NextRequest, NextResponse } from 'next/server';
import { db as prisma } from '@/lib/db';
import { hash } from 'bcryptjs';
import { randomBytes } from 'crypto';

// POST /api/auth/reset-password
// Request password reset (send email)
export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email required' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // For security, don't reveal if user exists
      return NextResponse.json({
        success: true,
        data: {
          message: 'If account exists, password reset email will be sent',
        },
      });
    }

    // Invalidate any existing password reset tokens
    await prisma.securityToken.updateMany({
      where: {
        userId: user.id,
        purpose: 'password_reset',
        used: false,
      },
      data: {
        used: true,
        usedAt: new Date(),
      },
    });

    // Generate reset token
    const resetToken = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.securityToken.create({
      data: {
        userId: user.id,
        token: resetToken,
        purpose: 'password_reset',
        expiresAt,
      },
    });

    // TODO: Send email with reset link
    // const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/auth/reset-password?token=${resetToken}`;
    console.log(
      `[TODO] Send password reset email to ${email} with token ${resetToken}`
    );

    return NextResponse.json({
      success: true,
      data: {
        message: 'If account exists, password reset email will be sent',
      },
    });
  } catch (error) {
    console.error('Password reset request error:', error);
    return NextResponse.json(
      { error: 'Failed to process password reset request' },
      { status: 500 }
    );
  }
}

// PUT /api/auth/reset-password
// Complete password reset with token
export async function PUT(request: NextRequest) {
  try {
    const { token, newPassword, confirmPassword } = await request.json();

    // Validate
    if (!token || !newPassword || !confirmPassword) {
      return NextResponse.json(
        { error: 'Token and passwords required' },
        { status: 400 }
      );
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { error: 'Passwords do not match' },
        { status: 400 }
      );
    }

    // Validate password strength (min 8 chars, mix of upper/lower/numbers)
    if (!isStrongPassword(newPassword)) {
      return NextResponse.json(
        {
          error:
            'Password must be at least 8 characters with uppercase, lowercase, and numbers',
        },
        { status: 400 }
      );
    }

    // Find token
    const securityToken = await prisma.securityToken.findFirst({
      where: {
        token,
        purpose: 'password_reset',
        used: false,
      },
      include: {
        user: true,
      },
    });

    if (!securityToken) {
      return NextResponse.json(
        { error: 'Invalid or already used reset token' },
        { status: 400 }
      );
    }

    // Check expiry
    if (new Date() > securityToken.expiresAt) {
      return NextResponse.json(
        { error: 'Reset token expired' },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await hash(newPassword, 10);

    // Update user password
    await prisma.user.update({
      where: { id: securityToken.userId },
      data: {
        password: hashedPassword,
        failedLoginAttempts: 0, // Reset failed attempts
        lockedUntil: null, // Unlock account if locked
      },
    });

    // Mark token as used
    await prisma.securityToken.update({
      where: { id: securityToken.id },
      data: {
        used: true,
        usedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        message: 'Password reset successfully',
      },
    });
  } catch (error) {
    console.error('Password reset error:', error);
    return NextResponse.json(
      { error: 'Failed to reset password' },
      { status: 500 }
    );
  }
}

// GET /api/auth/reset-password?token=xxx
// Validate reset token before showing form
export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { error: 'Reset token required' },
        { status: 400 }
      );
    }

    const securityToken = await prisma.securityToken.findFirst({
      where: {
        token,
        purpose: 'password_reset',
      },
      include: {
        user: {
          select: {
            email: true,
          },
        },
      },
    });

    if (!securityToken) {
      return NextResponse.json(
        { error: 'Invalid reset token' },
        { status: 400 }
      );
    }

    if (securityToken.used) {
      return NextResponse.json({
        success: false,
        data: {
          status: 'token_used',
          message: 'This reset link has already been used',
        },
      });
    }

    if (new Date() > securityToken.expiresAt) {
      return NextResponse.json({
        success: false,
        data: {
          status: 'token_expired',
          message: 'This reset link has expired',
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        status: 'valid',
        email: securityToken.user.email,
        expires_at: securityToken.expiresAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Reset token validation error:', error);
    return NextResponse.json(
      { error: 'Failed to validate reset token' },
      { status: 500 }
    );
  }
}

function isStrongPassword(password: string): boolean {
  // Min 8 chars, at least one uppercase, one lowercase, one number
  return (
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password)
  );
}
