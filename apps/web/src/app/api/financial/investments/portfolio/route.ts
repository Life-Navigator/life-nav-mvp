import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromJWT } from '@/lib/jwt';
import { db as prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromJWT(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch investment assets from database
    const investmentAssets = await prisma.asset.findMany({
      where: {
        userId,
        type: { in: ['stock', 'bond', 'etf', 'mutual_fund', 'investment', 'crypto', 'cryptocurrency'] },
      },
    });

    const totalValue = investmentAssets.reduce((sum, asset) => sum + (asset.currentValue || 0), 0);

    // Calculate asset allocation
    const assetAllocation = Object.entries(
      investmentAssets.reduce((acc, asset) => {
        const type = asset.type || 'Other';
        acc[type] = (acc[type] || 0) + (asset.currentValue || 0);
        return acc;
      }, {} as Record<string, number>)
    ).map(([name, value]) => ({
      name,
      value,
      percentage: totalValue > 0 ? (value / totalValue) * 100 : 0,
    }));

    // Return empty portfolio structure when no data
    const portfolio = {
      totalValue,
      holdings: investmentAssets.map(asset => ({
        id: asset.id,
        symbol: asset.name?.substring(0, 5).toUpperCase() || 'N/A',
        name: asset.name || 'Unknown',
        quantity: 0, // Would need quantity field in Asset table
        currentPrice: asset.currentValue || 0,
        totalValue: asset.currentValue || 0,
        costBasis: 0,
        unrealizedGain: 0,
        unrealizedGainPercent: 0,
        allocation: totalValue > 0 ? ((asset.currentValue || 0) / totalValue) * 100 : 0,
        type: asset.type || 'investment',
      })),
      assetAllocation,
      risk: 'Moderate',
      riskMetrics: {
        beta: 1.0,
        sharpeRatio: 0,
        standardDeviation: 0,
        maxDrawdown: 0,
        volatility: 0,
      },
      hasData: investmentAssets.length > 0,
    };

    return NextResponse.json(portfolio);
  } catch (error) {
    console.error('Error fetching investment portfolio:', error);
    return NextResponse.json(
      { error: 'Failed to fetch investment portfolio' },
      { status: 500 }
    );
  }
}
