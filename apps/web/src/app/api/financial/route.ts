import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromJWT } from '@/lib/jwt';
import { db as prisma } from '@/lib/db';

// Force dynamic rendering - this route depends on user session and database
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromJWT(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const timeframe = searchParams.get('timeframe') || 'month'; // week, month, year

    // Demo mode - return empty data without database queries
    if (userId === 'demo-user-id') {
      const response = {
        accounts: [],
        assets: [],
        transactions: [],
        summary: {
          totalBalance: 0,
          checking: 0,
          savings: 0,
          investments: 0,
          totalAssets: 0,
          netWorth: 0,
        },
        spending: {
          total: 0,
          byCategory: [],
        },
        hasData: false,
      };
      return NextResponse.json(response);
    }

    // Fetch financial data in parallel from Plaid (source of truth)
    const [
      plaidItems,
      assets,
      plaidTransactions,
    ] = await Promise.all([
      // Plaid-connected accounts (banking, investment, credit)
      prisma.plaidItem.findMany({
        where: { userId, status: 'active' },
        include: {
          accounts: true,
        },
      }),
      // Manual assets (real estate, vehicles, etc.)
      prisma.asset.findMany({
        where: { userId },
        select: {
          id: true,
          name: true,
          type: true,
          currentValue: true,
          currency: true,
        },
        orderBy: { name: 'asc' },
      }),
      // Plaid transactions (limit based on timeframe)
      prisma.plaidTransaction.findMany({
        where: {
          plaidAccount: {
            plaidItem: {
              userId,
              status: 'active',
            },
          },
          date: {
            gte: getDateForTimeframe(timeframe),
          },
        },
        select: {
          id: true,
          date: true,
          name: true,
          merchantName: true,
          amount: true,
          category: true,
          pending: true,
        },
        orderBy: { date: 'desc' },
        take: timeframe === 'week' ? 50 : timeframe === 'month' ? 200 : 1000,
      }),
    ]);

    // Extract all Plaid accounts from items
    const plaidAccounts = plaidItems.flatMap(item => item.accounts);

    // Transform Plaid accounts to match expected format
    const transformedAccounts = plaidAccounts.map(acc => ({
      id: acc.id,
      name: acc.name,
      type: mapPlaidAccountType(acc.type, acc.subtype),
      balance: acc.currentBalance || 0,
      institution: plaidItems.find(item =>
        item.accounts.some(a => a.id === acc.id)
      )?.institutionName || 'Unknown',
    }));

    // Process Plaid transactions for analytics
    const dailySpending = calculateDailySpending(plaidTransactions, timeframe);
    const categorySpending = calculateCategorySpending(plaidTransactions);
    const recentTransactions = plaidTransactions.slice(0, 10).map(tx => ({
      id: tx.id,
      date: tx.date.toISOString().split('T')[0],
      description: tx.merchantName || tx.name || 'Transaction',
      amount: tx.amount || 0,
      category: Array.isArray(tx.category) ? tx.category[0] : tx.category || 'Uncategorized',
    }));

    // Investment data from Plaid investment accounts + manual assets
    const plaidInvestmentAccounts = plaidAccounts.filter(acc =>
      ['investment', 'brokerage'].includes(acc.type)
    );
    const manualInvestmentAssets = assets.filter(a =>
      a.type === 'stock' || a.type === 'bond' || a.type === 'etf' || a.type === 'mutual_fund' || a.type === 'investment'
    );
    const cryptoAssetsData = assets.filter(a => a.type === 'crypto' || a.type === 'cryptocurrency');

    // Calculate asset allocation from Plaid + manual assets
    const allocationMap: Record<string, number> = {};

    // Add Plaid investment accounts
    plaidInvestmentAccounts.forEach(acc => {
      const type = acc.subtype || 'Investment';
      allocationMap[type] = (allocationMap[type] || 0) + (acc.currentBalance || 0);
    });

    // Add manual investment assets
    manualInvestmentAssets.forEach(asset => {
      const type = asset.type || 'Other';
      allocationMap[type] = (allocationMap[type] || 0) + (asset.currentValue || 0);
    });

    const assetAllocation = Object.entries(allocationMap).map(([name, value]) => ({ name, value }));

    // Combine Plaid investment accounts and manual investment assets as holdings
    const plaidHoldings = plaidInvestmentAccounts.map(acc => ({
      symbol: acc.name?.substring(0, 5).toUpperCase() || 'N/A',
      name: acc.name || 'Unknown',
      shares: 0, // Plaid can provide this with holdings endpoint
      price: acc.currentBalance || 0,
      value: acc.currentBalance || 0,
    }));

    const manualHoldings = manualInvestmentAssets.map(asset => ({
      symbol: asset.name?.substring(0, 5).toUpperCase() || 'N/A',
      name: asset.name || 'Unknown',
      shares: 0, // Would need shares field in Asset table
      price: asset.currentValue || 0,
      value: asset.currentValue || 0,
    }));

    const totalPlaidInvestments = plaidInvestmentAccounts.reduce((sum, acc) => sum + (acc.currentBalance || 0), 0);
    const totalManualInvestments = manualInvestmentAssets.reduce((sum, asset) => sum + (asset.currentValue || 0), 0);

    const investments = {
      portfolioPerformance: [], // Would need PortfolioHistory table to track over time
      assetAllocation: assetAllocation.length > 0 ? assetAllocation : [],
      holdings: [...plaidHoldings, ...manualHoldings],
      totalValue: totalPlaidInvestments + totalManualInvestments,
      dayChange: 0, // Would need price history to calculate
      dayChangePercent: 0,
    };

    const cryptoAssets = cryptoAssetsData.map(asset => ({
      symbol: asset.name?.substring(0, 5).toUpperCase() || 'N/A',
      name: asset.name || 'Unknown',
      quantity: 0, // Would need quantity field
      price: asset.currentValue || 0,
      value: asset.currentValue || 0,
      change24h: 0, // Would need price history
    }));

    return NextResponse.json({
      accounts: transformedAccounts || [],
      transactions: {
        dailySpending: dailySpending || [],
        categorySpending: categorySpending || [],
        recentTransactions: recentTransactions || [],
      },
      investments: investments || {
        portfolioPerformance: [],
        assetAllocation: [],
        holdings: [],
        totalValue: 0,
        dayChange: 0,
        dayChangePercent: 0,
      },
      cryptoAssets: cryptoAssets || [],
    });
  } catch (error) {
    console.error('Error fetching financial data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch financial data' },
      { status: 500 }
    );
  }
}

