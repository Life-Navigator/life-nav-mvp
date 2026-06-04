'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { getSupabaseClient } from '@/lib/supabase/client';
import { trackAuthEvent } from '@/lib/analytics/auth-events';

/**
 * Passwordless sign-in for the invite-only beta. Sends a Supabase magic link
 * (signInWithOtp) that lands the user on /auth/confirm and into onboarding.
 * Also serves as the "resend link" flow. shouldCreateUser=false: only emails
 * that were already invited can request a link.
 */
export default function MagicLinkPanel({ initialEmail = '' }: { initialEmail?: string }) {
  const [email, setEmail] = useState(initialEmail);
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  const sendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('sending');
    setMessage(null);

    const supabase = getSupabaseClient();
    if (!supabase) {
      setStatus('error');
      setMessage('Authentication service is not configured.');
      return;
    }

    trackAuthEvent({ event: 'login_started', metadata: { method: 'magiclink' } });

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}/auth/confirm?next=/onboarding`,
      },
    });

    if (error) {
      trackAuthEvent({ event: 'login_error', error: error.message });
      setStatus('error');
      // Don't leak whether an email exists; rate-limit gets a friendly note.
      setMessage(
        /rate|limit|seconds/i.test(error.message)
          ? "You've requested a few links quickly. Please wait a minute and try again."
          : 'If that email was invited to the beta, a sign-in link is on its way.'
      );
      return;
    }

    trackAuthEvent({ event: 'login_success', metadata: { method: 'magiclink_sent' } });
    setStatus('sent');
  };

  if (status === 'sent') {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-8 border border-gray-200 dark:border-gray-700 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
          <span className="text-2xl">✉️</span>
        </div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Check your email</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          We sent a secure sign-in link to <span className="font-medium">{email}</span>. Click it on
          this device to continue. The link expires in 1 hour.
        </p>
        <button
          onClick={() => setStatus('idle')}
          className="mt-6 text-sm font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400"
        >
          Didn't get it? Send another link
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-8 border border-gray-200 dark:border-gray-700">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Sign in to LifeNavigator
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Enter your invited email and we&apos;ll send you a secure sign-in link — no password
          needed.
        </p>
      </div>

      {message && (
        <div
          className={`mb-4 p-3 text-sm rounded-md ${
            status === 'error'
              ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200'
              : 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200'
          }`}
        >
          {message}
        </div>
      )}

      <form onSubmit={sendLink} className="space-y-4">
        <div>
          <label
            htmlFor="ml-email"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Email address
          </label>
          <input
            id="ml-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={status === 'sending'}
            placeholder="you@example.com"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm
            focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
          />
        </div>
        <button
          type="submit"
          disabled={status === 'sending' || !email.trim()}
          className="w-full flex justify-center py-2 px-4 rounded-md shadow-sm text-sm font-medium text-white
          bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
          disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors"
        >
          {status === 'sending' ? 'Sending link…' : 'Send me a sign-in link'}
        </button>
      </form>

      <div className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
        Have a password?{' '}
        <Link
          href="/auth/login"
          className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400"
        >
          Sign in with password
        </Link>
      </div>
    </div>
  );
}
