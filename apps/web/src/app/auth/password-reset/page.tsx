import React from 'react';
import Link from 'next/link';
import { Metadata } from 'next';
import ResetPasswordForm from '@/components/auth/ResetPasswordForm';

// Metadata for the page
export const metadata: Metadata = {
  title: 'Reset Password | Life Navigator',
  description: 'Reset your Life Navigator account password',
};

export default function PasswordResetPage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  // Get the token from the URL
  const token = searchParams?.token || '';

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
            Reset Your Password
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Enter your new password below
          </p>
        </div>
        
        {/* Reset Password Form */}
        {token ? (
          <ResetPasswordForm token={token} />
        ) : (
          <div className="bg-yellow-50 dark:bg-yellow-900/30 p-4 rounded-md text-yellow-800 dark:text-yellow-200">
            <p className="text-sm">
              No reset token provided. Please use the link from your email or request a new password reset.
            </p>
            <Link 
              href="/auth/forgot-password" 
              className="mt-3 inline-block font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
            >
              Request a new password reset link
            </Link>
          </div>
        )}

        {/* Footer */}
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