/**
 * GET /api/plaid/investments
 * Fetch investment holdings from connected Plaid accounts
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromJWT } from '@/lib/jwt';
import { plaidClient, isPlaidConfigured } from '@/lib/integrations/plaid-client';
import { db as prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
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
        { error: 'Plaid is not configured. Please add PLAID_CLIENT_ID and PLAID_SECRET to environment variables.' },
        { status: 503 }
      );
    }

    // Get all connected Plaid items for this user
    const plaidItems = await prisma.plaidItem.findMany({
      where: { userId },
      select: { accessToken: true, institutionId: true, institutionName: true },
    });

    if (!plaidItems.length) {
      return NextResponse.json({
        holdings: [],
        accounts: [],
        message: 'No connected brokerage accounts found'
      });
    }

    const allHoldings: any[] = [];
    const allAccounts: any[] = [];
    const securities: Record<string, any> = {};

    // Fetch investments from each connected institution
    for (const item of plaidItems) {
      try {
        const investmentsResponse = await plaidClient.investmentsHoldingsGet({
          access_token: item.accessToken,
        });

        const { holdings, accounts, securities: itemSecurities } = investmentsResponse.data;

        // Index securities by security_id for easy lookup
        for (const security of itemSecurities) {
          securities[security.security_id] = {
            name: security.name,
            ticker: security.ticker_symbol,
            type: security.type,
            closePrice: security.close_price,
            closePriceAsOf: security.close_price_as_of,
            isCashEquivalent: security.is_cash_equivalent,
            sedol: security.sedol,
            isin: security.isin,
            cusip: security.cusip,
          };
        }

        // Add accounts with institution info
        for (const account of accounts) {
          if (account.type === 'investment' || account.type === 'brokerage' || account.subtype === 'ira' || account.subtype === '401k' || account.subtype === 'roth') {
            allAccounts.push({
              accountId: account.account_id,
              name: account.name,
              officialName: account.official_name,
              type: account.type,
              subtype: account.subtype,
              mask: account.mask,
              currentBalance: account.balances.current,
              availableBalance: account.balances.available,
              currency: account.balances.iso_currency_code,
              institutionId: item.institutionId,
              institutionName: item.institutionName,
            });
          }
        }

        // Add holdings with security info
        for (const holding of holdings) {
          const security = securities[holding.security_id];
          if (security && !security.isCashEquivalent) {
            allHoldings.push({
              accountId: holding.account_id,
              securityId: holding.security_id,
              ticker: security.ticker || 'N/A',
              name: security.name || 'Unknown Security',
              type: security.type,
              quantity: holding.quantity,
              costBasis: holding.cost_basis,
              currentPrice: security.closePrice,
              marketValue: holding.institution_value,
              priceAsOf: security.closePriceAsOf,
              institutionId: item.institutionId,
              institutionName: item.institutionName,
            });
          }
        }
      } catch (error: any) {
        console.error(`Error fetching investments for institution ${item.institutionName}:`, error.response?.data || error.message);
        // Continue with other items even if one fails
      }
    }

    return NextResponse.json({
      holdings: allHoldings,
      accounts: allAccounts,
      totalValue: allHoldings.reduce((sum, h) => sum + (h.marketValue || 0), 0),
    });
  } catch (error: any) {
    console.error('Error fetching Plaid investments:', error);

    if (error.response?.data) {
      return NextResponse.json(
        {
          error: 'Failed to fetch investments',
          details: error.response.data,
        },
        { status: error.response.status || 500 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to fetch investments' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/plaid/investments/sync
 * Sync Plaid investment holdings to our database
 */
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

    // Get all connected Plaid items for this user
    const plaidItems = await prisma.plaidItem.findMany({
      where: { userId },
      select: { accessToken: true, institutionId: true, institutionName: true },
    });

    if (!plaidItems.length) {
      return NextResponse.json({
        synced: 0,
        message: 'No connected brokerage accounts found'
      });
    }

    let syncedCount = 0;
    const errors: string[] = [];

    // Fetch and sync investments from each connected institution
    for (const item of plaidItems) {
      try {
        const investmentsResponse = await plaidClient.investmentsHoldingsGet({
          access_token: item.accessToken,
        });

        const { holdings, accounts, securities } = investmentsResponse.data;

        // Index securities by security_id
        const securityMap: Record<string, any> = {};
        for (const security of securities) {
          securityMap[security.security_id] = security;
        }

        // Index accounts by account_id
        const accountMap: Record<string, any> = {};
        for (const account of accounts) {
          accountMap[account.account_id] = account;
        }

        // Sync each holding to our database
        for (const holding of holdings) {
          const security = securityMap[holding.security_id];
          const account = accountMap[holding.account_id];

          // Skip cash equivalents
          if (security?.is_cash_equivalent) continue;

          const ticker = security?.ticker_symbol?.toUpperCase() || 'UNKNOWN';
          const costBasis = holding.cost_basis
            ? holding.cost_basis / holding.quantity
            : security?.close_price || 0;

          // Upsert the holding
          await prisma.investmentHolding.upsert({
            where: {
              userId_ticker_accountId: {
                userId,
                ticker,
                accountId: holding.account_id,
              },
            },
            update: {
              shares: holding.quantity,
              currentPrice: security?.close_price || 0,
              marketValue: holding.institution_value || holding.quantity * (security?.close_price || 0),
              unrealizedGain: (holding.institution_value || 0) - (holding.cost_basis || 0),
              unrealizedGainPct: holding.cost_basis && holding.cost_basis > 0
                ? ((holding.institution_value || 0) - holding.cost_basis) / holding.cost_basis
                : 0,
              lastPriceUpdate: new Date(),
              accountName: account?.name || item.institutionName,
              accountType: mapAccountType(account?.subtype),
            },
            create: {
              userId,
              ticker,
              name: security?.name || 'Unknown Security',
              assetType: mapSecurityType(security?.type),
              shares: holding.quantity,
              costBasis,
              currentPrice: security?.close_price || 0,
              marketValue: holding.institution_value || holding.quantity * (security?.close_price || 0),
              unrealizedGain: (holding.institution_value || 0) - (holding.cost_basis || 0),
              unrealizedGainPct: holding.cost_basis && holding.cost_basis > 0
                ? ((holding.institution_value || 0) - holding.cost_basis) / holding.cost_basis
                : 0,
              accountId: holding.account_id,
              accountName: account?.name || item.institutionName,
              accountType: mapAccountType(account?.subtype),
              source: 'plaid',
              plaidSecurityId: holding.security_id,
            },
          });

          syncedCount++;
        }
      } catch (error: any) {
        const errorMsg = `Failed to sync investments from ${item.institutionName}: ${error.message}`;
        console.error(errorMsg);
        errors.push(errorMsg);
      }
    }

    return NextResponse.json({
      synced: syncedCount,
      errors: errors.length > 0 ? errors : undefined,
      message: `Successfully synced ${syncedCount} holdings`,
    });
  } catch (error: any) {
    console.error('Error syncing Plaid investments:', error);
    return NextResponse.json(
      { error: 'Failed to sync investments' },
      { status: 500 }
    );
  }
}

// Helper functions for mapping Plaid types to our schema
function mapSecurityType(plaidType: string | undefined): string {
  const typeMap: Record<string, string> = {
    equity: 'stock',
    etf: 'etf',
    mutual_fund: 'mutual_fund',
    fixed_income: 'bond',
    cryptocurrency: 'crypto',
    derivative: 'option',
    cash: 'cash',
  };
  return typeMap[plaidType || ''] || 'stock';
}

function mapAccountType(plaidSubtype: string | undefined): string {
  const typeMap: Record<string, string> = {
    '401a': '401k',
    '401k': '401k',
    '403B': '403b',
    '457b': '457b',
    brokerage: 'taxable',
    ira: 'traditional_ira',
    roth: 'roth_ira',
    roth_401k: 'roth_401k',
    hsa: 'hsa',
    education_savings_account: '529',
    ugma: 'taxable',
    utma: 'taxable',
  };
  return typeMap[plaidSubtype || ''] || 'taxable';
}
