/**
 * Plaid Items API
 * List and manage connected Plaid items (bank connections)
 */

import { NextRequest, NextResponse } from 'next/server';
import { db as prisma } from '@/lib/db';
import { plaidClient, isPlaidConfigured } from '@/lib/integrations/plaid-client';
import { verifyToken } from '@/lib/auth/jwt';


// GET /api/plaid/items - List all connected Plaid items for the user
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '') || request.cookies.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload?.userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Get all Plaid items with accounts
    const items = await prisma.plaidItem.findMany({
      where: { userId: payload.userId },
      include: {
        accounts: {
          select: {
            id: true,
            accountId: true,
            name: true,
            officialName: true,
            type: true,
            subtype: true,
            mask: true,
            currentBalance: true,
            availableBalance: true,
            currency: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Remove sensitive data
    const sanitizedItems = items.map((item) => ({
      id: item.id,
      itemId: item.itemId,
      institutionId: item.institutionId,
      institutionName: item.institutionName,
      status: item.status,
      lastSyncedAt: item.lastSyncedAt,
      error: item.error,
      accounts: item.accounts,
      createdAt: item.createdAt,
    }));

    return NextResponse.json({ items: sanitizedItems });
  } catch (error) {
    console.error('Error fetching Plaid items:', error);
    return NextResponse.json(
      { error: 'Failed to fetch connected accounts' },
      { status: 500 }
    );
  }
}

// DELETE /api/plaid/items - Disconnect a Plaid item
export async function DELETE(request: NextRequest) {
  if (!isPlaidConfigured) {
    return NextResponse.json(
      { error: 'Plaid is not configured' },
      { status: 503 }
    );
  }

  try {
    // Verify authentication
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '') || request.cookies.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload?.userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const itemId = searchParams.get('itemId');

    if (!itemId) {
      return NextResponse.json(
        { error: 'itemId is required' },
        { status: 400 }
      );
    }

    // Find the Plaid item
    const plaidItem = await prisma.plaidItem.findFirst({
      where: {
        id: itemId,
        userId: payload.userId,
      },
    });

    if (!plaidItem) {
      return NextResponse.json(
        { error: 'Plaid item not found' },
        { status: 404 }
      );
    }

    // Remove from Plaid
    try {
      await plaidClient.itemRemove({
        access_token: plaidItem.accessToken,
      });
    } catch (plaidError) {
      console.warn('Error removing item from Plaid (may already be removed):', plaidError);
    }

    // Delete from database (cascades to accounts and transactions)
    await prisma.plaidItem.delete({
      where: { id: itemId },
    });

    return NextResponse.json({
      success: true,
      message: 'Bank connection removed successfully',
    });
  } catch (error) {
    console.error('Error disconnecting Plaid item:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect bank' },
      { status: 500 }
    );
  }
}
