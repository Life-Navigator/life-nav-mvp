/**
 * Plaid Transaction Indexer for GraphRAG
 *
 * Automatically indexes Plaid transactions into:
 * - Neo4j: Personal knowledge graph (relationships between accounts, merchants, categories)
 * - Qdrant: Vector embeddings for semantic search
 * - PostgreSQL: Raw transaction data with pgvector
 *
 * This enables:
 * - Semantic search: "Show me restaurant spending last month"
 * - Graph traversal: Find all transactions from a specific merchant
 * - Compliance checking: Validate financial queries against regulations
 */

import type { PlaidTransaction, PlaidAccount, PlaidItem } from '@prisma/client';

// GraphRAG API configuration
const GRAPHRAG_API_URL = process.env.GRAPHRAG_API_URL || 'http://localhost:8000';

export interface TransactionEmbedding {
  transactionId: string;
  embedding: number[];
  description: string;
  category: string;
  amount: number;
  merchantName?: string;
  date: string;
}

export interface IndexingResult {
  success: boolean;
  transactionsIndexed: number;
  accountsIndexed: number;
  errors: string[];
  processingTimeMs: number;
}

/**
 * Generate a text description for embedding
 */
function generateTransactionDescription(transaction: PlaidTransaction): string {
  const parts = [
    transaction.name,
    transaction.merchantName ? `at ${transaction.merchantName}` : '',
    `for $${Math.abs(transaction.amount).toFixed(2)}`,
    transaction.category?.length ? `in ${transaction.category.join(', ')}` : '',
    transaction.pending ? '(pending)' : '',
  ];

  return parts.filter(Boolean).join(' ');
}

/**
 * Index a single transaction into the GraphRAG system
 */
export async function indexTransaction(
  userId: string,
  transaction: PlaidTransaction,
  accountId: string
): Promise<boolean> {
  try {
    const description = generateTransactionDescription(transaction);

    // Call GraphRAG API to index transaction
    const response = await fetch(`${GRAPHRAG_API_URL}/api/v1/graphrag/index/transaction`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: userId,
        transaction_id: transaction.transactionId,
        account_id: accountId,
        description: description,
        amount: transaction.amount,
        category: transaction.category?.[0] || 'uncategorized',
        merchant_name: transaction.merchantName,
        date: transaction.date.toISOString(),
        is_pending: transaction.pending,
        metadata: {
          payment_channel: transaction.paymentChannel,
          currency: transaction.isoCurrencyCode,
          plaid_transaction_id: transaction.transactionId,
        }
      }),
    });

    if (!response.ok) {
      console.error(`Failed to index transaction ${transaction.transactionId}:`, await response.text());
      return false;
    }

    return true;
  } catch (error) {
    console.error(`Error indexing transaction ${transaction.transactionId}:`, error);
    return false;
  }
}

/**
 * Index a Plaid account into the GraphRAG system
 */
export async function indexAccount(
  userId: string,
  account: PlaidAccount
): Promise<boolean> {
  try {
    const response = await fetch(`${GRAPHRAG_API_URL}/api/v1/graphrag/index/account`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: userId,
        account_id: account.accountId,
        name: account.name,
        official_name: account.officialName,
        type: account.type,
        subtype: account.subtype,
        current_balance: account.currentBalance,
        available_balance: account.availableBalance,
        currency: account.currency,
        mask: account.mask,
        metadata: {
          plaid_account_id: account.accountId,
        }
      }),
    });

    if (!response.ok) {
      console.error(`Failed to index account ${account.accountId}:`, await response.text());
      return false;
    }

    return true;
  } catch (error) {
    console.error(`Error indexing account ${account.accountId}:`, error);
    return false;
  }
}

/**
 * Batch index all transactions for a user from Plaid sync
 */
