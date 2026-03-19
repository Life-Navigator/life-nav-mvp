'use client';

import { useState, useEffect } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';

interface UseAuthReturn {
  isAuthenticated: boolean;
  isLoading: boolean;
  token: string | null;
}

/**
 * Auth hook backed by Supabase session.
 * Returns isAuthenticated/isLoading for backward compat with existing pages.
 * Does NOT redirect — middleware handles that.
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

    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAuthenticated(!!session);
      setToken(session?.access_token ?? null);
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session);
      setToken(session?.access_token ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return { isAuthenticated, isLoading, token };
}

/**
 * Auth headers helper — Supabase cookies are sent automatically on same-origin
 * fetch, so this just returns Content-Type. Kept for backward compat.
 */
export function getAuthHeaders(): HeadersInit {
  return { 'Content-Type': 'application/json' };
}
