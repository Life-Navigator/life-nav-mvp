'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

interface ResetPasswordFormProps {
  token: string;
}

export default function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  // Password validation
  const [passwordErrors, setPasswordErrors] = useState({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
    special: false,
    match: false,
  });

  const validatePassword = () => {
    const validations = {
      length: password.length >= 12,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /[0-9]/.test(password),
      special: /[^A-Za-z0-9]/.test(password),
      match: password === confirmPassword,
    };
    
    setPasswordErrors(validations);
    return Object.values(validations).every(Boolean);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    
    // Validate password requirements
    if (!validatePassword()) {
      setError('Please fix the password validation errors');
      return;
    }
    
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/password-reset/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token, password, confirmPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Something went wrong');
      }

      setMessage('Your password has been reset successfully. You will be redirected to the login page shortly.');
      
      // Reset the form
      setPassword('');
      setConfirmPassword('');
      
      // Redirect to login page after success
      setTimeout(() => {
        router.push('/auth/login');
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 py-8 px-4 shadow sm:rounded-lg sm:px-10">
      {message ? (
        <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/30 rounded-md">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-green-400 dark:text-green-300" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-green-800 dark:text-green-200">
                {message}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <form className="space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-200 text-sm rounded-md">
              {error}
            </div>
          )}

          {/* New Password */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              New Password
            </label>
            <div className="mt-1">
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (confirmPassword) {
                    validatePassword();
                  }
                }}
                className="appearance-none block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 dark:placeholder-gray-500 
                focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-blue-400 dark:focus:border-blue-400 
                bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 sm:text-sm"
              />
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Confirm Password
            </label>
            <div className="mt-1">
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (password) {
                    validatePassword();
                  }
                }}
                className="appearance-none block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 dark:placeholder-gray-500 
                focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-blue-400 dark:focus:border-blue-400 
                bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 sm:text-sm"
              />
            </div>
          </div>

          {/* Password Requirements */}
          <div className="space-y-2 text-xs text-gray-600 dark:text-gray-400">
            <p className="font-medium text-sm">Password Requirements:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
              <div className={`flex items-center ${passwordErrors.length ? 'text-green-600 dark:text-green-400' : ''}`}>
                <svg className={`h-4 w-4 mr-1.5 ${passwordErrors.length ? 'text-green-500 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'}`} fill="currentColor" viewBox="0 0 20 20">
                  {passwordErrors.length ? (
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  ) : (
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm-4-9h8a1 1 0 000-2H6a1 1 0 100 2z" clipRule="evenodd" />
                  )}
                </svg>
                At least 12 characters
              </div>
              <div className={`flex items-center ${passwordErrors.uppercase ? 'text-green-600 dark:text-green-400' : ''}`}>
                <svg className={`h-4 w-4 mr-1.5 ${passwordErrors.uppercase ? 'text-green-500 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'}`} fill="currentColor" viewBox="0 0 20 20">
                  {passwordErrors.uppercase ? (
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  ) : (
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm-4-9h8a1 1 0 000-2H6a1 1 0 100 2z" clipRule="evenodd" />
                  )}
                </svg>
                Include uppercase letter
              </div>
              <div className={`flex items-center ${passwordErrors.lowercase ? 'text-green-600 dark:text-green-400' : ''}`}>
                <svg className={`h-4 w-4 mr-1.5 ${passwordErrors.lowercase ? 'text-green-500 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'}`} fill="currentColor" viewBox="0 0 20 20">
                  {passwordErrors.lowercase ? (
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  ) : (
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm-4-9h8a1 1 0 000-2H6a1 1 0 100 2z" clipRule="evenodd" />
                  )}
                </svg>
                Include lowercase letter
              </div>
              <div className={`flex items-center ${passwordErrors.number ? 'text-green-600 dark:text-green-400' : ''}`}>
                <svg className={`h-4 w-4 mr-1.5 ${passwordErrors.number ? 'text-green-500 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'}`} fill="currentColor" viewBox="0 0 20 20">
                  {passwordErrors.number ? (
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  ) : (
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm-4-9h8a1 1 0 000-2H6a1 1 0 100 2z" clipRule="evenodd" />
                  )}
                </svg>
                Include number
              </div>
              <div className={`flex items-center ${passwordErrors.special ? 'text-green-600 dark:text-green-400' : ''}`}>
                <svg className={`h-4 w-4 mr-1.5 ${passwordErrors.special ? 'text-green-500 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'}`} fill="currentColor" viewBox="0 0 20 20">
                  {passwordErrors.special ? (
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  ) : (
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm-4-9h8a1 1 0 000-2H6a1 1 0 100 2z" clipRule="evenodd" />
                  )}
                </svg>
                Include special character
              </div>
              <div className={`flex items-center ${passwordErrors.match ? 'text-green-600 dark:text-green-400' : ''}`}>
                <svg className={`h-4 w-4 mr-1.5 ${passwordErrors.match ? 'text-green-500 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'}`} fill="currentColor" viewBox="0 0 20 20">
                  {passwordErrors.match ? (
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  ) : (
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm-4-9h8a1 1 0 000-2H6a1 1 0 100 2z" clipRule="evenodd" />
                  )}
                </svg>
                Passwords match
              </div>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white 
              ${isLoading ? 'bg-blue-400 dark:bg-blue-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-blue-400'}`}
            >
              {isLoading ? (
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                'Reset Password'
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}