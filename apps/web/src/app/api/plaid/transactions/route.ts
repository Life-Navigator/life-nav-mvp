/**
 * Plaid Transactions API
 * Fetch transactions from connected Plaid accounts
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { verifyToken } from '@/lib/auth/jwt';

const prisma = new PrismaClient();

// GET /api/plaid/transactions - Get transactions for the user
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

    // Parse query params
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const accountId = searchParams.get('accountId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const category = searchParams.get('category');

    // Build where clause
    const whereClause: Record<string, unknown> = {
      plaidItem: {
        userId: payload.userId,
      },
    };

    if (accountId) {
      whereClause.plaidAccountId = accountId;
    }

    if (startDate || endDate) {
      whereClause.date = {};
      if (startDate) {
        (whereClause.date as Record<string, Date>).gte = new Date(startDate);
      }
      if (endDate) {
        (whereClause.date as Record<string, Date>).lte = new Date(endDate);
      }
    }

    if (category) {
      whereClause.category = { contains: category, mode: 'insensitive' };
    }

    // Fetch transactions
    const [transactions, total] = await Promise.all([
      prisma.plaidTransaction.findMany({
        where: whereClause,
        include: {
          plaidAccount: {
            select: {
              name: true,
              type: true,
              mask: true,
            },
          },
          plaidItem: {
            select: {
              institutionName: true,
            },
          },
        },
        orderBy: { date: 'desc' },
        take: Math.min(limit, 500),
        skip: offset,
      }),
      prisma.plaidTransaction.count({ where: whereClause }),
    ]);

    // Format response
    const formattedTransactions = transactions.map((tx) => ({
      id: tx.id,
      transactionId: tx.transactionId,
      accountName: tx.plaidAccount.name,
      accountType: tx.plaidAccount.type,
      accountMask: tx.plaidAccount.mask,
      institutionName: tx.plaidItem.institutionName,
      amount: tx.amount,
      date: tx.date,
      name: tx.name,
      merchantName: tx.merchantName,
      category: tx.category,
      pending: tx.pending,
      paymentChannel: tx.paymentChannel,
      transactionType: tx.transactionType,
      currency: tx.isoCurrencyCode,
    }));

    return NextResponse.json({
      transactions: formattedTransactions,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + transactions.length < total,
      },
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transactions' },
      { status: 500 }
    );
  }
}
