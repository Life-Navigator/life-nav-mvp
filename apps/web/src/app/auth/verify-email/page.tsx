import React from 'react';
import EmailVerification from '@/components/auth/EmailVerification';
import Link from 'next/link';
import { Metadata } from 'next';

// Metadata for the page
export const metadata: Metadata = {
  title: 'Verify Email | Life Navigator',
  description: 'Verify your Life Navigator account email address',
};

export default function VerifyEmailPage() {
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
            Verify Your Email
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Please wait while we verify your email address
          </p>
        </div>

        {/* Email Verification Component */}
        <EmailVerification />

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-600 dark:text-gray-400">
          <p>
            Need help?{' '}
            <Link
              href="/contact"
              className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
            >
              Contact Support
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
