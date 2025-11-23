'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';

type VerificationState = 'loading' | 'success' | 'error' | 'missing-token';

function EmailVerificationContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [state, setState] = useState<VerificationState>('loading');
  const [message, setMessage] = useState<string>('');
  const [countdown, setCountdown] = useState<number>(5);

  useEffect(() => {
    const token = searchParams.get('token');

    if (!token) {
      setState('missing-token');
      setMessage('No verification token provided. Please check your email for the verification link.');
      return;
    }

    verifyEmail(token);
  }, [searchParams]);

  useEffect(() => {
    // Countdown timer for redirect after success
    if (state === 'success' && countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (state === 'success' && countdown === 0) {
      router.push('/auth/login');
    }
  }, [state, countdown, router]);

  const verifyEmail = async (token: string) => {
    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000/api/v1';

      const response = await fetch(`${apiBaseUrl}/auth/verify-email?token=${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const contentType = response.headers.get('content-type');
      let data;

      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        console.error('Non-JSON response from verify-email:', text);
        throw new Error('Server returned an invalid response. Please try again.');
      }

      if (response.ok && data.success) {
        setState('success');
        setMessage(data.message || 'Email verified successfully! Redirecting to login...');
      } else {
        setState('error');
        setMessage(data.detail || data.message || 'Failed to verify email. Please try again.');
      }
    } catch (error) {
      console.error('Email verification error:', error);
      setState('error');
      setMessage(
        error instanceof Error
          ? error.message
          : 'An unexpected error occurred. Please try again or contact support.'
      );
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-8">
      {state === 'loading' && (
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">
            Verifying your email address...
          </p>
        </div>
      )}

      {state === 'success' && (
        <div className="text-center">
          <CheckCircleIcon className="mx-auto h-16 w-16 text-green-500" />
          <h3 className="mt-4 text-xl font-semibold text-gray-900 dark:text-white">
            Email Verified!
          </h3>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            {message}
          </p>
          <p className="mt-4 text-sm text-gray-500 dark:text-gray-500">
            Redirecting to login in {countdown} seconds...
          </p>
          <button
            onClick={() => router.push('/auth/login')}
            className="mt-6 w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            Go to Login Now
          </button>
        </div>
      )}

      {state === 'error' && (
        <div className="text-center">
          <XCircleIcon className="mx-auto h-16 w-16 text-red-500" />
          <h3 className="mt-4 text-xl font-semibold text-gray-900 dark:text-white">
            Verification Failed
          </h3>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            {message}
          </p>
          <div className="mt-6 space-y-3">
            <button
              onClick={() => router.push('/auth/register')}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-blue-500 dark:hover:bg-blue-600"
            >
              Register Again
            </button>
            <button
              onClick={() => router.push('/auth/login')}
              className="w-full flex justify-center py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Back to Login
            </button>
          </div>
        </div>
      )}

      {state === 'missing-token' && (
        <div className="text-center">
          <XCircleIcon className="mx-auto h-16 w-16 text-yellow-500" />
          <h3 className="mt-4 text-xl font-semibold text-gray-900 dark:text-white">
            Invalid Verification Link
          </h3>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            {message}
          </p>
          <button
            onClick={() => router.push('/auth/register')}
            className="mt-6 w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            Register Now
          </button>
        </div>
      )}
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-8">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400"></div>
        <p className="mt-4 text-gray-600 dark:text-gray-400">
          Loading...
        </p>
      </div>
    </div>
  );
}

export default function EmailVerification() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <EmailVerificationContent />
    </Suspense>
  );
}