// Helper functions
function getDateForTimeframe(timeframe: string): Date {
  const now = new Date();
  switch (timeframe) {
    case 'week':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case 'month':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case 'year':
      return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    default:
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }
}

function mapPlaidAccountType(type: string, subtype: string | null): 'banking' | 'investment' | 'credit' {
  // Plaid account types: depository, investment, credit, loan, brokerage, other
  if (type === 'depository') return 'banking';
  if (type === 'investment' || type === 'brokerage') return 'investment';
  if (type === 'credit' || type === 'loan') return 'credit';
  return 'banking';
}

function calculateDailySpending(transactions: any[], timeframe: string) {
  const daysInPeriod = timeframe === 'week' ? 7 : timeframe === 'month' ? 30 : 365;
  const dailyMap = new Map();

  // Plaid transactions: positive amounts = expenses (debit), negative = income (credit)
  transactions.forEach(tx => {
    if (tx.amount > 0) { // Plaid: positive = expense
      const dateKey = tx.date.toISOString().split('T')[0];
      const current = dailyMap.get(dateKey) || 0;
      dailyMap.set(dateKey, current + (tx.amount || 0));
    }
  });

  // Generate array for all days in period
  const result = [];
  for (let i = daysInPeriod - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateKey = date.toISOString().split('T')[0];
    result.push({
      date: dateKey,
      amount: dailyMap.get(dateKey) || 0,
      category: 'All',
    });
  }

  return result;
}

function calculateCategorySpending(transactions: any[]) {
  const categoryMap = new Map();

  // Plaid transactions: positive amounts = expenses, category is array or string
  transactions.forEach(tx => {
    if (tx.amount > 0) { // Plaid: positive = expense
      const category = Array.isArray(tx.category) ? tx.category[0] : tx.category || 'Uncategorized';
      const current = categoryMap.get(category) || 0;
      categoryMap.set(category, current + (tx.amount || 0));
    }
  });

  return Array.from(categoryMap.entries()).map(([category, amount]) => ({
    category,
    amount,
  }));
}

