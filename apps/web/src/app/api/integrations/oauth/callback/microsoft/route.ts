import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { getUserIdFromJWT } from '@/lib/jwt';

type MicrosoftTokenResponse = {
  token_type: string;
  scope: string;
  expires_in: number;
  access_token: string;
  refresh_token?: string;
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
        request.url,
      ),
    );
  }

  if (!code) {
    return NextResponse.redirect(new URL('/settings/integrations?error=missing_code', request.url));
  }

  const cookieStore = await cookies();
  const storedState = cookieStore.get('microsoft_oauth_state')?.value;
  if (!state || state !== storedState) {
    return NextResponse.redirect(new URL('/settings/integrations?error=invalid_state', request.url));
  }

  const userId = await getUserIdFromJWT(request);
  if (!userId) {
    return NextResponse.redirect(new URL('/login?redirect=/settings/integrations', request.url));
  }

  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  const tenant = process.env.MICROSOFT_TENANT_ID || 'common';
  const redirectUri =
    process.env.MICROSOFT_REDIRECT_URI ||
    `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/oauth/callback/microsoft`;
  const encryptionKey = process.env.INTEGRATION_ENCRYPTION_KEY;

  if (!clientId || !clientSecret || !encryptionKey) {
    return NextResponse.redirect(
      new URL('/settings/integrations?error=oauth_not_configured', request.url),
    );
  }

  try {
    const tokenRes = await fetch(
      `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
        }).toString(),
      },
    );

    if (!tokenRes.ok) {
      const text = await tokenRes.text().catch(() => '');
      throw new Error(`Token exchange failed: ${text}`);
    }

    const tokens = (await tokenRes.json()) as MicrosoftTokenResponse;

    const profileRes = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    });

    let externalAccountId: string | null = null;
    let externalEmail: string | null = null;
    if (profileRes.ok) {
      const me = await profileRes.json();
      externalAccountId = me?.id || null;
      externalEmail = me?.mail || me?.userPrincipalName || null;
    }

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      throw new Error('Supabase admin client is not configured');
    }

    const { error: upsertError } = await supabase.rpc('upsert_integration_token', {
      p_user_id: userId,
      p_provider: 'microsoft',
      p_access_token: tokens.access_token,
      p_refresh_token: tokens.refresh_token || null,
      p_expires_at: expiresAt,
      p_scope: tokens.scope || null,
      p_external_account_id: externalAccountId,
      p_external_email: externalEmail,
      p_metadata: {
        provider: 'microsoft',
        connected_via: 'oauth_callback',
      },
      p_encryption_key: encryptionKey,
    });

    if (upsertError) {
      throw new Error(upsertError.message);
    }

    let redirectPath = '/settings/integrations';
    try {
      const stateData = JSON.parse(Buffer.from(state.split('.')[0], 'base64url').toString('utf8'));
      if (stateData?.redirect) {
        redirectPath = stateData.redirect;
      }
    } catch {
      // keep default
    }

    const response = NextResponse.redirect(
      new URL(`${redirectPath}?success=microsoft_connected`, request.url),
    );
    response.cookies.delete('microsoft_oauth_state');
    return response;
  } catch (err) {
    return NextResponse.redirect(
      new URL(
        `/settings/integrations?error=exchange_failed&message=${encodeURIComponent((err as Error).message)}`,
        request.url,
      ),
    );
  }
}
