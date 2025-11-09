/**
 * MFA Setup Endpoint
 *
 * Handles multi-factor authentication setup with TOTP and recovery codes
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromJWT } from '@/lib/jwt';
import { db as prisma } from '@/lib/db';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
import { hash } from 'bcryptjs';

// POST /api/auth/mfa/setup
// Generate TOTP secret and QR code for MFA setup
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromJWT(request);

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Generate TOTP secret using otplib
    const secret = authenticator.generateSecret();

    // Create otpauth URL for QR code
    const otpauthUrl = authenticator.keyuri(
      user.email,
      'Life Navigator',
      secret
    );

    // Generate QR code
    const qrCode = await QRCode.toDataURL(otpauthUrl);

    // Generate 10 recovery codes
    const recoveryCodes = Array.from({ length: 10 }, () =>
      generateRecoveryCode()
    );

    return NextResponse.json({
      success: true,
      data: {
        secret: secret,
        qr_code: qrCode,
        recovery_codes: recoveryCodes,
        instructions: [
          '1. Scan QR code with authenticator app (Google Authenticator, Authy, etc.)',
          '2. Or manually enter the secret: ' + secret,
          '3. Enter 6-digit code from app to confirm setup',
          '4. Save recovery codes in secure location - they can be used if you lose access to your authenticator',
        ],
      },
    });
  } catch (error) {
    console.error('MFA setup error:', error);
    return NextResponse.json(
      { error: 'Failed to setup MFA' },
      { status: 500 }
    );
  }
}

// PUT /api/auth/mfa/setup
// Verify and save MFA setup
export async function PUT(request: NextRequest) {
  try {
    const userId = await getUserIdFromJWT(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { secret, code, recovery_codes } = body;

    // Validate input
    if (!secret || !code || !recovery_codes || recovery_codes.length !== 10) {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    // Verify TOTP code using otplib
    const verified = authenticator.verify({
      token: code,
      secret: secret,
    });

    if (!verified) {
      return NextResponse.json(
        { error: 'Invalid verification code' },
        { status: 400 }
      );
    }

    // Hash recovery codes
    const hashedRecoveryCodes = await Promise.all(
      recovery_codes.map((code: string) => hash(code, 10))
    );

    // Save to database
    await prisma.user.update({
      where: { id: userId },
      data: {
        mfaSecret: secret,
        mfaEnabled: true,
        recoveryCodes: JSON.stringify(hashedRecoveryCodes),
        failedLoginAttempts: 0, // Reset failed attempts on successful setup
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        message: 'MFA enabled successfully',
        recovery_codes_count: hashedRecoveryCodes.length,
      },
    });
  } catch (error) {
    console.error('MFA verification error:', error);
    return NextResponse.json(
      { error: 'Failed to verify MFA setup' },
      { status: 500 }
    );
  }
}

// Helper function to generate recovery code
function generateRecoveryCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  // Format as XXXX-XXXX for readability
  return code.slice(0, 4) + '-' + code.slice(4);
}
