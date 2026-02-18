import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const MICROSOFT_SCOPES = {
  basic: ['openid', 'profile', 'email', 'offline_access'],
  calendar: ['Calendars.Read', 'Calendars.ReadWrite'],
  mail: ['Mail.Read', 'Mail.Send'],
} as const;

type ScopeBundleKey = keyof typeof MICROSOFT_SCOPES;

function getMicrosoftAuthUrl(scopes: string[], state: string): string {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const redirectUri =
    process.env.MICROSOFT_REDIRECT_URI ||
    `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/oauth/callback/microsoft`;
  const tenant = process.env.MICROSOFT_TENANT_ID || 'common';

  if (!clientId) {
    throw new Error('MICROSOFT_CLIENT_ID is not configured');
  }

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    response_mode: 'query',
    scope: scopes.join(' '),
    state,
  });

  return `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize?${params.toString()}`;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const bundlesParam = searchParams.get('bundles') || 'basic,calendar,mail';
  const bundles = bundlesParam.split(',').map((b) => b.trim()) as ScopeBundleKey[];
  const redirect = searchParams.get('redirect') || '/settings/integrations';

  const scopeSet = new Set<string>();
  for (const bundle of bundles) {
    const bundleScopes = MICROSOFT_SCOPES[bundle];
    if (bundleScopes) bundleScopes.forEach((scope) => scopeSet.add(scope));
  }
  MICROSOFT_SCOPES.basic.forEach((scope) => scopeSet.add(scope));

  const stateData = { redirect, bundles, timestamp: Date.now() };
  const statePayload = Buffer.from(JSON.stringify(stateData)).toString('base64url');
  const stateNonce = crypto.randomBytes(16).toString('hex');
  const state = `${statePayload}.${stateNonce}`;

  const cookieStore = await cookies();
  cookieStore.set('microsoft_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 10,
    path: '/',
  });

  try {
    const authUrl = getMicrosoftAuthUrl(Array.from(scopeSet), state);
    return NextResponse.redirect(authUrl);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || 'Microsoft OAuth not configured' },
      { status: 503 },
    );
  }
}
