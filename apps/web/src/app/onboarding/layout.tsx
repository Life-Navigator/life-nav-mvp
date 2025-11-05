import React from 'react';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Onboarding | Life Navigator',
  description: 'Set up your personalized Life Navigator account',
};

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-gray-50 dark:bg-gray-900 min-h-screen">
      <div className="flex flex-col items-center justify-center">
        <div className="w-full max-w-6xl py-6">
          <div className="flex justify-center mb-6">
            <h1 className="text-3xl font-bold text-blue-600 dark:text-blue-400">Life Navigator</h1>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}