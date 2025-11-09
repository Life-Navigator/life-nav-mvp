/**
 * Account Lockout Status Endpoint
 *
 * Check if a user account is locked due to failed login attempts
 *
 * TODO: Implement actual lockout tracking with backend API call
 * Currently returns stub response to avoid blocking login flow
 */

import { NextRequest, NextResponse } from 'next/server';

// Shared lockout check logic
async function checkLockoutStatus(email: string) {
  // TODO: Call backend API to check actual lockout status
  // For now, always return unlocked to not block login flow
  return {
    locked: false,
    remainingTime: 0,
    failed_attempts: 0,
    attempts_remaining: 5,
    message: 'Account is not locked.',
  };
}

// POST /api/auth/lockout-status (for LoginForm)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'Email required' },
        { status: 400 }
      );
    }

    const status = await checkLockoutStatus(email);

    return NextResponse.json(status, { status: 200 });
  } catch (error) {
    console.error('[Lockout Status POST] Error:', error);
    return NextResponse.json(
      { locked: false, remainingTime: 0 },
      { status: 200 } // Return success even on error to not block login flow
    );
  }
}

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

    const status = await checkLockoutStatus(email);

    return NextResponse.json({
      success: true,
      data: status,
    });
  } catch (error) {
    console.error('[Lockout Status GET] Error:', error);
    return NextResponse.json(
      {
        success: true,
        data: { locked: false, remainingTime: 0, failed_attempts: 0 }
      },
      { status: 200 } // Return success even on error to not block login flow
    );
  }
}
