/**
 * Email Verification Endpoint
 *
 * Verify user email address with token sent via email
 */

import { NextRequest, NextResponse } from 'next/server';
import { db as prisma } from '@/lib/db';
import { randomBytes } from 'crypto';

// POST /api/auth/verify-email
// Verify email with token sent to user
export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json(
        { error: 'Verification token required' },
        { status: 400 }
      );
    }

    // Find token in database
    const securityToken = await prisma.securityToken.findFirst({
      where: {
        token,
        purpose: 'email_verification',
        used: false,
      },
      include: {
        user: true,
      },
    });

    if (!securityToken) {
      return NextResponse.json(
        { error: 'Invalid or already used verification token' },
        { status: 400 }
      );
    }

    // Check if token expired
    if (new Date() > securityToken.expiresAt) {
      return NextResponse.json(
        { error: 'Verification token expired', expired: true },
        { status: 400 }
      );
    }

    // Update user email verified status
    await prisma.user.update({
      where: { id: securityToken.userId },
      data: {
        emailVerified: new Date(),
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
        message: 'Email verified successfully',
        email: securityToken.user.email,
      },
    });
  } catch (error) {
    console.error('Email verification error:', error);
    return NextResponse.json(
      { error: 'Email verification failed' },
      { status: 500 }
    );
  }
}

// GET /api/auth/verify-email?token=xxx
// Get verification status
export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { error: 'Verification token required' },
        { status: 400 }
      );
    }

    // Find token
    const securityToken = await prisma.securityToken.findFirst({
      where: {
        token,
        purpose: 'email_verification',
      },
      include: {
        user: true,
      },
    });

    if (!securityToken) {
      return NextResponse.json(
        { error: 'Invalid verification token' },
        { status: 400 }
      );
    }

    // Check if already verified
    if (securityToken.user.emailVerified) {
      return NextResponse.json({
        success: true,
        data: {
          status: 'already_verified',
          verified_at: securityToken.user.emailVerified.toISOString(),
        },
      });
    }

    // Check if token is used
    if (securityToken.used) {
      return NextResponse.json({
        success: true,
        data: {
          status: 'token_used',
          used_at: securityToken.usedAt?.toISOString(),
        },
      });
    }

    // Check if expired
    if (new Date() > securityToken.expiresAt) {
      return NextResponse.json({
        success: true,
        data: {
          status: 'token_expired',
          expired_at: securityToken.expiresAt.toISOString(),
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
    console.error('Verification token check error:', error);
    return NextResponse.json(
      { error: 'Failed to check verification status' },
      { status: 500 }
    );
  }
}

// POST /api/auth/verify-email/resend
// Resend verification email
export async function PUT(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email required' },
        { status: 400 }
      );
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Don't reveal if user exists
      return NextResponse.json({
        success: true,
        data: {
          message: 'If the email exists, a new verification link will be sent',
        },
      });
    }

    // Check if already verified
    if (user.emailVerified) {
      return NextResponse.json(
        { error: 'Email already verified' },
        { status: 400 }
      );
    }

    // Invalidate old tokens
    await prisma.securityToken.updateMany({
      where: {
        userId: user.id,
        purpose: 'email_verification',
        used: false,
      },
      data: {
        used: true,
        usedAt: new Date(),
      },
    });

    // Generate new token
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await prisma.securityToken.create({
      data: {
        userId: user.id,
        token,
        purpose: 'email_verification',
        expiresAt,
      },
    });

    // TODO: Send email with verification link
    // const verificationUrl = `${process.env.NEXT_PUBLIC_APP_URL}/auth/verify-email?token=${token}`;
    console.log(
      `[TODO] Send verification email to ${email} with token ${token}`
    );

    return NextResponse.json({
      success: true,
      data: {
        message: 'If the email exists, a new verification link will be sent',
      },
    });
  } catch (error) {
    console.error('Resend verification error:', error);
    return NextResponse.json(
      { error: 'Failed to resend verification email' },
      { status: 500 }
    );
  }
}
