import { NextRequest, NextResponse } from 'next/server';
import { db as prisma } from '@/lib/db';
import { getUserIdFromJWT } from '@/lib/jwt';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// GET - Fetch wearable metrics with filtering
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromJWT(request);

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const metricType = searchParams.get('type');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const connectionId = searchParams.get('connectionId');
    const limit = parseInt(searchParams.get('limit') || '100');

    const where: any = { userId };

    if (metricType) {
      where.metricType = metricType;
    }

    if (connectionId) {
      where.connectionId = connectionId;
    }

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = new Date(startDate);
      if (endDate) where.timestamp.lte = new Date(endDate);
    }

    const metrics = await prisma.wearableMetric.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: limit,
      select: {
        id: true,
        metricType: true,
        value: true,
        unit: true,
        timestamp: true,
        startTime: true,
        endTime: true,
        metadata: true,
        source: true,
        confidence: true,
      },
    });

    // Calculate aggregates for common metrics
    const aggregates: any = {};

    if (metrics.length > 0) {
      const types = [...new Set(metrics.map(m => m.metricType))];

      for (const type of types) {
        const typeMetrics = metrics.filter(m => m.metricType === type);
        const values = typeMetrics.map(m => m.value);

        aggregates[type] = {
          count: values.length,
          sum: values.reduce((a, b) => a + b, 0),
          avg: values.reduce((a, b) => a + b, 0) / values.length,
          min: Math.min(...values),
          max: Math.max(...values),
          latest: typeMetrics[0].value,
          latestTimestamp: typeMetrics[0].timestamp,
        };
      }
    }

    return NextResponse.json({
      metrics,
      aggregates,
      count: metrics.length,
    });
  } catch (error) {
    console.error('Error fetching wearable metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch wearable metrics' },
      { status: 500 }
    );
  }
}

// POST - Manually add a wearable metric (for testing or manual entry)
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromJWT(request);

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      connectionId,
      metricType,
      value,
      unit,
      timestamp,
      startTime,
      endTime,
      metadata,
      source,
    } = body;

    if (!metricType || value === undefined || !unit) {
      return NextResponse.json(
        { error: 'metricType, value, and unit are required' },
        { status: 400 }
      );
    }

    // If connectionId provided, verify ownership
    if (connectionId) {
      const connection = await prisma.wearableConnection.findFirst({
        where: {
          id: connectionId,
          userId,
        },
      });

      if (!connection) {
        return NextResponse.json(
          { error: 'Connection not found' },
          { status: 404 }
        );
      }
    }

    const metric = await prisma.wearableMetric.create({
      data: {
        userId,
        connectionId: connectionId || null,
        metricType,
        value: parseFloat(value),
        unit,
        timestamp: timestamp ? new Date(timestamp) : new Date(),
        startTime: startTime ? new Date(startTime) : null,
        endTime: endTime ? new Date(endTime) : null,
        metadata,
        source: source || 'manual',
        isManualEntry: !connectionId,
      },
    });

    return NextResponse.json({ metric }, { status: 201 });
  } catch (error) {
    console.error('Error creating wearable metric:', error);
    return NextResponse.json(
      { error: 'Failed to create wearable metric' },
      { status: 500 }
    );
  }
}
