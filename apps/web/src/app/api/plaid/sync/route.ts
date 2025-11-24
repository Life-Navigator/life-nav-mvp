/**
 * Plaid Sync API
 * Syncs accounts and transactions for a Plaid item
 * Also indexes data into GraphRAG for semantic search
 */

import { NextRequest, NextResponse } from 'next/server';
import { plaidClient, isPlaidConfigured } from '@/lib/integrations/plaid-client';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { indexPlaidSync } from '@/lib/graphrag/plaid-indexer';

const prisma = new PrismaClient();

const syncSchema = z.object({
  itemId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  if (!isPlaidConfigured) {
    return NextResponse.json(
      { error: 'Plaid is not configured' },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const { itemId } = syncSchema.parse(body);

    // Get all Plaid items for sync (or specific one if itemId provided)
    const whereClause = itemId ? { itemId } : {};
    const plaidItems = await prisma.plaidItem.findMany({
      where: {
        ...whereClause,
        status: 'active',
      },
    });

    if (plaidItems.length === 0) {
      return NextResponse.json(
        { error: 'No active Plaid items found' },
        { status: 404 }
      );
    }

    const results = [];

    for (const item of plaidItems) {
      try {
        // Sync accounts
        const accountsResponse = await plaidClient.accountsGet({
          access_token: item.accessToken,
        });

        // Upsert accounts
        for (const account of accountsResponse.data.accounts) {
          await prisma.plaidAccount.upsert({
            where: {
              plaidItemId_accountId: {
                plaidItemId: item.id,
                accountId: account.account_id,
              },
            },
            update: {
              name: account.name,
              officialName: account.official_name,
              type: account.type,
              subtype: account.subtype || null,
              currentBalance: account.balances.current,
              availableBalance: account.balances.available,
              limit: account.balances.limit,
              currency: account.balances.iso_currency_code || 'USD',
              updatedAt: new Date(),
            },
            create: {
              plaidItemId: item.id,
              accountId: account.account_id,
              name: account.name,
              officialName: account.official_name,
              type: account.type,
              subtype: account.subtype || null,
              mask: account.mask,
              currentBalance: account.balances.current,
              availableBalance: account.balances.available,
              limit: account.balances.limit,
              currency: account.balances.iso_currency_code || 'USD',
            },
          });
        }

        // Sync transactions (last 30 days)
        const endDate = new Date().toISOString().split('T')[0];
        const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0];

        const transactionsResponse = await plaidClient.transactionsGet({
          access_token: item.accessToken,
          start_date: startDate,
          end_date: endDate,
          options: {
            count: 500,
            offset: 0,
          },
        });

        // Get account mapping
        const accounts = await prisma.plaidAccount.findMany({
          where: { plaidItemId: item.id },
        });
        const accountMap = new Map(accounts.map((a) => [a.accountId, a.id]));

        // Upsert transactions
        for (const tx of transactionsResponse.data.transactions) {
          const plaidAccountId = accountMap.get(tx.account_id);
          if (!plaidAccountId) continue;

          await prisma.plaidTransaction.upsert({
            where: {
              plaidItemId_transactionId: {
                plaidItemId: item.id,
                transactionId: tx.transaction_id,
              },
            },
            update: {
              amount: tx.amount,
              date: new Date(tx.date),
              name: tx.name,
              merchantName: tx.merchant_name,
              category: tx.category?.join(', '),
              pending: tx.pending,
              paymentChannel: tx.payment_channel,
              transactionType: tx.transaction_type || null,
              updatedAt: new Date(),
            },
            create: {
              plaidItemId: item.id,
              plaidAccountId,
              transactionId: tx.transaction_id,
              amount: tx.amount,
              date: new Date(tx.date),
              name: tx.name,
              merchantName: tx.merchant_name,
              category: tx.category?.join(', '),
              pending: tx.pending,
              paymentChannel: tx.payment_channel,
              transactionType: tx.transaction_type || null,
              isoCurrencyCode: tx.iso_currency_code,
            },
          });
        }

        // Update last synced timestamp
        await prisma.plaidItem.update({
          where: { id: item.id },
          data: { lastSyncedAt: new Date() },
        });

        // Index into GraphRAG for semantic search (async, don't block sync)
        const plaidAccounts = await prisma.plaidAccount.findMany({
          where: { plaidItemId: item.id },
        });
        const plaidTransactions = await prisma.plaidTransaction.findMany({
          where: { plaidItemId: item.id },
        });

        // Fire and forget - index in background
        indexPlaidSync(item.userId, item, plaidAccounts, plaidTransactions)
          .then((indexResult) => {
            console.log(`[GraphRAG] Indexed ${indexResult.transactionsIndexed} transactions for item ${item.itemId}`);
          })
          .catch((err) => {
            console.error(`[GraphRAG] Failed to index item ${item.itemId}:`, err);
          });

        results.push({
          itemId: item.itemId,
          institutionName: item.institutionName,
          accountsCount: accountsResponse.data.accounts.length,
          transactionsCount: transactionsResponse.data.transactions.length,
          success: true,
        });
      } catch (error) {
        console.error(`Error syncing item ${item.itemId}:`, error);
        results.push({
          itemId: item.itemId,
          institutionName: item.institutionName,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json(
      { error: 'Failed to sync Plaid data' },
      { status: 500 }
    );
  }
}
