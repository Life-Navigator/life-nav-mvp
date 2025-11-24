// FILE: src/app/dashboard/finance/overview/page.tsx
'use client';

import { Suspense, useState, useEffect } from "react";
import { AccountsSummary } from "@/components/domain/finance/overview/AccountsSummary";
import { SpendingTrends } from "@/components/domain/finance/overview/SpendingTrends";
import { UpcomingBills } from "@/components/domain/finance/overview/UpcomingBills";
import { FinancialInsights } from "@/components/domain/finance/overview/FinancialInsights";
import { CashFlow } from "@/components/domain/finance/overview/CashFlow";
import { LoadingSpinner } from "@/components/ui/loaders/LoadingSpinner";

export default function OverviewPage() {
  const [loading, setLoading] = useState(true);
  const [financialSummary, setFinancialSummary] = useState({
    totalAssets: 0,
    totalLiabilities: 0,
    netWorth: 0,
    monthlyCashFlow: 0
  });

  useEffect(() => {
    const fetchFinancialData = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/financial');

        // Handle non-OK responses gracefully - show empty state
        if (!response.ok) {
          // Log but don't throw - just show $0 values
          console.warn('[Overview] API returned non-OK status:', response.status);
          setFinancialSummary({
            totalAssets: 0,
            totalLiabilities: 0,
            netWorth: 0,
            monthlyCashFlow: 0
          });
          setLoading(false);
          return;
        }

        const data = await response.json();

        // Safely access accounts array with fallback
        const accounts = Array.isArray(data?.accounts) ? data.accounts : [];

        // Calculate total assets (sum of banking + investment accounts + investment portfolio value)
        const bankingAssets = accounts
          .filter((acc: any) => acc.type === 'banking' || acc.type === 'investment')
          .reduce((sum: number, acc: any) => sum + (acc.balance || 0), 0);

        const investmentValue = data.investments?.totalValue || 0;
        const totalAssets = bankingAssets + investmentValue;

        // Calculate total liabilities (sum of credit accounts)
        const totalLiabilities = accounts
          .filter((acc: any) => acc.type === 'credit')
          .reduce((sum: number, acc: any) => sum + Math.abs(acc.balance || 0), 0);

        // Calculate net worth
        const netWorth = totalAssets - totalLiabilities;

        // Calculate monthly cash flow from recent transactions (30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const recentTransactions = Array.isArray(data.transactions?.recentTransactions)
          ? data.transactions.recentTransactions
          : [];

        const income = recentTransactions
          .filter((tx: any) => {
            const txDate = new Date(tx.date);
            return tx.amount > 0 && txDate >= thirtyDaysAgo;
          })
          .reduce((sum: number, tx: any) => sum + tx.amount, 0);

        const expenses = recentTransactions
          .filter((tx: any) => {
            const txDate = new Date(tx.date);
            return tx.amount < 0 && txDate >= thirtyDaysAgo;
          })
          .reduce((sum: number, tx: any) => sum + Math.abs(tx.amount), 0);

        const monthlyCashFlow = income - expenses;

        setFinancialSummary({
          totalAssets,
          totalLiabilities,
          netWorth,
          monthlyCashFlow
        });
        setLoading(false);
      } catch (error) {
        // Log error but don't crash - show empty state
        console.error('[Overview] Error fetching financial data:', error);
        setFinancialSummary({
          totalAssets: 0,
          totalLiabilities: 0,
          netWorth: 0,
          monthlyCashFlow: 0
        });
        setLoading(false);
      }
    };

    fetchFinancialData();
  }, []);

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