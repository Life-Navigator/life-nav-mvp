'use client';

import { useEffect, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';
import type { Session } from '@supabase/supabase-js';

type SessionStatus = 'loading' | 'authenticated' | 'unauthenticated';

export function useSession(): {
  data: Session | null;
  status: SessionStatus;
  update: () => Promise<Session | null>;
} {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<SessionStatus>('loading');

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setStatus('unauthenticated');
      return;
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setStatus(s ? 'authenticated' : 'unauthenticated');
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setStatus(s ? 'authenticated' : 'unauthenticated');
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const update = async (): Promise<Session | null> => {
    const supabase = getSupabaseClient();
    if (!supabase) return null;
    const { data } = await supabase.auth.refreshSession();
    setSession(data.session);
    setStatus(data.session ? 'authenticated' : 'unauthenticated');
    return data.session;
  };

  return { data: session, status, update };
}

// Keep these exports for backward compatibility with imports
export async function getCsrfToken(): Promise<string | undefined> {
  return undefined;
}

export async function getSession(): Promise<Session | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function signIn(email: string, password: string) {
  const supabase = getSupabaseClient();
  if (!supabase) return undefined;
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const supabase = getSupabaseClient();
  if (!supabase) return;
  await supabase.auth.signOut();
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  return children;
}
