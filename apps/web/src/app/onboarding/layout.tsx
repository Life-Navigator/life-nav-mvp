import React from 'react';
import Link from 'next/link';
import { Metadata } from 'next';
import { Mark } from '@/components/brand/Logo';
import ParallaxBackdrop from '@/components/site/ParallaxBackdrop';

export const metadata: Metadata = {
  title: 'Set up your account · LifeNavigator',
  description: 'Set up your personalized LifeNavigator account',
};

/**
 * Onboarding shares the auth experience's dark, editorial brand system so the
 * hand-off from email verification straight into onboarding is seamless — the
 * user can't tell where authentication ends and onboarding begins.
 */
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen bg-[#06060a] text-white antialiased">
      <ParallaxBackdrop />
      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-6 sm:px-6">
        <Link href="/" className="inline-flex items-center gap-2">
          <Mark className="h-8 w-8" size={32} />
          <span className="text-lg font-semibold tracking-tight">LifeNavigator</span>
        </Link>
        <div className="flex-1 py-8">{children}</div>
      </div>
    </div>
  );
}
