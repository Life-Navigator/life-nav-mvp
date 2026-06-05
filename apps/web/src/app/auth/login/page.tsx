import React from 'react';
import LoginForm from '@/components/auth/LoginForm';
import AuthShell from '@/components/auth/AuthShell';
import Link from 'next/link';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign In | LifeNavigator',
  description: 'Sign in to your LifeNavigator account',
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
  const params = await searchParams;
  const justRegistered = params?.registered === 'true';
  const authError = params?.error
    ? (AUTH_ERROR_MESSAGES[params.error] ?? 'Sign-in failed. Please request a new link below.')
    : null;
  const resendHref = `/auth/magic${params?.email ? `?expired=true&email=${encodeURIComponent(params.email)}` : '?expired=true'}`;

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to your decision-intelligence dashboard."
      footer={
        <>
          <p>
            Don&apos;t have an account?{' '}
            <Link href="/auth/register" className="font-medium text-[#5eead4] hover:underline">
              Create one
            </Link>
          </p>
          <p className="mt-3 text-xs text-white/35">
            By signing in, you agree to our{' '}
            <Link href="/legal/terms" className="text-white/55 hover:text-white">
              Terms
            </Link>{' '}
            and{' '}
            <Link href="/legal/privacy" className="text-white/55 hover:text-white">
              Privacy Policy
            </Link>
            .
          </p>
        </>
      }
    >
      {justRegistered && (
        <div className="mb-5 rounded-xl border border-[#2dd4bf]/25 bg-[#2dd4bf]/10 p-3 text-sm text-[#a7f3e4]">
          Account created successfully! Please sign in with your credentials.
        </div>
      )}

      {authError && (
        <div className="mb-5 rounded-xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm text-amber-100">
          <p>{authError}</p>
          <Link
            href={resendHref}
            className="mt-2 inline-block font-semibold text-amber-50 underline"
          >
            Request a new sign-in link →
          </Link>
        </div>
      )}

      <div className="mb-5 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-center text-sm">
        <Link href="/auth/magic" className="font-medium text-[#5eead4] hover:underline">
          Beta user? Sign in with a magic link instead →
        </Link>
      </div>

      <LoginForm />
    </AuthShell>
  );
}
