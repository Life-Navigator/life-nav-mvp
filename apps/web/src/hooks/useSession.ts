import { useState, useEffect } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

/**
 * Supabase-based session hook.
 * Returns a next-auth compatible shape so existing consumers don't break.
 */
export function useSession(): {
  data: { user: User | null } | null;
  status: 'loading' | 'authenticated' | 'unauthenticated';
  update: () => Promise<any>;
} {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading');

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setStatus('unauthenticated');
      return;
    }

    supabase.auth.getUser().then(({ data: { user: u } }) => {
      setUser(u);
      setStatus(u ? 'authenticated' : 'unauthenticated');
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setStatus(session?.user ? 'authenticated' : 'unauthenticated');
    });

    return () => subscription.unsubscribe();
  }, []);

  return {
    data: user ? { user } : null,
    status,
    update: async () => {
      const supabase = getSupabaseClient();
      if (!supabase) return null;
      const { data } = await supabase.auth.refreshSession();
      return data;
    },
  };
}

export async function getCsrfToken(): Promise<string | undefined> {
  return undefined;
}

export async function getSession(): Promise<any> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session;
}

export function signIn(..._args: any[]) {
  return Promise.resolve(undefined);
}

export function signOut(..._args: any[]) {
  const supabase = getSupabaseClient();
  if (supabase) supabase.auth.signOut();
  return Promise.resolve(undefined);
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  return children;
}
