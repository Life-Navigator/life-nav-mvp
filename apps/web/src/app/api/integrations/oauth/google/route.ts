/**
 * Google OAuth Initiation Endpoint
 *
 * Initiates the OAuth 2.0 flow with Google, requesting the specified scopes.
 * Supports scope bundles for common integrations (calendar, drive, health, etc.)
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import crypto from 'crypto';
import {
  GoogleOAuthService,
  SCOPE_BUNDLES,
  GOOGLE_SCOPES,
} from '@/lib/integrations/google/oauth';

type ScopeBundleKey = keyof typeof SCOPE_BUNDLES;
type ScopeKey = keyof typeof GOOGLE_SCOPES;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  // Get requested scope bundles (comma-separated)
  const bundlesParam = searchParams.get('bundles') || 'basic';
  const bundles = bundlesParam.split(',').map((b) => b.trim()) as ScopeBundleKey[];

  // Get any additional individual scopes
  const additionalScopes = searchParams.get('scopes')?.split(',') || [];

  // Get optional redirect after OAuth completes
  const redirect = searchParams.get('redirect') || '/settings/integrations';

  // Build scope list from bundles
  const scopeSet = new Set<string>();

  for (const bundle of bundles) {
    const bundleScopes = SCOPE_BUNDLES[bundle];
    if (bundleScopes) {
      bundleScopes.forEach((scope) => scopeSet.add(scope));
    }
  }

  // Add individual scopes
  for (const scopeKey of additionalScopes) {
    const scope = GOOGLE_SCOPES[scopeKey as ScopeKey];
    if (scope) {
      scopeSet.add(scope);
    } else if (scopeKey.startsWith('https://')) {
      // Allow full scope URLs
      scopeSet.add(scopeKey);
    }
  }

  // Always include basic scopes
  SCOPE_BUNDLES.basic.forEach((scope) => scopeSet.add(scope));

  const scopes = Array.from(scopeSet);

  // Generate state parameter for CSRF protection
  const stateData = {
    redirect,
    bundles,
    timestamp: Date.now(),
  };
  const statePayload = btoa(JSON.stringify(stateData));
  const stateNonce = crypto.randomBytes(16).toString('hex');
  const state = `${statePayload}.${stateNonce}`;

  // Store state in cookie for validation
  const cookieStore = await cookies();
  cookieStore.set('google_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 10, // 10 minutes
    path: '/',
  });

  // Create OAuth service and generate auth URL
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: 'Google OAuth not configured' },
      { status: 503 }
    );
  }

  const oauthService = new GoogleOAuthService(clientId, clientSecret);

  const authUrl = oauthService.getAuthUrl(scopes, state, {
    accessType: 'offline',
    prompt: 'consent',
    includeGrantedScopes: true,
  });

  return NextResponse.redirect(authUrl);
}

export async function POST(request: NextRequest) {
  // Alternative POST method for programmatic initiation
  const body = await request.json();
  const { bundles = ['basic'], scopes = [], redirect = '/settings/integrations' } = body;

  // Build scope list from bundles
  const scopeSet = new Set<string>();

  for (const bundle of bundles as ScopeBundleKey[]) {
    const bundleScopes = SCOPE_BUNDLES[bundle];
    if (bundleScopes) {
      bundleScopes.forEach((scope) => scopeSet.add(scope));
    }
  }

  // Add individual scopes
  for (const scopeKey of scopes as string[]) {
    const scope = GOOGLE_SCOPES[scopeKey as ScopeKey];
    if (scope) {
      scopeSet.add(scope);
    }
  }

  // Always include basic scopes
  SCOPE_BUNDLES.basic.forEach((scope) => scopeSet.add(scope));

  const allScopes = Array.from(scopeSet);

  // Generate state parameter
  const stateData = {
    redirect,
    bundles,
    timestamp: Date.now(),
  };
  const statePayload = btoa(JSON.stringify(stateData));
  const stateNonce = crypto.randomBytes(16).toString('hex');
  const state = `${statePayload}.${stateNonce}`;

  // Store state in cookie
  const cookieStore = await cookies();
  cookieStore.set('google_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 10,
    path: '/',
  });

  // Create OAuth service and generate auth URL
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: 'Google OAuth not configured' },
      { status: 503 }
    );
  }

  const oauthService = new GoogleOAuthService(clientId, clientSecret);

  const authUrl = oauthService.getAuthUrl(allScopes, state, {
    accessType: 'offline',
    prompt: 'consent',
    includeGrantedScopes: true,
  });

  return NextResponse.json({ authUrl, scopes: allScopes });
}
