/**
 * Google OAuth Callback Handler
 *
 * Handles the OAuth 2.0 callback from Google, exchanges the authorization code
 * for access tokens, and stores the tokens for the user.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createGoogleOAuthService } from '@/lib/integrations/google/oauth';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  // Handle OAuth errors
  if (error) {
    console.error('Google OAuth error:', error, errorDescription);
    return NextResponse.redirect(
      new URL(
        `/settings/integrations?error=${encodeURIComponent(error)}&message=${encodeURIComponent(errorDescription || 'OAuth authorization failed')}`,
        request.url
      )
    );
  }

  // Validate required parameters
  if (!code) {
    return NextResponse.redirect(
      new URL('/settings/integrations?error=missing_code', request.url)
    );
  }

  // Validate state parameter (CSRF protection)
  const cookieStore = await cookies();
  const storedState = cookieStore.get('google_oauth_state')?.value;

  if (!state || state !== storedState) {
    console.error('OAuth state mismatch', { received: state, stored: storedState });
    return NextResponse.redirect(
      new URL('/settings/integrations?error=invalid_state', request.url)
    );
  }

  try {
    // Exchange authorization code for tokens
    const oauthService = createGoogleOAuthService();
    const tokens = await oauthService.exchangeCode(code);

    // Get user info to associate with tokens
    const userInfo = await oauthService.getUserInfo(tokens.accessToken);

    // Get current session token for API authentication
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.redirect(
        new URL('/login?redirect=/settings/integrations', request.url)
      );
    }

    // Store tokens in backend
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const saveResponse = await fetch(`${backendUrl}/api/v1/integrations/google/tokens`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionToken}`,
      },
      body: JSON.stringify({
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        expires_at: tokens.expiresAt.toISOString(),
        scope: tokens.scope,
        google_user_id: userInfo.id,
        google_email: userInfo.email,
      }),
    });

    if (!saveResponse.ok) {
      const errorData = await saveResponse.json().catch(() => ({}));
      console.error('Failed to save Google tokens:', errorData);
      return NextResponse.redirect(
        new URL(
          `/settings/integrations?error=save_failed&message=${encodeURIComponent('Failed to save integration')}`,
          request.url
        )
      );
    }

    // Parse the state to get redirect info
    let redirectPath = '/settings/integrations';
    try {
      const stateData = JSON.parse(atob(state.split('.')[0]));
      if (stateData.redirect) {
        redirectPath = stateData.redirect;
      }
    } catch {
      // Use default redirect
    }

    // Clear the state cookie
    const response = NextResponse.redirect(
      new URL(`${redirectPath}?success=google_connected`, request.url)
    );

    response.cookies.delete('google_oauth_state');

    return response;
  } catch (err) {
    console.error('Google OAuth callback error:', err);
    return NextResponse.redirect(
      new URL(
        `/settings/integrations?error=exchange_failed&message=${encodeURIComponent((err as Error).message)}`,
        request.url
      )
    );
  }
}
