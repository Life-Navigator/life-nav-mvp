import React from 'react';
import Link from 'next/link';
import { Metadata } from 'next';

// Metadata for the page
export const metadata: Metadata = {
  title: 'Authentication Error | Life Navigator',
  description: 'Authentication error occurred',
};

// Error page component
export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  // Get the error message from the URL query
  const params = await searchParams;
  const errorMessage = getErrorMessage(params.error);

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
            Authentication Error
          </h2>
        </div>
        
        {/* Error Message */}
        <div className="bg-red-50 dark:bg-red-900/30 p-4 rounded-md mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                Authentication Failed
              </h3>
              <div className="mt-2 text-sm text-red-700 dark:text-red-300">
                <p>{errorMessage}</p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex flex-col gap-4">
          <Link
            href="/auth/login"
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Return to Login
          </Link>
          
          <Link
            href="/"
            className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Go to Homepage
          </Link>
        </div>
        
        {/* Help text */}
        <div className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
          <p>
            Need help? <a href="mailto:support@lifenavigator.com" className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300">Contact Support</a>
          </p>
        </div>
      </div>
    </div>
  );
}

// Helper function to get user-friendly error messages
function getErrorMessage(errorCode?: string): string {
  switch (errorCode) {
    case 'CredentialsSignin':
      return 'The email or password you entered is incorrect.';
    case 'OAuthAccountNotLinked':
      return 'To confirm your identity, sign in with the same account you used originally.';
    case 'EmailSignin':
      return 'The email sign-in link is invalid or has expired.';
    case 'SessionRequired':
      return 'You must be signed in to access this page.';
    case 'Verification':
      return 'The verification link is invalid or has expired.';
    case 'AccessDenied':
      return 'You do not have permission to access this resource.';
    case 'Default':
    default:
      return 'An unexpected authentication error occurred. Please try again later.';
  }
}