/**
 * POST /api/plaid/exchange-token
 * Exchange a Plaid public token for an access token and store it
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromJWT } from '@/lib/jwt';
import { plaidClient, isPlaidConfigured } from '@/lib/integrations/plaid-client';
import { db } from '@/lib/db';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const exchangeTokenSchema = z.object({
  public_token: z.string().min(1, 'Public token is required'),
  institution_id: z.string().optional(),
  institution_name: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromJWT(request);

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if Plaid is configured
    if (!isPlaidConfigured) {
      return NextResponse.json(
        { error: 'Plaid is not configured' },
        { status: 503 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = exchangeTokenSchema.parse(body);

    // Exchange public token for access token
    const exchangeResponse = await plaidClient.itemPublicTokenExchange({
      public_token: validatedData.public_token,
    });

    const accessToken = exchangeResponse.data.access_token;
    const itemId = exchangeResponse.data.item_id;

    // Get item details (institution info)
    const itemResponse = await plaidClient.itemGet({
      access_token: accessToken,
    });

    const institutionId = itemResponse.data.item.institution_id || validatedData.institution_id || '';

    // Get institution name if we have the ID
    let institutionName = validatedData.institution_name || 'Unknown Institution';
    if (institutionId) {
      try {
        const institutionResponse = await plaidClient.institutionsGetById({
          institution_id: institutionId,
          country_codes: ['US'] as any,
        });
        institutionName = institutionResponse.data.institution.name;
      } catch (error) {
        console.warn('Failed to fetch institution name:', error);
      }
    }

    // Store the access token in database
    const plaidItem = await db.plaidItem.upsert({
      where: {
        userId_itemId: {
          userId,
          itemId: itemId,
        },
      },
      update: {
        accessToken: accessToken,
        institutionId: institutionId,
        institutionName: institutionName,
        status: 'active',
        lastSyncedAt: new Date(),
      },
      create: {
        userId,
        itemId: itemId,
        accessToken: accessToken,
        institutionId: institutionId,
        institutionName: institutionName,
        status: 'active',
        lastSyncedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      item_id: itemId,
      institution_name: institutionName,
      plaid_item_id: plaidItem.id,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error exchanging Plaid token:', error);

    // Handle Plaid-specific errors
    if (error.response?.data) {
      return NextResponse.json(
        {
          error: 'Failed to exchange token',
          details: error.response.data,
        },
        { status: error.response.status || 500 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to exchange token' },
      { status: 500 }
    );
  }
}
