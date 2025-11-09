import React from 'react';
import LoginForm from '@/components/auth/LoginForm';
import Link from 'next/link';
import { Metadata } from 'next';

// Metadata for the page
export const metadata: Metadata = {
  title: 'Sign In | Life Navigator',
  description: 'Sign in to your Life Navigator account',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ registered?: string }>;
}) {
  // Await searchParams (Next.js 15 requires async access)
  const params = await searchParams;
  const justRegistered = params?.registered === 'true';
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md">
        {/* Logo/Branding */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center space-x-2">
            <img 
              src="/LifeNavigator.png" 
              alt="LifeNavigator Logo" 
              className="w-10 h-10" 
            />
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