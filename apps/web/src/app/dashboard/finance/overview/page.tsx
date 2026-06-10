// FILE: src/app/dashboard/finance/overview/page.tsx
'use client';

import { Suspense } from 'react';
import { AccountsSummary } from '@/components/domain/finance/overview/AccountsSummary';
import { SpendingTrends } from '@/components/domain/finance/overview/SpendingTrends';
import { UpcomingBills } from '@/components/domain/finance/overview/UpcomingBills';
import { FinancialInsights } from '@/components/domain/finance/overview/FinancialInsights';
import { CashFlow } from '@/components/domain/finance/overview/CashFlow';
import { LoadingSpinner } from '@/components/ui/loaders/LoadingSpinner';
import { useFinanceData } from '@/components/domain/finance/FinanceDataContext';

// All four headline tiles read the shared finance context (one canonical-summary fetch for the whole
// section). Total Assets / Liabilities / Net Worth come from the canonical summary; Monthly Cash Flow
// comes from the backend analytics (net_cash_flow) — never a frontend transaction sum (Rule 1).
const money = (n: number | null | undefined) =>
  n == null
    ? '—'
    : `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function OverviewPage() {
  const fin = useFinanceData();
  const loading = fin?.summaryStatus === 'loading';
  const summary = fin?.summary as
    | { total_assets?: number; total_debt?: number; net_worth?: number }
    | undefined;
  const netCashFlow = fin?.analytics?.cash_flow?.net_cash_flow as number | null | undefined;

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-2xl font-bold mb-6">Financial Overview</h1>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
        <Tile title="Total Assets" loading={loading} value={money(summary?.total_assets)} />
        <Tile title="Total Liabilities" loading={loading} value={money(summary?.total_debt)} />
        <Tile title="Net Worth" loading={loading} value={money(summary?.net_worth)} />
        <Tile
          title="Monthly Cash Flow"
          loading={fin?.analyticsStatus === 'loading'}
          value={
            netCashFlow == null
              ? '—'
              : `${netCashFlow >= 0 ? '+' : '-'}${money(Math.abs(netCashFlow))}`
          }
          tone={
            netCashFlow == null
              ? ''
              : netCashFlow >= 0
                ? 'text-green-600 dark:text-green-400'
                : 'text-red-600 dark:text-red-400'
          }
        />
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

function Tile({
  title,
  value,
  loading,
  tone = '',
}: {
  title: string;
  value: string;
  loading: boolean;
  tone?: string;
}) {
  return (
    <div className="p-6 bg-white rounded-lg shadow dark:bg-slate-800">
      <h2 className="text-lg font-semibold mb-2">{title}</h2>
      {loading ? <LoadingSpinner /> : <p className={`text-3xl font-bold ${tone}`}>{value}</p>}
    </div>
  );
}
