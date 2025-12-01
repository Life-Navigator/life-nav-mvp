import { NextRequest, NextResponse } from 'next/server';
import { db as prisma } from '@/lib/db';
import { getUserIdFromJWT } from '@/lib/jwt';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// GET - List all wearable connections for the user
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromJWT(request);

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const connections = await prisma.wearableConnection.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        provider: true,
        deviceType: true,
        deviceModel: true,
        deviceName: true,
        status: true,
        lastSyncedAt: true,
        syncFrequency: true,
        dataTypes: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ connections });
  } catch (error) {
    console.error('Error fetching wearable connections:', error);
    return NextResponse.json(
      { error: 'Failed to fetch wearable connections' },
      { status: 500 }
    );
  }
}

// POST - Create a new wearable connection
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromJWT(request);

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      provider,
      deviceType,
      deviceModel,
      deviceName,
      accessToken,
      refreshToken,
      expiresAt,
      scope,
      dataTypes,
      userId_external,
      metadata,
    } = body;

    if (!provider) {
      return NextResponse.json(
        { error: 'Provider is required' },
        { status: 400 }
      );
    }

    // Check if connection already exists
    const existing = await prisma.wearableConnection.findUnique({
      where: {
        userId_provider: {
          userId,
          provider,
        },
      },
    });

    if (existing) {
      // Update existing connection
      const updated = await prisma.wearableConnection.update({
        where: { id: existing.id },
        data: {
          deviceType,
          deviceModel,
          deviceName,
          accessToken,
          refreshToken,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
          scope,
          dataTypes,
          userId_external,
          metadata,
          status: 'active',
          updatedAt: new Date(),
        },
      });

      return NextResponse.json({ connection: updated });
    }

    // Create new connection
    const connection = await prisma.wearableConnection.create({
      data: {
        userId,
        provider,
        deviceType,
        deviceModel,
        deviceName,
        accessToken,
        refreshToken,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        scope,
        dataTypes: dataTypes || [],
        userId_external,
        metadata,
      },
    });

    return NextResponse.json({ connection }, { status: 201 });
  } catch (error) {
    console.error('Error creating wearable connection:', error);
    return NextResponse.json(
      { error: 'Failed to create wearable connection' },
      { status: 500 }
    );
  }
}

// DELETE - Remove a wearable connection
export async function DELETE(request: NextRequest) {
  try {
    const userId = await getUserIdFromJWT(request);

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const connectionId = searchParams.get('id');

    if (!connectionId) {
      return NextResponse.json(
        { error: 'Connection ID is required' },
        { status: 400 }
      );
    }

    // Verify ownership before deleting
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

    await prisma.wearableConnection.delete({
      where: { id: connectionId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting wearable connection:', error);
    return NextResponse.json(
      { error: 'Failed to delete wearable connection' },
      { status: 500 }
    );
  }
}
