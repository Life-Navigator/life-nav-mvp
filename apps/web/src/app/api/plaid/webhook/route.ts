/**
 * Plaid Webhook Handler
 * Handles Plaid webhook events for transaction updates, item errors, etc.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db as prisma } from '@/lib/db';
import { plaidClient, isPlaidConfigured } from '@/lib/integrations/plaid-client';


// Plaid webhook types
type WebhookType =
  | 'TRANSACTIONS'
  | 'ITEM'
  | 'AUTH'
  | 'ASSETS'
  | 'INVESTMENTS_TRANSACTIONS'
  | 'HOLDINGS';

interface PlaidWebhookBody {
  webhook_type: WebhookType;
  webhook_code: string;
  item_id: string;
  error?: {
    error_type: string;
    error_code: string;
    error_message: string;
  };
  new_transactions?: number;
  removed_transactions?: string[];
}

export async function POST(request: NextRequest) {
  if (!isPlaidConfigured) {
    return NextResponse.json(
      { error: 'Plaid is not configured' },
      { status: 503 }
    );
  }

  try {
    const body: PlaidWebhookBody = await request.json();
    const { webhook_type, webhook_code, item_id, error } = body;

    console.log(`Plaid webhook received: ${webhook_type}/${webhook_code} for item ${item_id}`);

    // Find the Plaid item
    const plaidItem = await prisma.plaidItem.findFirst({
      where: { itemId: item_id },
    });

    if (!plaidItem) {
      console.warn(`Plaid item not found for webhook: ${item_id}`);
      return NextResponse.json({ received: true });
    }

    switch (webhook_type) {
      case 'TRANSACTIONS':
        await handleTransactionsWebhook(webhook_code, plaidItem, body);
        break;

      case 'ITEM':
        await handleItemWebhook(webhook_code, plaidItem, error);
        break;

      case 'AUTH':
        await handleAuthWebhook(webhook_code, plaidItem);
        break;

      default:
        console.log(`Unhandled webhook type: ${webhook_type}`);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error('Webhook processing error:', err);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

async function handleTransactionsWebhook(
  code: string,
  plaidItem: { id: string; accessToken: string; itemId: string },
  body: PlaidWebhookBody
) {
  switch (code) {
    case 'INITIAL_UPDATE':
    case 'HISTORICAL_UPDATE':
    case 'DEFAULT_UPDATE':
    case 'TRANSACTIONS_REMOVED':
      // Trigger a sync for transaction updates
      console.log(`Triggering sync for transactions update: ${code}`);

      if (code === 'TRANSACTIONS_REMOVED' && body.removed_transactions) {
        // Delete removed transactions
        await prisma.plaidTransaction.deleteMany({
          where: {
            plaidItemId: plaidItem.id,
            transactionId: { in: body.removed_transactions },
          },
        });
      }

      // Sync new transactions
      await syncTransactionsForItem(plaidItem);
      break;

    case 'SYNC_UPDATES_AVAILABLE':
      // New sync-based update available
      await syncTransactionsForItem(plaidItem);
      break;

    default:
      console.log(`Unhandled transactions webhook code: ${code}`);
  }
}

async function handleItemWebhook(
  code: string,
  plaidItem: { id: string; itemId: string },
  error?: { error_type: string; error_code: string; error_message: string }
) {
  switch (code) {
    case 'ERROR':
      // Item has an error - update status
      await prisma.plaidItem.update({
        where: { id: plaidItem.id },
        data: {
          status: 'error',
          error: error ? JSON.stringify(error) : 'Unknown error',
        },
      });
      console.error(`Plaid item error for ${plaidItem.itemId}:`, error);
      break;

    case 'PENDING_EXPIRATION':
      // Access token will expire soon
      await prisma.plaidItem.update({
        where: { id: plaidItem.id },
        data: { status: 'pending_expiration' },
      });
      break;

    case 'USER_PERMISSION_REVOKED':
      // User revoked access
      await prisma.plaidItem.update({
        where: { id: plaidItem.id },
        data: { status: 'revoked' },
      });
      break;

    case 'WEBHOOK_UPDATE_ACKNOWLEDGED':
      console.log('Webhook URL updated successfully');
      break;

    default:
      console.log(`Unhandled item webhook code: ${code}`);
  }
}

async function handleAuthWebhook(
  code: string,
  plaidItem: { id: string; itemId: string }
) {
  switch (code) {
    case 'AUTOMATICALLY_VERIFIED':
    case 'VERIFICATION_EXPIRED':
      console.log(`Auth webhook for ${plaidItem.itemId}: ${code}`);
      break;

    default:
      console.log(`Unhandled auth webhook code: ${code}`);
  }
}

async function syncTransactionsForItem(plaidItem: {
  id: string;
  accessToken: string;
}) {
  try {
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];

    const transactionsResponse = await plaidClient.transactionsGet({
      access_token: plaidItem.accessToken,
      start_date: startDate,
      end_date: endDate,
      options: { count: 500, offset: 0 },
    });

    // Get account mapping
    const accounts = await prisma.plaidAccount.findMany({
      where: { plaidItemId: plaidItem.id },
    });
    const accountMap = new Map(accounts.map((a) => [a.accountId, a.id]));

    // Upsert transactions
    for (const tx of transactionsResponse.data.transactions) {
      const plaidAccountId = accountMap.get(tx.account_id);
      if (!plaidAccountId) continue;

      await prisma.plaidTransaction.upsert({
        where: {
          plaidItemId_transactionId: {
            plaidItemId: plaidItem.id,
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
          updatedAt: new Date(),
        },
        create: {
          plaidItemId: plaidItem.id,
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
      where: { id: plaidItem.id },
      data: { lastSyncedAt: new Date() },
    });

    console.log(
      `Synced ${transactionsResponse.data.transactions.length} transactions for item ${plaidItem.id}`
    );
  } catch (error) {
    console.error('Error syncing transactions:', error);
  }
}
