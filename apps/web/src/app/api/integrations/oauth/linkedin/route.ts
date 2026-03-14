import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getOAuthProviderConfig, generateOAuthState } from '@/lib/integrations/oauth-config';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: 'Not configured' }, { status: 503 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const config = getOAuthProviderConfig('linkedin');
  if (!config || config.clientId === 'mock_client_id') {
    return NextResponse.json({ error: 'LinkedIn not configured' }, { status: 503 });
  }

  const redirect = request.nextUrl.searchParams.get('redirect') || '/settings/integrations';
  const statePayload = Buffer.from(JSON.stringify({ redirect })).toString('base64url');
  const nonce = generateOAuthState();
  const state = `${statePayload}.${nonce}`;

  const redirectUri =
    config.redirectUri ||
    `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/oauth/callback/linkedin`;

  const url = new URL(config.authorizationUrl);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', state);
  url.searchParams.set('scope', (config.scopes || []).join(' '));

  const cookieStore = await cookies();
  cookieStore.set('linkedin_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600, // 10 min
    path: '/',
  });

  return NextResponse.redirect(url.toString());
}
