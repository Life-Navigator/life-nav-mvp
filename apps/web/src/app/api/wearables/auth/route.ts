import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromJWT } from '@/lib/jwt';
import { createFitbitAdapter } from '@/lib/wearables/fitbit';
import { createGoogleFitAdapter } from '@/lib/wearables/google-fit';

export const dynamic = 'force-dynamic';

// GET - Initiate OAuth flow for a provider
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromJWT(request);

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const provider = searchParams.get('provider');

    if (!provider) {
      return NextResponse.json(
        { error: 'Provider is required' },
        { status: 400 }
      );
    }

    // Use userId as state for security
    const state = userId;

    let authUrl: string;

    switch (provider.toLowerCase()) {
      case 'fitbit':
        const fitbitAdapter = createFitbitAdapter();
        authUrl = fitbitAdapter.getAuthUrl(state);
        break;

      case 'google_fit':
        const googleFitAdapter = createGoogleFitAdapter();
        authUrl = googleFitAdapter.getAuthUrl(state);
        break;

      // Add more providers here
      case 'apple_health':
        // Apple Health uses HealthKit which requires native iOS app
        // For web, users would need to use the Health app export feature
        return NextResponse.json(
          {
            error: 'Apple Health requires iOS app or manual data export',
            instruction: 'Use the Health app on your iPhone to export data',
          },
          { status: 400 }
        );

      default:
        return NextResponse.json(
          { error: `Provider ${provider} not supported yet` },
          { status: 400 }
        );
    }

    // Redirect user to provider's OAuth page
    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('Error initiating wearable auth:', error);
    return NextResponse.json(
      { error: 'Failed to initiate authentication' },
      { status: 500 }
    );
  }
}
