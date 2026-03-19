'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabase/client';

function OAuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      // Check for errors from OAuth/email provider
      const errorParam = searchParams.get('error');
      const errorMessage = searchParams.get('error_description') || searchParams.get('message');

      if (errorParam) {
        setError(errorMessage || 'Authentication failed');
        return;
      }

      // With Supabase SSR, the auth code exchange happens automatically
      // via the Supabase client when it detects the hash fragment.
      // We just need to wait for the session to be established.
      const supabase = getSupabaseClient();
      if (!supabase) {
        setError('Auth service not configured');
        return;
      }

      // Check if we have a session (may take a moment for the code exchange)
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        setError(sessionError.message);
        return;
      }

      if (session) {
        // Full page reload to ensure middleware picks up the session cookies
        window.location.href = '/dashboard';
      } else {
        // Session not ready yet — the onAuthStateChange listener will catch it
        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange((event, s) => {
          if (event === 'SIGNED_IN' && s) {
            subscription.unsubscribe();
            window.location.href = '/dashboard';
          }
        });

        // Timeout after 10 seconds
        setTimeout(() => {
          subscription.unsubscribe();
          setError('Authentication timed out. Please try signing in again.');
        }, 10000);
      }
    };

    handleCallback();
  }, [searchParams, router]);

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

function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="max-w-md w-full space-y-8 p-8">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <h2 className="mt-6 text-2xl font-bold text-gray-900 dark:text-white">Loading...</h2>
        </div>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <OAuthCallbackContent />
    </Suspense>
  );
}
