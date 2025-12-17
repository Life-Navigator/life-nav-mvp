// FILE: src/app/dashboard/finance/overview/page.tsx
'use client';

import { Suspense, useMemo } from "react";
import { AccountsSummary } from "@/components/domain/finance/overview/AccountsSummary";
import { SpendingTrends } from "@/components/domain/finance/overview/SpendingTrends";
import { UpcomingBills } from "@/components/domain/finance/overview/UpcomingBills";
import { FinancialInsights } from "@/components/domain/finance/overview/FinancialInsights";
import { CashFlow } from "@/components/domain/finance/overview/CashFlow";
import { LoadingSpinner } from "@/components/ui/loaders/LoadingSpinner";
import { useFinancialAccounts, useTransactions } from "@/lib/hooks/useFinanceData";

export default function OverviewPage() {
  // Fetch real data using React Query hooks
  const { data: accounts, isLoading: accountsLoading } = useFinancialAccounts();
  const { data: transactions, isLoading: transactionsLoading } = useTransactions({
    limit: 100,
  });

  const loading = accountsLoading || transactionsLoading;

  // Calculate financial summary from real data
  const financialSummary = useMemo(() => {
    if (!accounts) {
      return {
        totalAssets: 0,
        totalLiabilities: 0,
        netWorth: 0,
        monthlyCashFlow: 0
      };
    }

    // Calculate total assets (checking, savings, investment accounts with positive balance)
    const totalAssets = accounts
      .filter((acc) =>
        acc.account_type === 'checking' ||
        acc.account_type === 'savings' ||
        acc.account_type === 'investment'
      )
      .reduce((sum, acc) => sum + (Number(acc.current_balance) || 0), 0);

    // Calculate total liabilities (credit card, loan accounts)
    const totalLiabilities = accounts
      .filter((acc) =>
        acc.account_type === 'credit_card' ||
        acc.account_type === 'loan'
      )
      .reduce((sum, acc) => sum + Math.abs(Number(acc.current_balance) || 0), 0);

    // Calculate net worth
    const netWorth = totalAssets - totalLiabilities;

    // Calculate monthly cash flow from recent transactions (30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentTransactions = transactions || [];

    const income = recentTransactions
      .filter((tx) => {
        const txDate = new Date(tx.transaction_date);
        return tx.transaction_type === 'credit' && txDate >= thirtyDaysAgo;
      })
      .reduce((sum, tx) => sum + Number(tx.amount), 0);

    const expenses = recentTransactions
      .filter((tx) => {
        const txDate = new Date(tx.transaction_date);
        return tx.transaction_type === 'debit' && txDate >= thirtyDaysAgo;
      })
      .reduce((sum, tx) => sum + Math.abs(Number(tx.amount)), 0);

    const monthlyCashFlow = income - expenses;

    return {
      totalAssets,
      totalLiabilities,
      netWorth,
      monthlyCashFlow
    };
  }, [accounts, transactions]);

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-2xl font-bold mb-6">Financial Overview</h1>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
        <div className="p-6 bg-white rounded-lg shadow dark:bg-slate-800">
          <h2 className="text-lg font-semibold mb-2">Total Assets</h2>
          {loading ? (
            <LoadingSpinner />
          ) : (
            <p className="text-3xl font-bold">
              ${financialSummary.totalAssets.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          )}
        </div>

        <div className="p-6 bg-white rounded-lg shadow dark:bg-slate-800">
          <h2 className="text-lg font-semibold mb-2">Total Liabilities</h2>
          {loading ? (
            <LoadingSpinner />
          ) : (
            <p className="text-3xl font-bold">
              ${financialSummary.totalLiabilities.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          )}
        </div>

        <div className="p-6 bg-white rounded-lg shadow dark:bg-slate-800">
          <h2 className="text-lg font-semibold mb-2">Net Worth</h2>
          {loading ? (
            <LoadingSpinner />
          ) : (
            <p className="text-3xl font-bold">
              ${financialSummary.netWorth.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          )}
        </div>

        <div className="p-6 bg-white rounded-lg shadow dark:bg-slate-800">
          <h2 className="text-lg font-semibold mb-2">Monthly Cash Flow</h2>
          {loading ? (
            <LoadingSpinner />
          ) : (
            <p className={`text-3xl font-bold ${financialSummary.monthlyCashFlow >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {financialSummary.monthlyCashFlow >= 0 ? '+' : '-'}${Math.abs(financialSummary.monthlyCashFlow).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          )}
        </div>
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