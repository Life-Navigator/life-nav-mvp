/**
 * User Sync Hook
 *
 * Provides seamless access to user data across all three databases:
 * - Supabase (auth + profiles)
 * - Prisma (frontend database)
 * - Backend Cloud SQL (API database)
 *
 * This hook:
 * 1. Automatically ensures user is synced on first load
 * 2. Provides backend user ID and tenant ID for API calls
 * 3. Caches user mapping for performance
 * 4. Handles sync failures gracefully
 */

import { useEffect, useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

interface BackendUserInfo {
  backendUserId: string;
  tenantId: string;
  organizationId: string;
  email: string;
  displayName?: string;
  pilotRole?: string;
  pilotEnabled?: boolean;
}

interface UserSyncState {
  isLoading: boolean;
  isSynced: boolean;
  error: string | null;
  supabaseUserId: string | null;
  backendUser: BackendUserInfo | null;
}

interface UserSyncResult extends UserSyncState {
  sync: () => Promise<void>;
  getBackendHeaders: () => Record<string, string>;
}

const SYNC_CACHE_KEY = 'user-sync';

/**
 * Hook to manage user synchronization across databases.
 */
export function useUserSync(): UserSyncResult {
  const supabase = createClientComponentClient();
  const queryClient = useQueryClient();
  const [supabaseUserId, setSupabaseUserId] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  // Get Supabase session
  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setSupabaseUserId(session.user.id);
        setAccessToken(session.access_token);
      }
    };

    getSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          setSupabaseUserId(session.user.id);
          setAccessToken(session.access_token);
          // Invalidate sync cache on auth change
          queryClient.invalidateQueries({ queryKey: [SYNC_CACHE_KEY] });
        } else {
          setSupabaseUserId(null);
          setAccessToken(null);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase, queryClient]);

  // Query to check/ensure sync
  const {
    data: backendUser,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: [SYNC_CACHE_KEY, supabaseUserId],
    queryFn: async (): Promise<BackendUserInfo | null> => {
      if (!supabaseUserId) return null;

      // First, try to look up the user
      const lookupResponse = await fetch(`/api/user-sync?lookup=${supabaseUserId}`, {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      });

      if (lookupResponse.ok) {
        const data = await lookupResponse.json();
        if (data.exists && data.backend_user_id) {
          return {
            backendUserId: data.backend_user_id,
            tenantId: data.tenant_id,
            organizationId: data.organization_id,
            email: data.email,
            displayName: data.display_name,
            pilotRole: data.pilot_role,
            pilotEnabled: data.pilot_enabled,
          };
        }
      }

      // User doesn't exist in backend, sync them
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const syncResponse = await fetch('/api/user-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          supabase_user_id: supabaseUserId,
          email: user.email,
          display_name: user.user_metadata?.display_name,
          user_type: user.user_metadata?.user_type || 'CIVILIAN',
        }),
      });

      if (!syncResponse.ok) {
        const errorData = await syncResponse.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to sync user');
      }

      const syncData = await syncResponse.json();
      return {
        backendUserId: syncData.backend_user_id,
        tenantId: syncData.tenant_id,
        organizationId: syncData.organization_id,
        email: user.email || '',
        displayName: user.user_metadata?.display_name,
      };
    },
    enabled: !!supabaseUserId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
  });

  const sync = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const getBackendHeaders = useCallback((): Record<string, string> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    if (backendUser?.tenantId) {
      headers['X-Tenant-ID'] = backendUser.tenantId;
    }

    return headers;
  }, [accessToken, backendUser]);

  return {
    isLoading,
    isSynced: !!backendUser,
    error: error ? (error as Error).message : null,
    supabaseUserId,
    backendUser,
    sync,
    getBackendHeaders,
  };
}

/**
 * Hook to get the backend user ID for API calls.
 * Returns null if not synced.
 */
export function useBackendUserId(): string | null {
  const { backendUser } = useUserSync();
  return backendUser?.backendUserId ?? null;
}

/**
 * Hook to get the tenant ID for API calls.
 * Returns null if not synced.
 */
export function useTenantId(): string | null {
  const { backendUser } = useUserSync();
  return backendUser?.tenantId ?? null;
}

/**
 * Hook to check if user has pilot access.
 */
export function usePilotAccess(): {
  hasPilotAccess: boolean;
  pilotRole: string | null;
  isLoading: boolean;
} {
  const { backendUser, isLoading } = useUserSync();

  return {
    hasPilotAccess: backendUser?.pilotEnabled ?? false,
    pilotRole: backendUser?.pilotRole ?? null,
    isLoading,
  };
}

/**
 * Provider component that ensures user sync on mount.
 * Wrap your app with this to auto-sync users.
 */
export function UserSyncProvider({ children }: { children: React.ReactNode }) {
  const { isLoading, error, sync } = useUserSync();

  useEffect(() => {
    // Auto-sync on mount
    sync();
  }, [sync]);

  // You could show a loading state here if needed
  // For now, we just render children

  return <>{children}</>;
}
