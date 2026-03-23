import React from 'react';
import Link from 'next/link';
import { Metadata } from 'next';
import ResetPasswordForm from '@/components/auth/ResetPasswordForm';

export const metadata: Metadata = {
  title: 'Reset Password | Life Navigator',
  description: 'Reset your Life Navigator account password',
};

/**
 * Supabase sends the user here with a hash fragment containing the recovery token.
 * The Supabase client automatically exchanges it for a session.
 * ResetPasswordForm then calls supabase.auth.updateUser({ password }).
 */
export default function PasswordResetPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center space-x-2">
            <img src="/LifeNavigator.png" alt="LifeNavigator Logo" className="w-10 h-10" />
            <span className="text-2xl font-bold text-gray-900 dark:text-white">LifeNavigator</span>
          </Link>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900 dark:text-white">
            Reset Your Password
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Enter your new password below
          </p>
        </div>

        <ResetPasswordForm />

        <div className="mt-8 text-center text-sm text-gray-600 dark:text-gray-400">
          <Link
            href="/auth/login"
            className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
          >
            Return to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
