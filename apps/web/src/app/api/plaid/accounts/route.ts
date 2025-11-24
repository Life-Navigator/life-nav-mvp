/**
 * Plaid Accounts API
 * Returns all Plaid-linked accounts for the authenticated user
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import { db } from '@/lib/db';

interface JWTPayload {
  sub: string;
  email?: string;
  exp: number;
}

async function getAuthenticatedUserId(request: NextRequest): Promise<string | null> {
  // Try to get token from cookies first
  const cookieStore = await cookies();
  let token = cookieStore.get('access_token')?.value || null;

  // If not in cookies, try Authorization header
  if (!token) {
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
  }

  if (!token) {
    return null;
  }

  // Verify token
  const secret = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    console.error('JWT_SECRET not configured');
    return null;
  }

  try {
    const decoded = jwt.verify(token, secret) as JWTPayload;
    return decoded.sub;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const userId = await getAuthenticatedUserId(request);

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get all Plaid items for the user
    const plaidItems = await db.plaidItem.findMany({
      where: {
        userId,
        status: 'active',
      },
      include: {
        accounts: true,
      },
    });

    // Transform accounts for the frontend
    const accounts = plaidItems.flatMap((item) =>
      item.accounts.map((account) => ({
        id: account.id,
        accountId: account.accountId,
        name: account.name,
        officialName: account.officialName,
        type: account.type,
        subtype: account.subtype,
        mask: account.mask,
        currentBalance: account.currentBalance,
        availableBalance: account.availableBalance,
        limit: account.limit,
        currency: account.currency,
        institution: item.institutionName,
        institutionId: item.institutionId,
        itemId: item.itemId,
        lastSynced: item.lastSyncedAt,
        updatedAt: account.updatedAt,
      }))
    );

    // Calculate summary
    const summary = {
      totalAssets: accounts
        .filter((a) => ['depository', 'investment'].includes(a.type))
        .reduce((sum, a) => sum + (a.currentBalance || 0), 0),
      totalLiabilities: accounts
        .filter((a) => ['credit', 'loan'].includes(a.type))
        .reduce((sum, a) => sum + Math.abs(a.currentBalance || 0), 0),
      totalAccounts: accounts.length,
      institutions: [...new Set(plaidItems.map((i) => i.institutionName))],
    };

    return NextResponse.json({
      accounts,
      summary,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching Plaid accounts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch accounts' },
      { status: 500 }
    );
  }
}