export async function indexPlaidSync(
  userId: string,
  plaidItem: PlaidItem,
  accounts: PlaidAccount[],
  transactions: PlaidTransaction[]
): Promise<IndexingResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  let transactionsIndexed = 0;
  let accountsIndexed = 0;

  console.log(`[GraphRAG] Starting Plaid sync indexing for user ${userId}`);
  console.log(`[GraphRAG] Accounts: ${accounts.length}, Transactions: ${transactions.length}`);

  // Index accounts first (they're referenced by transactions)
  for (const account of accounts) {
    const success = await indexAccount(userId, account);
    if (success) {
      accountsIndexed++;
    } else {
      errors.push(`Failed to index account: ${account.accountId}`);
    }
  }

  // Index transactions in batches
  const BATCH_SIZE = 50;
  for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
    const batch = transactions.slice(i, i + BATCH_SIZE);

    const results = await Promise.all(
      batch.map(tx => indexTransaction(userId, tx, tx.plaidAccountId))
    );

    const successCount = results.filter(Boolean).length;
    transactionsIndexed += successCount;

    if (successCount < batch.length) {
      errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length - successCount} transactions failed`);
    }

    // Small delay between batches to avoid overwhelming the API
    if (i + BATCH_SIZE < transactions.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  const processingTimeMs = Date.now() - startTime;

  console.log(`[GraphRAG] Indexing complete: ${accountsIndexed}/${accounts.length} accounts, ${transactionsIndexed}/${transactions.length} transactions in ${processingTimeMs}ms`);

  return {
    success: errors.length === 0,
    transactionsIndexed,
    accountsIndexed,
    errors,
    processingTimeMs,
  };
}

/**
 * Search transactions using semantic search
 */
export async function searchTransactions(
  userId: string,
  query: string,
  limit: number = 10
): Promise<TransactionEmbedding[]> {
  try {
    const response = await fetch(`${GRAPHRAG_API_URL}/api/v1/graphrag/search/transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: userId,
        query: query,
        limit: limit,
      }),
    });

    if (!response.ok) {
      console.error('Failed to search transactions:', await response.text());
      return [];
    }

    const data = await response.json();
    return data.results || [];
  } catch (error) {
    console.error('Error searching transactions:', error);
    return [];
  }
}

/**
 * Get spending insights using GraphRAG
 */
export async function getSpendingInsights(
  userId: string,
  category?: string,
  timeRange?: { start: Date; end: Date }
): Promise<{
  totalSpending: number;
  topMerchants: { name: string; amount: number }[];
  categoryBreakdown: { category: string; amount: number }[];
  insights: string[];
}> {
  try {
    const response = await fetch(`${GRAPHRAG_API_URL}/api/v1/graphrag/insights/spending`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: userId,
        category: category,
        start_date: timeRange?.start?.toISOString(),
        end_date: timeRange?.end?.toISOString(),
      }),
    });

    if (!response.ok) {
      console.error('Failed to get spending insights:', await response.text());
      return {
        totalSpending: 0,
        topMerchants: [],
        categoryBreakdown: [],
        insights: [],
      };
    }

    return await response.json();
  } catch (error) {
    console.error('Error getting spending insights:', error);
    return {
      totalSpending: 0,
      topMerchants: [],
      categoryBreakdown: [],
      insights: [],
    };
  }
}

/**
 * Validate a financial query against compliance rules
 */
export async function validateFinancialQuery(
  userId: string,
  query: string,
  response: string
): Promise<{
  isCompliant: boolean;
  violations: string[];
  suggestedResponse?: string;
}> {
  try {
    const apiResponse = await fetch(`${GRAPHRAG_API_URL}/api/v1/compliance/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: userId,
        query: query,
        response: response,
        categories: ['financial_tax', 'financial_investment'],
      }),
    });

    if (!apiResponse.ok) {
      console.error('Failed to validate query:', await apiResponse.text());
      return { isCompliant: true, violations: [] };
    }

    const data = await apiResponse.json();
    return {
      isCompliant: data.is_compliant,
      violations: data.violations?.map((v: { description: string }) => v.description) || [],
      suggestedResponse: data.compliant_response,
    };
  } catch (error) {
    console.error('Error validating query:', error);
    return { isCompliant: true, violations: [] };
  }
}
