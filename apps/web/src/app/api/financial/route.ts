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

    // Fetch financial data in parallel
    const [
      accounts,
      assets,
      transactions,
    ] = await Promise.all([
      // Financial accounts (banking, investment, credit)
      prisma.financialAccount.findMany({
        where: { userId, isActive: true },
        select: {
          id: true,
          name: true,
          type: true,
          balance: true,
          currency: true,
          institution: true,
        },
        orderBy: { name: 'asc' },
      }),
      // Assets
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
      // Transactions (limit based on timeframe)
      prisma.transaction.findMany({
        where: {
          userId,
          date: {
            gte: getDateForTimeframe(timeframe),
          },
        },
        select: {
          id: true,
          date: true,
          description: true,
          amount: true,
          category: true,
          type: true,
        },
        orderBy: { date: 'desc' },
        take: timeframe === 'week' ? 50 : timeframe === 'month' ? 200 : 1000,
      }),
    ]);

    // Transform accounts to match expected format
    const transformedAccounts = accounts.map(acc => ({
      id: acc.id,
      name: acc.name,
      type: mapAccountType(acc.type),
      balance: acc.balance || 0,
      institution: acc.institution || 'Unknown',
    }));

    // Process transactions for analytics
    const dailySpending = calculateDailySpending(transactions, timeframe);
    const categorySpending = calculateCategorySpending(transactions);
    const recentTransactions = transactions.slice(0, 10).map(tx => ({
      id: tx.id,
      date: tx.date.toISOString().split('T')[0],
      description: tx.description || 'Transaction',
      amount: tx.amount || 0,
      category: tx.category || 'Uncategorized',
    }));

    // Mock investment and crypto data (these would need additional tables)
    const investments = {
      portfolioPerformance: generateMockPerformance(30),
      assetAllocation: [
        { name: 'US Stocks', value: 45 },
        { name: 'International Stocks', value: 25 },
        { name: 'Bonds', value: 15 },
        { name: 'Cash', value: 10 },
        { name: 'Real Estate', value: 5 }
      ],
      holdings: [],
      totalValue: assets.reduce((sum, asset) => sum + (asset.currentValue || 0), 0),
      dayChange: 0,
      dayChangePercent: 0,
    };

    const cryptoAssets = []; // Would need CryptoAsset table

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

function mapAccountType(type: string): 'banking' | 'investment' | 'credit' {
  if (type === 'checking' || type === 'savings') return 'banking';
  if (type === 'investment') return 'investment';
  if (type === 'credit' || type === 'loan') return 'credit';
  return 'banking';
}

function calculateDailySpending(transactions: any[], timeframe: string) {
  const daysInPeriod = timeframe === 'week' ? 7 : timeframe === 'month' ? 30 : 365;
  const dailyMap = new Map();

  transactions.forEach(tx => {
    if (tx.type === 'debit' || tx.amount < 0) {
      const dateKey = tx.date.toISOString().split('T')[0];
      const current = dailyMap.get(dateKey) || 0;
      dailyMap.set(dateKey, current + Math.abs(tx.amount || 0));
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

  transactions.forEach(tx => {
    if (tx.type === 'debit' || tx.amount < 0) {
      const category = tx.category || 'Uncategorized';
      const current = categoryMap.get(category) || 0;
      categoryMap.set(category, current + Math.abs(tx.amount || 0));
    }
  });

  return Array.from(categoryMap.entries()).map(([category, amount]) => ({
    category,
    amount,
  }));
}

function generateMockPerformance(days: number) {
  const result = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    result.push({
      date: date.toISOString().split('T')[0],
      value: 130000 + Math.sin(i / 3) * 5000 + i * 200,
    });
  }
  return result;
}
