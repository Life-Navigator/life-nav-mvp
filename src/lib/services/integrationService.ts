// src/lib/services/integrationService.ts
import { getOAuthProviderConfig, buildAuthorizationUrl, generateOAuthState, generateCodeVerifier, ProviderConfig } from '@/lib/integrations/oauth-config';
import { db as prisma } from '@/lib/db';

/**
 * Interface for token exchange response
 */
interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
}

/**
 * Start OAuth flow by generating authorization URL
 */
export async function initializeOAuthFlow(
  userId: string,
  providerId: string
): Promise<{ authUrl: string; state: string }> {
  // Get provider config
  const provider = getOAuthProviderConfig(providerId);
  if (!provider) {
    throw new Error(`Invalid provider: ${providerId}`);
  }

  // Generate state and code verifier (for PKCE if supported)
  const state = generateOAuthState();
  const codeVerifier = provider.pkce ? generateCodeVerifier() : undefined;

  // Store state and code verifier in database for verification during callback
  await prisma.oAuthState.create({
    data: {
      state,
      codeVerifier,
      userId,
      providerId,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes expiry
    },
  });

  // Build authorization URL
  const authUrl = buildAuthorizationUrl(providerId, state, codeVerifier);
  if (!authUrl) {
    throw new Error(`Failed to build authorization URL for provider: ${providerId}`);
  }

  return { authUrl, state };
}

/**
 * Handle OAuth callback and token exchange
 */
export async function handleOAuthCallback(
  providerId: string,
  code: string,
  state: string
): Promise<{ userId: string; integrationId: string }> {
  // Verify state parameter to prevent CSRF
  const storedState = await prisma.oAuthState.findUnique({
    where: { state },
  });

  if (!storedState) {
    throw new Error('Invalid state parameter');
  }

  if (storedState.expiresAt < new Date()) {
    await prisma.oAuthState.delete({ where: { state } });
    throw new Error('Authorization flow expired');
  }

  if (storedState.providerId !== providerId) {
    throw new Error('Provider ID mismatch');
  }

  // Get provider config
  const provider = getOAuthProviderConfig(providerId);
  if (!provider) {
    throw new Error(`Invalid provider: ${providerId}`);
  }

  try {
    // Exchange authorization code for access token
    const tokenResponse = await exchangeCodeForToken(provider, code, storedState.codeVerifier);

    // Calculate token expiration date
    const expiresAt = tokenResponse.expires_in
      ? new Date(Date.now() + tokenResponse.expires_in * 1000)
      : undefined;

    // Create or update integration record
    const integration = await prisma.integration.upsert({
      where: {
        userId_providerId: {
          userId: storedState.userId,
          providerId,
        },
      },
      create: {
        userId: storedState.userId,
        providerId,
        providerName: provider.name,
        providerCategory: provider.category,
        status: 'active',
        lastSyncedAt: null,
        token: {
          create: {
            accessToken: tokenResponse.access_token,
            refreshToken: tokenResponse.refresh_token,
            tokenType: tokenResponse.token_type,
            expiresAt,
            scopes: tokenResponse.scope,
          },
        },
      },
      update: {
        status: 'active',
        token: {
          upsert: {
            create: {
              accessToken: tokenResponse.access_token,
              refreshToken: tokenResponse.refresh_token,
              tokenType: tokenResponse.token_type,
              expiresAt,
              scopes: tokenResponse.scope,
            },
            update: {
              accessToken: tokenResponse.access_token,
              refreshToken: tokenResponse.refresh_token,
              tokenType: tokenResponse.token_type,
              expiresAt,
              scopes: tokenResponse.scope,
            },
          },
        },
      },
      include: {
        token: true,
      },
    });

    // Clean up state record
    await prisma.oAuthState.delete({ where: { state } });

    // Return user ID and integration ID for redirect
    return { userId: storedState.userId, integrationId: integration.id };
  } catch (error) {
    // Clean up state record even on error
    await prisma.oAuthState.delete({ where: { state } });
    throw error;
  }
}

/**
 * Exchange authorization code for access token
 */
