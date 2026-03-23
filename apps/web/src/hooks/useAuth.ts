import { useState, useEffect } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';

interface UseAuthReturn {
  isAuthenticated: boolean;
  isLoading: boolean;
  token: string | null;
}

/**
 * Module-level token cache so getAuthHeaders() can work synchronously.
 * Updated by any mounted useAuth() hook and onAuthStateChange listener.
 */
let cachedToken: string | null = null;

/**
 * Hook for Supabase authentication state.
 * Drop-in replacement for the old localStorage-based hook.
 */
export function useAuth(): UseAuthReturn {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      cachedToken = session?.access_token ?? null;
      setToken(cachedToken);
      setIsAuthenticated(!!session);
      setIsLoading(false);
    });

    // Listen for auth state changes (login, logout, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      cachedToken = session?.access_token ?? null;
      setToken(cachedToken);
      setIsAuthenticated(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  return { isAuthenticated, isLoading, token };
}

/**
 * Synchronous helper for API request headers.
 * Uses the cached Supabase access token.
 */
export function getAuthHeaders(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    ...(cachedToken && { Authorization: `Bearer ${cachedToken}` }),
  };
}
