'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function OAuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(true);

  useEffect(() => {
    const handleOAuthCallback = async () => {
      try {
        // Check for errors from OAuth provider
        const errorParam = searchParams.get('error');
        const errorMessage = searchParams.get('message');

        if (errorParam) {
          setError(errorMessage || 'OAuth authentication failed');
          setIsProcessing(false);
          return;
        }

        // Extract tokens from URL
        const accessToken = searchParams.get('access_token');
        const refreshToken = searchParams.get('refresh_token');
        const tokenType = searchParams.get('token_type');

        if (!accessToken || !refreshToken) {
          setError('Missing authentication tokens');
          setIsProcessing(false);
          return;
        }

        // Store tokens in localStorage
        localStorage.setItem('access_token', accessToken);
        localStorage.setItem('refresh_token', refreshToken);
        localStorage.setItem('token_type', tokenType || 'bearer');

        // Set httpOnly cookie via API route
        const cookieResponse = await fetch('/api/auth/set-cookie', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            access_token: accessToken,
            refresh_token: refreshToken,
          }),
        });

        if (!cookieResponse.ok) {
          console.error('Failed to set cookie, but continuing anyway');
        }

        // Redirect to dashboard
        router.push('/dashboard');
      } catch (err) {
        console.error('OAuth callback error:', err);
        setError('An unexpected error occurred during authentication');
        setIsProcessing(false);
      }
    };

    handleOAuthCallback();
  }, [searchParams, router]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full space-y-8 p-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-red-600">
              Authentication Failed
            </h2>
            <p className="mt-2 text-gray-600">{error}</p>
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
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <h2 className="mt-6 text-2xl font-bold text-gray-900">
            {isProcessing ? 'Completing authentication...' : 'Redirecting...'}
          </h2>
          <p className="mt-2 text-gray-600">
            Please wait while we set up your session.
          </p>
        </div>
      </div>
    </div>
  );
}
