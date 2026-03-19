// lib/api/integrations.ts
import { ConnectedService, SyncStatusResponse, SyncNowResponse } from '@/types/integration';

/**
 * Initiates the OAuth flow for a provider
 * @param providerId The ID of the provider to connect
 * @returns The OAuth URL to redirect the user to
 */
export async function initiateOAuth(providerId: string): Promise<string> {
  const response = await fetch(`/api/integrations/oauth/init`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ providerId }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to initiate OAuth flow');
  }

  const data = await response.json();
  return data.authUrl;
}

/**
 * Fetches all connected services for the current user
 * @returns Array of connected services
 */
export async function fetchConnectedServices(): Promise<ConnectedService[]> {
  const response = await fetch('/api/integrations/services');

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch connected services');
  }

  return response.json();
}

/**
 * Disconnects a service from the user's account
 * @param serviceId The ID of the service to disconnect
 */
export async function disconnectService(serviceId: string): Promise<void> {
  const response = await fetch(`/api/integrations/services/${serviceId}/disconnect`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to disconnect service');
  }
}

/**
 * Triggers a refresh of all connected services
 */
export async function refreshServices(): Promise<void> {
  const response = await fetch('/api/integrations/refresh', {
    method: 'POST',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to refresh services');
  }
}

/**
 * Gets the current sync status including per-source details and GraphRAG queue stats
 */
export async function getSyncStatus(): Promise<SyncStatusResponse> {
  const response = await fetch('/api/integrations/sync-status');

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to get sync status');
  }

  return response.json();
}

/**
 * Manually triggers a sync for a specific provider/type
 * @param provider The provider to sync (e.g., "google", "microsoft")
 * @param type The sync type: "email" or "calendar"
 */
export async function triggerSyncNow(
  provider: string,
  type: 'email' | 'calendar'
): Promise<SyncNowResponse> {
  const response = await fetch('/api/integrations/sync-now', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ provider, type }),
  });

  const data = await response.json();

  if (!response.ok) {
    if (response.status === 429) {
      return { success: false, error: data.error, retryAfterSeconds: data.retryAfterSeconds };
    }
    throw new Error(data.error || 'Failed to trigger sync');
  }

  return data;
}

/**
 * Refreshes the access token for a specific integration
 * @param integrationId The ID of the integration to refresh
 */
export async function refreshToken(integrationId: string): Promise<void> {
  const response = await fetch('/api/integrations/token/refresh', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ integrationId }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to refresh token');
  }

  return response.json();
}
