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

    // Fetch connected email accounts from integrations table
    const emailIntegrations = await prisma.integration.findMany({
      where: {
        userId,
        type: 'email',
        status: 'connected',
      },
      orderBy: { createdAt: 'desc' },
    });

    const accounts = emailIntegrations.map(integration => ({
      id: integration.id,
      email: integration.accountEmail || integration.accountId || 'Unknown',
      provider: integration.provider,
      name: integration.name || integration.provider,
      lastSync: integration.lastSyncAt?.toISOString() || null,
      status: integration.status,
      folders: ['inbox', 'sent', 'drafts', 'trash', 'spam'],
    }));

    return NextResponse.json(accounts);
  } catch (error) {
    console.error('Error fetching email accounts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch email accounts' },
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
    const { provider, accessToken, refreshToken, accountEmail } = body;

    // Create new email integration
    const integration = await prisma.integration.create({
      data: {
        userId,
        type: 'email',
        provider,
        name: `${provider} Email`,
        status: 'connected',
        accountEmail,
        accessToken,
        refreshToken,
        lastSyncAt: new Date(),
      },
    });

    return NextResponse.json({
      id: integration.id,
      email: accountEmail,
      provider,
      status: 'connected',
    });
  } catch (error) {
    console.error('Error connecting email account:', error);
    return NextResponse.json(
      { error: 'Failed to connect email account' },
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
    const accountId = searchParams.get('id');

    if (!accountId) {
      return NextResponse.json({ error: 'Account ID required' }, { status: 400 });
    }

    // Verify ownership and delete
    await prisma.integration.deleteMany({
      where: {
        id: accountId,
        userId,
        type: 'email',
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error disconnecting email account:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect email account' },
      { status: 500 }
    );
  }
}
