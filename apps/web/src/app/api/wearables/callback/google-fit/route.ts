import { NextRequest, NextResponse } from 'next/server';
import { db as prisma } from '@/lib/db';
import { getUserIdFromJWT } from '@/lib/jwt';
import { createGoogleFitAdapter } from '@/lib/wearables/google-fit';

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
    const adapter = createGoogleFitAdapter();
    const tokens = await adapter.exchangeCodeForTokens(code);
    const deviceInfo = await adapter.getDeviceInfo(tokens.accessToken);

    // Store connection in database
    await prisma.wearableConnection.upsert({
      where: {
        userId_provider: {
          userId,
          provider: 'google_fit',
        },
      },
      create: {
        userId,
        provider: 'google_fit',
        deviceType: deviceInfo.deviceType || 'phone',
        deviceModel: deviceInfo.deviceModel,
        deviceName: deviceInfo.deviceName || 'Google Fit',
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
        scope: tokens.scope,
        dataTypes: ['steps', 'heart_rate', 'sleep', 'calories', 'distance', 'weight'],
        status: 'active',
      },
      update: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
        scope: tokens.scope,
        deviceType: deviceInfo.deviceType,
        deviceModel: deviceInfo.deviceModel,
        deviceName: deviceInfo.deviceName,
        status: 'active',
        updatedAt: new Date(),
      },
    });

    // Redirect back to integrations page with success
    return NextResponse.redirect(
      new URL('/dashboard/integrations?connected=google_fit', request.url)
    );
  } catch (error) {
    console.error('Google Fit OAuth callback error:', error);
    return NextResponse.redirect(
      new URL('/dashboard/integrations?error=google_fit_connection_failed', request.url)
    );
  }
}
