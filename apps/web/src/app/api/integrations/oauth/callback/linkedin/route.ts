import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { getUserIdFromJWT } from '@/lib/jwt';
import { getOAuthProviderConfig } from '@/lib/integrations/oauth-config';

type LinkedInTokenResponse = {
  access_token: string;
  expires_in: number;
  scope?: string;
};

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  if (error) {
    return NextResponse.redirect(
      new URL(
        `/settings/integrations?error=${encodeURIComponent(error)}&message=${encodeURIComponent(errorDescription || 'OAuth authorization failed')}`,
        request.url
      )
    );
  }

  if (!code) {
    return NextResponse.redirect(new URL('/settings/integrations?error=missing_code', request.url));
  }

  const cookieStore = await cookies();
  const storedState = cookieStore.get('linkedin_oauth_state')?.value;
  if (!state || state !== storedState) {
    return NextResponse.redirect(
      new URL('/settings/integrations?error=invalid_state', request.url)
    );
  }

  const userId = await getUserIdFromJWT(request);
  if (!userId) {
    return NextResponse.redirect(new URL('/login?redirect=/settings/integrations', request.url));
  }

  const config = getOAuthProviderConfig('linkedin');
  const encryptionKey = process.env.INTEGRATION_ENCRYPTION_KEY;

  if (!config || config.clientId === 'mock_client_id' || !encryptionKey) {
    return NextResponse.redirect(
      new URL('/settings/integrations?error=oauth_not_configured', request.url)
    );
  }

  const redirectUri =
    config.redirectUri ||
    `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/oauth/callback/linkedin`;

  try {
    const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: config.clientId,
        client_secret: config.clientSecret,
      }).toString(),
    });

    if (!tokenRes.ok) {
      const text = await tokenRes.text().catch(() => '');
      throw new Error(`Token exchange failed: ${text}`);
    }

    const tokens = (await tokenRes.json()) as LinkedInTokenResponse;

    // Fetch LinkedIn profile for external account info
    const profileRes = await fetch('https://api.linkedin.com/v2/me', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    let externalAccountId: string | null = null;
    if (profileRes.ok) {
      const me = await profileRes.json();
      externalAccountId = me?.id || null;
    }

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
    const supabase = getSupabaseAdmin();
    if (!supabase) throw new Error('Supabase admin client is not configured');

    const { error: upsertError } = await supabase.rpc('upsert_integration_token', {
      p_user_id: userId,
      p_provider: 'linkedin',
      p_access_token: tokens.access_token,
      p_refresh_token: null,
      p_expires_at: expiresAt,
      p_scope: tokens.scope || null,
      p_external_account_id: externalAccountId,
      p_external_email: null,
      p_metadata: {
        provider: 'linkedin',
        connected_via: 'oauth_callback',
      },
      p_encryption_key: encryptionKey,
    });

    if (upsertError) throw new Error(upsertError.message);

    let redirectPath = '/settings/integrations';
    try {
      const stateData = JSON.parse(Buffer.from(state.split('.')[0], 'base64url').toString('utf8'));
      if (stateData?.redirect) redirectPath = stateData.redirect;
    } catch {
      // keep default
    }

    const response = NextResponse.redirect(
      new URL(`${redirectPath}?success=linkedin_connected`, request.url)
    );
    response.cookies.delete('linkedin_oauth_state');
    return response;
  } catch (err) {
    return NextResponse.redirect(
      new URL(
        `/settings/integrations?error=exchange_failed&message=${encodeURIComponent((err as Error).message)}`,
        request.url
      )
    );
  }
}
