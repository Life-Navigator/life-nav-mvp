'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabase/client';
import { trackAuthEvent } from '@/lib/analytics/auth-events';

export default function OAuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setError('Authentication service is not configured.');
      return;
    }

    // Supabase automatically exchanges the code/hash for a session.
    // We just need to wait for the session to be established, then redirect.
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN') {
        trackAuthEvent({ event: 'oauth_callback_success', userId: session?.user?.id });
        router.push('/dashboard');
        router.refresh();
      }
    });

    // Also check if session already exists (code exchange may have completed)
    supabase.auth.getSession().then(({ data: { session }, error: sessionError }) => {
      if (sessionError) {
        trackAuthEvent({ event: 'oauth_callback_error', error: sessionError.message });
        setError(sessionError.message);
      } else if (session) {
        router.push('/dashboard');
        router.refresh();
      }
    });
  }, [router]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="max-w-md w-full space-y-8 p-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-red-600">Authentication Failed</h2>
            <p className="mt-2 text-gray-600 dark:text-gray-400">{error}</p>
            <button
              onClick={() => router.push('/auth/login')}
              className="mt-6 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Return to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="max-w-md w-full space-y-8 p-8">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <h2 className="mt-6 text-2xl font-bold text-gray-900 dark:text-white">
            Completing authentication...
          </h2>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Please wait while we set up your session.
          </p>
        </div>
      </div>
    </div>
  );
}
