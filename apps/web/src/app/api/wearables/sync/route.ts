import { NextRequest, NextResponse } from 'next/server';
import { db as prisma } from '@/lib/db';
import { getUserIdFromJWT } from '@/lib/jwt';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// POST - Trigger a sync for a specific connection
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromJWT(request);

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { connectionId, dataTypes, dateRangeStart, dateRangeEnd } = body;

    if (!connectionId) {
      return NextResponse.json(
        { error: 'Connection ID is required' },
        { status: 400 }
      );
    }

    // Verify ownership
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

    // Create sync log
    const syncLog = await prisma.wearableSyncLog.create({
      data: {
        connectionId,
        status: 'in_progress',
        dataTypes: dataTypes || connection.dataTypes,
        dateRangeStart: dateRangeStart ? new Date(dateRangeStart) : undefined,
        dateRangeEnd: dateRangeEnd ? new Date(dateRangeEnd) : undefined,
      },
    });

    // TODO: Trigger actual sync based on provider
    // For now, return the sync log ID so the client can poll for status
    // In production, this would dispatch a background job

    return NextResponse.json({
      syncLog: {
        id: syncLog.id,
        status: syncLog.status,
        connectionId: syncLog.connectionId,
      },
      message: 'Sync initiated. This will be processed in the background.',
    });
  } catch (error) {
    console.error('Error initiating wearable sync:', error);
    return NextResponse.json(
      { error: 'Failed to initiate sync' },
      { status: 500 }
    );
  }
}

// GET - Get sync status/history for a connection
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromJWT(request);

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const connectionId = searchParams.get('connectionId');
    const limit = parseInt(searchParams.get('limit') || '10');

    if (!connectionId) {
      return NextResponse.json(
        { error: 'Connection ID is required' },
        { status: 400 }
      );
    }

    // Verify ownership
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

    const syncLogs = await prisma.wearableSyncLog.findMany({
      where: { connectionId },
      orderBy: { syncStartedAt: 'desc' },
      take: limit,
      select: {
        id: true,
        syncStartedAt: true,
        syncCompletedAt: true,
        status: true,
        recordsSynced: true,
        recordsFailed: true,
        errorMessage: true,
        dataTypes: true,
        dateRangeStart: true,
        dateRangeEnd: true,
      },
    });

    return NextResponse.json({ syncLogs });
  } catch (error) {
    console.error('Error fetching sync logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sync logs' },
      { status: 500 }
    );
  }
}
