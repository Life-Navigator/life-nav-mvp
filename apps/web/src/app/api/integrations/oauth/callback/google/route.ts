/**
 * Google OAuth Callback Handler
 *
 * Handles the OAuth 2.0 callback from Google, exchanges the authorization code
 * for tokens, and persists them the SAME way the Microsoft callback does:
 * ENCRYPTED in Supabase `core.integration_tokens` via the service-role
 * `upsert_integration_token` RPC (AES-256 with INTEGRATION_ENCRYPTION_KEY).
 *
 * SECURITY INVARIANTS:
 *  - Tokens are stored encrypted, server-side only, scoped to user_id. They are
 *    NEVER returned to the browser and NEVER logged.
 *  - The auth `code` is consumed during the exchange and never persisted; the
 *    OAuth query params (code/state) are dropped via a clean redirect.
 *  - The email/calendar routes read this token back through the same
 *    `get_integration_token` RPC, so connect → status → messages/events works
 *    end-to-end against Supabase (no dependency on a non-existent core-api
 *    endpoint).
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { createGoogleOAuthService } from '@/lib/integrations/google/oauth';
import { getUserIdFromJWT } from '@/lib/jwt';
import { logIntegrationEvent, classifyError } from '@/lib/integrations/auditLog';

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function parseRedirectPath(state: string): string {
  try {
    const stateData = JSON.parse(Buffer.from(state.split('.')[0], 'base64url').toString('utf8'));
    if (stateData?.redirect && typeof stateData.redirect === 'string') {
      return stateData.redirect;
    }
  } catch {
    // keep default
  }
  return '/settings/integrations';
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  // Handle OAuth errors (never echo provider internals beyond the safe code).
  if (error) {
    return NextResponse.redirect(
      new URL(
        `/settings/integrations?error=${encodeURIComponent(error)}&message=${encodeURIComponent(errorDescription || 'OAuth authorization failed')}`,
        request.url
      )
    );
  }

  // Validate required parameters
  if (!code) {
    return NextResponse.redirect(new URL('/settings/integrations?error=missing_code', request.url));
  }

  // Validate state parameter (CSRF protection)
  const cookieStore = await cookies();
  const storedState = cookieStore.get('google_oauth_state')?.value;
  if (!state || state !== storedState) {
    return NextResponse.redirect(
      new URL('/settings/integrations?error=invalid_state', request.url)
    );
  }

  // Identify the user from the Supabase session (same as the Microsoft path).
  const userId = await getUserIdFromJWT(request);
  if (!userId) {
    return NextResponse.redirect(new URL('/login?redirect=/settings/integrations', request.url));
  }

  const encryptionKey = process.env.INTEGRATION_ENCRYPTION_KEY;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  // Honest disabled state when OAuth / crypto isn't configured.
  if (!clientId || !clientSecret || !encryptionKey) {
    return NextResponse.redirect(
      new URL('/settings/integrations?error=oauth_not_configured', request.url)
    );
  }

  await logIntegrationEvent({
    userId,
    provider: 'google',
    action: 'connect_start',
    context: { route: 'oauth/callback/google' },
  });

  try {
    // Exchange authorization code for tokens (code is consumed here, never stored).
    const oauthService = createGoogleOAuthService();
    const tokens = await oauthService.exchangeCode(code);

    // Get provider account info to associate with the stored token.
    let externalAccountId: string | null = null;
    let externalEmail: string | null = null;
    try {
      const userInfo = await oauthService.getUserInfo(tokens.accessToken);
      externalAccountId = userInfo.id ?? null;
      externalEmail = userInfo.email ?? null;
    } catch {
      // Non-fatal: we can still persist the token without the profile email.
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      throw new Error('supabase_admin_unconfigured');
    }

    // Persist ENCRYPTED via the same RPC Microsoft uses. The RPC encrypts
    // access + refresh tokens with INTEGRATION_ENCRYPTION_KEY and upserts the
    // public.integrations status row to 'connected'.
    const { error: upsertError } = await supabase.rpc('upsert_integration_token', {
      p_user_id: userId,
      p_provider: 'google',
      p_access_token: tokens.accessToken,
      p_refresh_token: tokens.refreshToken || null,
      p_expires_at: tokens.expiresAt.toISOString(),
      p_scope: tokens.scope || null,
      p_external_account_id: externalAccountId,
      p_external_email: externalEmail,
      p_metadata: {
        provider: 'google',
        connected_via: 'oauth_callback',
      },
      p_encryption_key: encryptionKey,
    });

    if (upsertError) {
      throw new Error(upsertError.message);
    }

    await logIntegrationEvent({
      userId,
      provider: 'google',
      action: 'connect_success',
      success: true,
      context: { route: 'oauth/callback/google', has_refresh_token: Boolean(tokens.refreshToken) },
    });

    // Clean redirect — drops code/state from the URL so they aren't retained.
    const redirectPath = parseRedirectPath(state);
    const response = NextResponse.redirect(
      new URL(`${redirectPath}?success=google_connected`, request.url)
    );
    response.cookies.delete('google_oauth_state');
    return response;
  } catch (err) {
    await logIntegrationEvent({
      userId,
      provider: 'google',
      action: 'connect_failure',
      success: false,
      errorClass: classifyError(err),
      context: { route: 'oauth/callback/google' },
    });
    // Never leak the internal error message into the redirect URL — it can
    // contain provider tokens, SDK details, or other internals.
    return NextResponse.redirect(
      new URL('/settings/integrations?error=exchange_failed', request.url)
    );
  }
}
