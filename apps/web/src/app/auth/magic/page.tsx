import React from 'react';
import Link from 'next/link';
import { Metadata } from 'next';
import MagicLinkPanel from '@/components/auth/MagicLinkPanel';

export const metadata: Metadata = {
  title: 'Sign in | Life Navigator',
  description: 'Passwordless sign-in for the Life Navigator beta',
};

export const dynamic = 'force-dynamic';

export default async function MagicLinkPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; expired?: string }>;
}) {
  const params = await searchParams;
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center space-x-2">
            <img src="/LifeNavigator.png" alt="LifeNavigator Logo" className="w-10 h-10" />
            <span className="text-2xl font-bold text-gray-900 dark:text-white">LifeNavigator</span>
          </Link>
        </div>

        {params?.expired === 'true' && (
          <div className="mb-4 p-3 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 text-sm rounded-md">
            That sign-in link has expired or was already used. Enter your email below and we&apos;ll
            send you a fresh one.
          </div>
        )}

        <MagicLinkPanel initialEmail={params?.email ?? ''} />
      </div>
    </div>
  );
}
