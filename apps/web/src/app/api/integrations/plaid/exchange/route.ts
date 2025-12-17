/**
 * Plaid Token Exchange API Route
 *
 * Exchanges a Plaid public token for an access token.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { publicToken, institutionId, institutionName, accounts } = body;

    if (!publicToken) {
      return NextResponse.json(
        { error: 'Missing publicToken' },
        { status: 400 }
      );
    }

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
    const response = await fetch(`${backendUrl}/api/v1/integrations/plaid/exchange`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionToken}`,
      },
      body: JSON.stringify({
        public_token: publicToken,
        institution_id: institutionId,
        institution_name: institutionName,
        accounts,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: error.detail || 'Failed to exchange token' },
        { status: response.status }
      );
    }

    const data = await response.json();

    return NextResponse.json({
      success: data.success,
      accountsLinked: data.accounts_linked,
    });
  } catch (err) {
    console.error('Plaid exchange error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
