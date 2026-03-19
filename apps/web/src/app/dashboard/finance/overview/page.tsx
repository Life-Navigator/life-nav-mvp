'use client';

import { Suspense } from 'react';
import { AccountsSummary } from '@/components/domain/finance/overview/AccountsSummary';
import { SpendingTrends } from '@/components/domain/finance/overview/SpendingTrends';
import { UpcomingBills } from '@/components/domain/finance/overview/UpcomingBills';
import { FinancialInsights } from '@/components/domain/finance/overview/FinancialInsights';
import { CashFlow } from '@/components/domain/finance/overview/CashFlow';
import { LoadingSpinner } from '@/components/ui/loaders/LoadingSpinner';
import Link from 'next/link';

export default function OverviewPage() {
  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-start mb-6">
        <h1 className="text-2xl font-bold">Financial Overview</h1>
        <Link
          href="/dashboard/integrations"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          Connect Bank Account
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Suspense fallback={<LoadingSpinner />}>
          <AccountsSummary />
        </Suspense>

        <Suspense fallback={<LoadingSpinner />}>
          <SpendingTrends />
        </Suspense>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Suspense fallback={<LoadingSpinner />}>
          <UpcomingBills />
        </Suspense>

        <Suspense fallback={<LoadingSpinner />}>
          <CashFlow />
        </Suspense>

        <Suspense fallback={<LoadingSpinner />}>
          <FinancialInsights />
        </Suspense>
      </div>
    </div>
  );
}
