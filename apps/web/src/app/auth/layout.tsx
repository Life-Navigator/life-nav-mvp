import React from 'react';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Authentication | Life Navigator',
  description: 'Sign in or create an account for Life Navigator',
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      {children}
    </div>
  );
}