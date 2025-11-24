import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth/jwt';
import { db as prisma } from '@/lib/db';

// GET - Fetch all holdings for user
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '') || request.cookies.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload?.userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const holdings = await prisma.investmentHolding.findMany({
      where: { userId: payload.userId },
      orderBy: { marketValue: 'desc' },
    });

    return NextResponse.json({ holdings });
  } catch (error) {
    console.error('Error fetching holdings:', error);
    return NextResponse.json({ error: 'Failed to fetch holdings' }, { status: 500 });
  }
}

// POST - Create a new holding
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '') || request.cookies.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload?.userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body = await request.json();
    const { ticker, name, shares, costBasis, currentPrice, sector, assetType, accountName, accountType, region, purchaseDate } = body;

    // Validate required fields
    if (!ticker || !name || shares === undefined || costBasis === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: ticker, name, shares, costBasis' },
        { status: 400 }
      );
    }

    // Calculate derived fields
    const price = currentPrice || costBasis;
    const marketValue = shares * price;
    const totalCost = shares * costBasis;
    const unrealizedGain = marketValue - totalCost;
    const unrealizedGainPct = totalCost > 0 ? unrealizedGain / totalCost : 0;

    // Check for existing holding with same ticker in same account
    const existingHolding = await prisma.investmentHolding.findFirst({
      where: {
        userId: payload.userId,
        ticker: ticker.toUpperCase(),
        accountName: accountName || null,
      },
    });

    if (existingHolding) {
      // Update existing holding - average cost basis
      const newTotalShares = existingHolding.shares + shares;
      const newTotalCost = (existingHolding.shares * existingHolding.costBasis) + (shares * costBasis);
      const newAvgCostBasis = newTotalCost / newTotalShares;
      const newMarketValue = newTotalShares * price;
      const newUnrealizedGain = newMarketValue - (newTotalShares * newAvgCostBasis);
      const newUnrealizedGainPct = (newTotalShares * newAvgCostBasis) > 0
        ? newUnrealizedGain / (newTotalShares * newAvgCostBasis)
        : 0;

      const updatedHolding = await prisma.investmentHolding.update({
        where: { id: existingHolding.id },
        data: {
          shares: newTotalShares,
          costBasis: newAvgCostBasis,
          currentPrice: price,
          marketValue: newMarketValue,
          unrealizedGain: newUnrealizedGain,
          unrealizedGainPct: newUnrealizedGainPct,
        },
      });

      return NextResponse.json({
        holding: updatedHolding,
        message: 'Added to existing holding'
      });
    }

    // Create new holding
    const holding = await prisma.investmentHolding.create({
      data: {
        userId: payload.userId,
        ticker: ticker.toUpperCase(),
        name,
        assetType: assetType || 'stock',
        shares,
        costBasis,
        currentPrice: price,
        marketValue,
        unrealizedGain,
        unrealizedGainPct,
        sector: sector || null,
        region: region || 'US',
        accountName: accountName || null,
        accountType: accountType || 'taxable',
        purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
        source: 'manual',
      },
    });

    return NextResponse.json({ holding }, { status: 201 });
  } catch (error) {
    console.error('Error creating holding:', error);
    return NextResponse.json({ error: 'Failed to create holding' }, { status: 500 });
  }
}

// PUT - Update an existing holding
export async function PUT(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '') || request.cookies.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload?.userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body = await request.json();
    const { id, shares, costBasis, currentPrice, sector, accountName, accountType } = body;

    if (!id) {
      return NextResponse.json({ error: 'Missing holding id' }, { status: 400 });
    }

    // Verify ownership
    const existingHolding = await prisma.investmentHolding.findFirst({
      where: { id, userId: payload.userId },
    });

    if (!existingHolding) {
      return NextResponse.json({ error: 'Holding not found' }, { status: 404 });
    }

    // Calculate derived fields
    const newShares = shares ?? existingHolding.shares;
    const newCostBasis = costBasis ?? existingHolding.costBasis;
    const price = currentPrice ?? existingHolding.currentPrice;
    const marketValue = newShares * price;
    const totalCost = newShares * newCostBasis;
    const unrealizedGain = marketValue - totalCost;
    const unrealizedGainPct = totalCost > 0 ? unrealizedGain / totalCost : 0;

    const holding = await prisma.investmentHolding.update({
      where: { id },
      data: {
        shares: newShares,
        costBasis: newCostBasis,
        currentPrice: price,
        marketValue,
        unrealizedGain,
        unrealizedGainPct,
        sector: sector !== undefined ? sector : existingHolding.sector,
        accountName: accountName !== undefined ? accountName : existingHolding.accountName,
        accountType: accountType !== undefined ? accountType : existingHolding.accountType,
      },
    });

    return NextResponse.json({ holding });
  } catch (error) {
    console.error('Error updating holding:', error);
    return NextResponse.json({ error: 'Failed to update holding' }, { status: 500 });
  }
}

// DELETE - Delete a holding
export async function DELETE(request: NextRequest) {
  try {
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
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing holding id' }, { status: 400 });
    }

    // Verify ownership
    const existingHolding = await prisma.investmentHolding.findFirst({
      where: { id, userId: payload.userId },
    });

    if (!existingHolding) {
      return NextResponse.json({ error: 'Holding not found' }, { status: 404 });
    }

    await prisma.investmentHolding.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting holding:', error);
    return NextResponse.json({ error: 'Failed to delete holding' }, { status: 500 });
  }
}
