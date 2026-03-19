/**
 * Google OAuth Callback Handler
 *
 * Handles the OAuth 2.0 callback from Google, exchanges the authorization code
 * for access tokens, and stores the tokens for the user.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createGoogleOAuthService } from '@/lib/integrations/google/oauth';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  const integrationRedirect = '/dashboard/integrations';

  // Handle OAuth errors
  if (error) {
    console.error('Google OAuth error:', error, errorDescription);
    return NextResponse.redirect(
      new URL(
        `${integrationRedirect}?error=${encodeURIComponent(error)}&message=${encodeURIComponent(errorDescription || 'OAuth authorization failed')}`,
        request.url
      )
    );
  }

  // Validate required parameters
  if (!code) {
    return NextResponse.redirect(new URL(`${integrationRedirect}?error=missing_code`, request.url));
  }

  // Validate state parameter (CSRF protection)
  const cookieStore = await cookies();
  const storedState = cookieStore.get('google_oauth_state')?.value;

  if (!state || state !== storedState) {
    console.error('OAuth state mismatch', { received: state, stored: storedState });
    return NextResponse.redirect(
      new URL(`${integrationRedirect}?error=invalid_state`, request.url)
    );
  }

  // Authenticate user via Supabase session
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return NextResponse.redirect(
      new URL('/auth/login?redirect=' + encodeURIComponent(integrationRedirect), request.url)
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(
      new URL('/auth/login?redirect=' + encodeURIComponent(integrationRedirect), request.url)
    );
  }

  try {
    // Exchange authorization code for tokens
    const oauthService = createGoogleOAuthService();
    const tokens = await oauthService.exchangeCode(code);

    // Get user info to associate with tokens
    const userInfo = await oauthService.getUserInfo(tokens.accessToken);

    // Store tokens in user_metadata for now (until a dedicated integrations table is created)
    const { error: updateError } = await supabase.auth.updateUser({
      data: {
        google_integration: {
          connected: true,
          google_email: userInfo.email,
          google_user_id: userInfo.id,
          connected_at: new Date().toISOString(),
          scope: tokens.scope,
        },
      },
    });

    if (updateError) {
      console.error('Failed to save Google integration:', updateError);
      return NextResponse.redirect(
        new URL(
          `${integrationRedirect}?error=save_failed&message=${encodeURIComponent('Failed to save integration')}`,
          request.url
        )
      );
    }

    // Parse the state to get redirect info
    let redirectPath = integrationRedirect;
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
        `${integrationRedirect}?error=exchange_failed&message=${encodeURIComponent((err as Error).message)}`,
        request.url
      )
    );
  }
}
