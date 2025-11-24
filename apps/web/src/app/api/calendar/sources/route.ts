import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromJWT } from '@/lib/jwt';
import { db as prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Default colors for calendar sources
const defaultColors = [
  '#3B82F6', // Blue
  '#10B981', // Green
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#8B5CF6', // Purple
  '#EC4899', // Pink
];

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromJWT(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch calendar sources/integrations
    const calendarIntegrations = await prisma.integration.findMany({
      where: {
        userId,
        type: 'calendar',
        status: 'connected',
      },
      orderBy: { createdAt: 'asc' },
    });

    // Also get any custom calendar sources from CalendarSource table if it exists
    let customSources: any[] = [];
    try {
      customSources = await (prisma as any).calendarSource?.findMany?.({
        where: { userId },
      }) || [];
    } catch {
      // Table might not exist
    }

    // Combine integration-based and custom calendar sources
    const sources = [
      // Add a default "My Calendar" if user has no sources
      ...(calendarIntegrations.length === 0 && customSources.length === 0 ? [{
        id: 'default',
        name: 'My Calendar',
        color: defaultColors[0],
        isEnabled: true,
        provider: 'local',
      }] : []),
      // Integration-based sources
      ...calendarIntegrations.map((integration, index) => ({
        id: integration.id,
        name: integration.name || `${integration.provider} Calendar`,
        color: defaultColors[index % defaultColors.length],
        isEnabled: true,
        provider: integration.provider,
      })),
      // Custom sources
      ...customSources.map((source: any, index: number) => ({
        id: source.id,
        name: source.name,
        color: source.color || defaultColors[(calendarIntegrations.length + index) % defaultColors.length],
        isEnabled: source.isEnabled !== false,
        provider: 'custom',
      })),
    ];

    return NextResponse.json(sources);
  } catch (error) {
    console.error('Error fetching calendar sources:', error);
    return NextResponse.json(
      { error: 'Failed to fetch calendar sources' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromJWT(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { provider, accessToken, refreshToken, accountEmail, name } = body;

    // Create calendar integration
    const integration = await prisma.integration.create({
      data: {
        userId,
        type: 'calendar',
        provider,
        name: name || `${provider} Calendar`,
        status: 'connected',
        accountEmail,
        accessToken,
        refreshToken,
        lastSyncAt: new Date(),
      },
    });

    return NextResponse.json({
      id: integration.id,
      name: integration.name,
      provider,
      status: 'connected',
    });
  } catch (error) {
    console.error('Error connecting calendar:', error);
    return NextResponse.json(
      { error: 'Failed to connect calendar' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const userId = await getUserIdFromJWT(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const sourceId = searchParams.get('id');

    if (!sourceId) {
      return NextResponse.json({ error: 'Source ID required' }, { status: 400 });
    }

    // Try to delete from integrations
    await prisma.integration.deleteMany({
      where: {
        id: sourceId,
        userId,
        type: 'calendar',
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error disconnecting calendar:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect calendar' },
      { status: 500 }
    );
  }
}
