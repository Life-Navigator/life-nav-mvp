import { NextRequest, NextResponse } from 'next/server';
import { db as prisma } from '@/lib/db';
import { getUserIdFromJWT } from '@/lib/jwt';
import { createFitbitAdapter } from '@/lib/wearables/fitbit';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      return NextResponse.redirect(
        new URL(`/dashboard/integrations?error=${error}`, request.url)
      );
    }

    if (!code) {
      return NextResponse.redirect(
        new URL('/dashboard/integrations?error=no_code', request.url)
      );
    }

    // Verify user from state token
    const userId = await getUserIdFromJWT(request);
    if (!userId) {
      return NextResponse.redirect(
        new URL('/auth/login?error=unauthorized', request.url)
      );
    }

    // Exchange code for tokens
    const adapter = createFitbitAdapter();
    const tokens = await adapter.exchangeCodeForTokens(code);
    const deviceInfo = await adapter.getDeviceInfo(tokens.accessToken);

    // Store connection in database
    await prisma.wearableConnection.upsert({
      where: {
        userId_provider: {
          userId,
          provider: 'fitbit',
        },
      },
      create: {
        userId,
        provider: 'fitbit',
        deviceType: deviceInfo.deviceType,
        deviceModel: deviceInfo.deviceModel,
        deviceName: deviceInfo.deviceName,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
        scope: tokens.scope,
        userId_external: tokens.userId,
        dataTypes: ['steps', 'heart_rate', 'sleep', 'calories'],
        status: 'active',
      },
      update: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
        scope: tokens.scope,
        userId_external: tokens.userId,
        deviceType: deviceInfo.deviceType,
        deviceModel: deviceInfo.deviceModel,
        deviceName: deviceInfo.deviceName,
        status: 'active',
        updatedAt: new Date(),
      },
    });

    // Redirect back to integrations page with success
    return NextResponse.redirect(
      new URL('/dashboard/integrations?connected=fitbit', request.url)
    );
  } catch (error) {
    console.error('Fitbit OAuth callback error:', error);
    return NextResponse.redirect(
      new URL('/dashboard/integrations?error=fitbit_connection_failed', request.url)
    );
  }
}
