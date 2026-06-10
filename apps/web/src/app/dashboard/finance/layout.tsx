'use client';

import React, { ReactNode } from 'react';
import { FinanceSidebar } from '@/components/domain/finance/FinanceSidebar';
import { FinanceDataProvider } from '@/components/domain/finance/FinanceDataContext';

interface FinanceLayoutProps {
  children: ReactNode;
}

export default function FinanceLayout({ children }: FinanceLayoutProps) {
  // Provider here means canonical summary + analytics are fetched ONCE for the whole finance section
  // (sidebar + page + overview widgets all consume it) instead of each component fetching its own.
  return (
    <FinanceDataProvider>
      <div className="flex h-full bg-gray-50 dark:bg-gray-900">
        {/* Finance Sidebar */}
        <FinanceSidebar />

        {/* Main content */}
        <div className="flex-1 overflow-auto">{children}</div>
      </div>
    </FinanceDataProvider>
  );
}
