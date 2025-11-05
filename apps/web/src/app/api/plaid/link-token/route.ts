/**
 * POST /api/plaid/link-token
 * Create a Plaid Link token for connecting financial accounts
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { plaidClient, PLAID_PRODUCTS, PLAID_COUNTRY_CODES, isPlaidConfigured } from '@/lib/integrations/plaid-client';
import { Products, CountryCode } from 'plaid';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if Plaid is configured
    if (!isPlaidConfigured) {
      return NextResponse.json(
        { error: 'Plaid is not configured. Please add PLAID_CLIENT_ID and PLAID_SECRET to environment variables.' },
        { status: 503 }
      );
    }

    // Create link token
    const response = await plaidClient.linkTokenCreate({
      user: {
        client_user_id: session.user.id,
      },
      client_name: 'Life Navigator',
      products: PLAID_PRODUCTS as Products[],
      country_codes: PLAID_COUNTRY_CODES as CountryCode[],
      language: 'en',
      webhook: process.env.PLAID_WEBHOOK_URL,
      redirect_uri: process.env.PLAID_REDIRECT_URI,
    });

    const linkToken = response.data.link_token;

    return NextResponse.json({
      link_token: linkToken,
      expiration: response.data.expiration,
    });
  } catch (error: any) {
    console.error('Error creating Plaid link token:', error);

    // Handle Plaid-specific errors
    if (error.response?.data) {
      return NextResponse.json(
        {
          error: 'Failed to create link token',
          details: error.response.data,
        },
        { status: error.response.status || 500 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create link token' },
      { status: 500 }
    );
  }
}