async function exchangeCodeForToken(
  provider: ProviderConfig,
  code: string,
  codeVerifier?: string | null
): Promise<TokenResponse> {
  // Prepare request body/params based on authorization method
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: provider.redirectUri || `${process.env.NEXTAUTH_URL}/api/integrations/oauth/callback`,
  });

  // Add PKCE code verifier if provided
  if (provider.pkce && codeVerifier) {
    body.append('code_verifier', codeVerifier);
  }

  // Add client credentials based on authorization method
  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
  };

  if (provider.authorizationMethod === 'header') {
    // Basic auth header
    const credentials = Buffer.from(`${provider.clientId}:${provider.clientSecret}`).toString('base64');
    headers['Authorization'] = `Basic ${credentials}`;
  } else {
    // Include credentials in body
    body.append('client_id', provider.clientId);
    body.append('client_secret', provider.clientSecret);
  }

  // Make token exchange request
  const response = await fetch(provider.tokenUrl, {
    method: 'POST',
    headers,
    body,
  });

  if (!response.ok) {
    const errorData = await response.text();
    console.error('Token exchange failed:', errorData);
    throw new Error(`Token exchange failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Refresh OAuth access token when expired
 */
export async function refreshAccessToken(integrationId: string): Promise<void> {
  // Get integration with token
  const integration = await prisma.integration.findUnique({
    where: { id: integrationId },
    include: { token: true },
  });

  if (!integration || !integration.token) {
    throw new Error('Integration or token not found');
  }

  // Check if token needs refresh
  if (integration.token.expiresAt && integration.token.expiresAt > new Date()) {
    // Token still valid
    return;
  }

  if (!integration.token.refreshToken) {
    throw new Error('Refresh token not available');
  }

  // Get provider config
  const provider = getOAuthProviderConfig(integration.providerId);
  if (!provider) {
    throw new Error(`Invalid provider: ${integration.providerId}`);
  }

  // Prepare request for token refresh
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: integration.token.refreshToken,
  });

  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
  };

  if (provider.authorizationMethod === 'header') {
    // Basic auth header
    const credentials = Buffer.from(`${provider.clientId}:${provider.clientSecret}`).toString('base64');
    headers['Authorization'] = `Basic ${credentials}`;
  } else {
    // Include credentials in body
    body.append('client_id', provider.clientId);
    body.append('client_secret', provider.clientSecret);
  }

  // Make token refresh request
  const response = await fetch(provider.tokenUrl, {
    method: 'POST',
    headers,
    body,
  });

  if (!response.ok) {
    // Update integration status to indicate it needs attention
    await prisma.integration.update({
      where: { id: integrationId },
      data: { status: 'needs_attention' },
    });

    throw new Error(`Token refresh failed: ${response.status} ${response.statusText}`);
  }

  const tokenResponse: TokenResponse = await response.json();

  // Calculate new expiration date
  const expiresAt = tokenResponse.expires_in
    ? new Date(Date.now() + tokenResponse.expires_in * 1000)
    : undefined;

  // Update token in database
  await prisma.integrationToken.update({
    where: { integrationId },
    data: {
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token || integration.token.refreshToken,
      tokenType: tokenResponse.token_type || integration.token.tokenType,
      expiresAt,
      scopes: tokenResponse.scope || integration.token.scopes,
    },
  });

  // Update integration status
  await prisma.integration.update({
    where: { id: integrationId },
    data: { status: 'active' },
  });
}

/**
 * List all integrations for a user
 */
export async function getUserIntegrations(userId: string) {
  return prisma.integration.findMany({
    where: { userId },
    include: {
      token: {
        select: {
          expiresAt: true,
        },
      },
    },
  });
}

/**
 * Get details of a specific integration
 */
export async function getIntegrationDetails(integrationId: string) {
  return prisma.integration.findUnique({
    where: { id: integrationId },
    include: {
      token: {
        select: {
          expiresAt: true,
          scopes: true,
        },
      },
      syncHistory: {
        orderBy: {
          startedAt: 'desc',
        },
        take: 5,
      },
    },
  });
}

/**
 * Disconnect an integration
 */
export async function disconnectIntegration(integrationId: string): Promise<void> {
  // Get integration
  const integration = await prisma.integration.findUnique({
    where: { id: integrationId },
    include: { token: true },
  });

  if (!integration) {
    throw new Error('Integration not found');
  }

  // First delete the token record
  if (integration.token) {
    await prisma.integrationToken.delete({
      where: { integrationId },
    });
  }

  // Then delete sync history
  await prisma.integrationSync.deleteMany({
    where: { integrationId },
  });

  // Finally delete the integration
  await prisma.integration.delete({
    where: { id: integrationId },
  });
}

/**
 * Create a record of an integration sync attempt
 */
export async function recordSyncStart(integrationId: string) {
  return prisma.integrationSync.create({
    data: {
      integrationId,
      status: 'in_progress',
      startedAt: new Date(),
    },
  });
}

/**
 * Update a sync record with completion or error data
 */
export async function recordSyncCompletion(
  syncId: string, 
  success: boolean, 
  details?: any, 
  error?: string
) {
  return prisma.integrationSync.update({
    where: { id: syncId },
    data: {
      status: success ? 'success' : 'failed',
      completedAt: new Date(),
      details: details ? JSON.stringify(details) : undefined,
      error,
    },
  });
}

/**
 * Update the last synced timestamp for an integration
 */
export async function updateLastSyncedAt(integrationId: string) {
  return prisma.integration.update({
    where: { id: integrationId },
    data: {
      lastSyncedAt: new Date(),
    },
  });
}