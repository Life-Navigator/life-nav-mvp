import React from 'react';
import Link from 'next/link';
import { Metadata } from 'next';
import ForgotPasswordForm from '@/components/auth/ForgotPasswordForm';

// Metadata for the page
export const metadata: Metadata = {
  title: 'Forgot Password | Life Navigator',
  description: 'Request a password reset for your Life Navigator account',
};

export default function ForgotPasswordPage() {
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
            Forgot Password?
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Enter your email and we'll send you a link to reset your password
          </p>
        </div>
        
        {/* Forgot Password Form */}
        <ForgotPasswordForm />

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-600 dark:text-gray-400">
          <p>
            Remember your password?{' '}
            <Link 
              href="/auth/login" 
              className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}