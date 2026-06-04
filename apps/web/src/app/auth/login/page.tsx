import React from 'react';
import LoginForm from '@/components/auth/LoginForm';
import Link from 'next/link';
import { Metadata } from 'next';

// Metadata for the page
export const metadata: Metadata = {
  title: 'Sign In | Life Navigator',
  description: 'Sign in to your Life Navigator account',
};

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  link_expired:
    'That sign-in link has expired or was already used. Request a fresh link below — it only takes a second.',
  confirmation_failed:
    "We couldn't verify that link. Request a new sign-in link below and try again.",
  invalid_confirmation_link: 'That link was incomplete. Request a fresh sign-in link below.',
  auth_not_configured: 'Sign-in is temporarily unavailable. Please try again shortly.',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ registered?: string; error?: string; email?: string }>;
}) {
  // Await searchParams (Next.js 15 requires async access)
  const params = await searchParams;
  const justRegistered = params?.registered === 'true';
  const authError = params?.error
    ? (AUTH_ERROR_MESSAGES[params.error] ?? 'Sign-in failed. Please request a new link below.')
    : null;
  const resendHref = `/auth/magic${params?.email ? `?expired=true&email=${encodeURIComponent(params.email)}` : '?expired=true'}`;
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md">
        {/* Logo/Branding */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center space-x-2">
            <img src="/LifeNavigator.png" alt="LifeNavigator Logo" className="w-10 h-10" />
            <span className="text-2xl font-bold text-gray-900 dark:text-white">LifeNavigator</span>
          </Link>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900 dark:text-white">
            Sign in to your account
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Or{' '}
            <Link
              href="/auth/register"
              className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
            >
              create a new account
            </Link>
          </p>
        </div>

        {/* Success message for newly registered users */}
        {justRegistered && (
          <div className="mb-4 p-3 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 text-sm rounded-md">
            Account created successfully! Please sign in with your credentials.
          </div>
        )}

        {/* Friendly expired/invalid link handling → offer a fresh magic link */}
        {authError && (
          <div className="mb-4 p-4 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 text-sm rounded-md">
            <p>{authError}</p>
            <Link
              href={resendHref}
              className="mt-2 inline-block font-semibold text-amber-900 dark:text-amber-100 underline"
            >
              Request a new sign-in link →
            </Link>
          </div>
        )}

        {/* Beta: passwordless is the primary path */}
        <div className="mb-4 text-center">
          <Link
            href="/auth/magic"
            className="text-sm font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
          >
            Beta user? Sign in with a magic link instead →
          </Link>
        </div>

        {/* Login Form */}
        <LoginForm />

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-600 dark:text-gray-400">
          <p>
            By signing in, you agree to our{' '}
            <Link
              href="/terms"
              className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
            >
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link
              href="/privacy"
              className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
            >
              Privacy Policy
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
