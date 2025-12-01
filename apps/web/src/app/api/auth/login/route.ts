import { NextRequest, NextResponse } from 'next/server';
import * as bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';
import { db as prisma } from '@/lib/db';
import { withDatabaseRetry } from '@/lib/db-utils';

// Interface for login data
interface LoginRequestBody {
  email: string;
  password: string;
}

// Get JWT secret
function getJwtSecret(): Uint8Array {
  const secret = process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET || 'fallback-secret-change-in-production';
  return new TextEncoder().encode(secret);
}

export async function POST(request: NextRequest) {
  try {
    // Parse the request body
    const body: LoginRequestBody = await request.json();

    // Validate required fields
    if (!body.email || !body.password) {
      return NextResponse.json(
        {
          success: false,
          message: 'Missing required fields: email and password are required'
        },
        { status: 400 }
      );
    }

    console.log('[Login API Route] Attempting login for:', body.email);

    // Find user in database with retry logic
    const user = await withDatabaseRetry(async () => {
      return await prisma.user.findUnique({
        where: { email: body.email.toLowerCase() },
        select: {
          id: true,
          email: true,
          name: true,
          password: true,
          role: true,
          pilotRole: true,
          pilotEnabled: true,
          setupCompleted: true,
          emailVerified: true,
        },
      });
    });

    if (!user) {
      console.log('[Login API Route] User not found:', body.email);
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid email or password'
        },
        { status: 401 }
      );
    }

    // Check if user has a password (may be OAuth only)
    if (!user.password) {
      console.log('[Login API Route] User has no password (OAuth only):', body.email);
      return NextResponse.json(
        {
          success: false,
          message: 'Please use your social login provider to sign in'
        },
        { status: 401 }
      );
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(body.password, user.password);

    if (!isValidPassword) {
      console.log('[Login API Route] Invalid password for:', body.email);
      return NextResponse.json(
        {
          success: false,
          message: 'Invalid email or password'
        },
        { status: 401 }
      );
    }

    // Check pilot access
    if (!user.pilotEnabled) {
      console.log('[Login API Route] User not pilot enabled:', body.email);
      return NextResponse.json(
        {
          success: false,
          message: 'Your account is not yet activated for pilot access. Please contact support.'
        },
        { status: 403 }
      );
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    // Generate JWT tokens
    const now = Math.floor(Date.now() / 1000);
    const accessTokenExpiry = now + 30 * 60; // 30 minutes
    const refreshTokenExpiry = now + 7 * 24 * 60 * 60; // 7 days

    const accessToken = await new SignJWT({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      pilotRole: user.pilotRole,
      pilotEnabled: user.pilotEnabled,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt(now)
      .setExpirationTime(accessTokenExpiry)
      .setSubject(user.id)
      .sign(getJwtSecret());

    const refreshToken = await new SignJWT({
      userId: user.id,
      type: 'refresh',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt(now)
      .setExpirationTime(refreshTokenExpiry)
      .setSubject(user.id)
      .sign(getJwtSecret());

    console.log('[Login API Route] Login successful for:', body.email);

    // Create response with cookies
    const response = NextResponse.json(
      {
        success: true,
        message: 'Login successful',
        access_token: accessToken,
        refresh_token: refreshToken,
        token_type: 'Bearer',
        expires_in: 30 * 60, // 30 minutes in seconds
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          pilotRole: user.pilotRole,
          pilotEnabled: user.pilotEnabled,
          setupCompleted: user.setupCompleted,
        },
      },
      { status: 200 }
    );

    // Set HTTP-only cookies for security
    const isProduction = process.env.NODE_ENV === 'production';

    response.cookies.set('token', accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 30 * 60, // 30 minutes
      path: '/',
    });

    response.cookies.set('refreshToken', refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/',
    });

    return response;

  } catch (error) {
    // Handle unexpected errors
    console.error('[Login API Route] Unexpected error:', error);

    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';

    return NextResponse.json(
      {
        success: false,
        message: `Server error: ${errorMessage}`
      },
      { status: 500 }
    );
  }
}
