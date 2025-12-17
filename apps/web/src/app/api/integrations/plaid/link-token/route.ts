/**
 * Plaid Link Token API Route
 *
 * Creates a Plaid Link token for initializing Plaid Link.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { products = ['auth', 'transactions'], country_codes = ['US'] } = body;

    // Get session token for backend authentication
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Forward request to backend
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const response = await fetch(`${backendUrl}/api/v1/integrations/plaid/link-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionToken}`,
      },
      body: JSON.stringify({
        products,
        country_codes,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: error.detail || 'Failed to create link token' },
        { status: response.status }
      );
    }

    const data = await response.json();

    return NextResponse.json({
      linkToken: data.link_token,
      expiration: data.expiration,
    });
  } catch (err) {
    console.error('Plaid link token error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
