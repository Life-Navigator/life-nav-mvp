// FILE: src/components/finance/overview/SpendingTrends.tsx
'use client';

// Renders backend-owned spending analytics (/api/finance/analytics → spending_trends). The category
// totals + percentages are computed server-side (Rule 1). This component only formats + draws.

import React from 'react';
import Link from 'next/link';
import { ChartBarIcon } from '@heroicons/react/24/outline';
import { useFinanceData } from '@/components/domain/finance/FinanceDataContext';

const categoryColors: Record<string, string> = {
  FOOD_AND_DRINK: 'bg-green-500',
  TRANSPORTATION: 'bg-yellow-500',
  ENTERTAINMENT: 'bg-purple-500',
  MEDICAL: 'bg-red-500',
  SHOPPING: 'bg-indigo-500',
  PERSONAL_CARE: 'bg-pink-500',
  GENERAL_SERVICES: 'bg-blue-500',
  RENT_AND_UTILITIES: 'bg-cyan-500',
  TRAVEL: 'bg-orange-500',
  OTHER: 'bg-gray-500',
};
const colorFor = (c: string) => categoryColors[c.toUpperCase().replace(/ /g, '_')] || 'bg-gray-500';
const pretty = (c: string) =>
  c
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (m) => m.toUpperCase());

export function SpendingTrends() {
  const fin = useFinanceData();
  const st = fin?.analytics?.spending_trends as
    | {
        total_spending: number | null;
        categories: { category: string; amount: number; percentage: number }[];
        missing_state?: { reason: string };
      }
    | undefined;
  const loading = fin?.analyticsStatus === 'loading';
  const categories = st?.categories || [];
  const totalSpending = st?.total_spending ?? 0;

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow dark:bg-slate-800 p-6">
        <h2 className="text-xl font-semibold mb-4">Spending Trends</h2>
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-full"></div>
          <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded"></div>
          <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded"></div>
        </div>
      </div>
    );
  }

  if (categories.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow dark:bg-slate-800 p-6">
        <h2 className="text-xl font-semibold mb-4">Spending Trends</h2>
        <div className="text-center py-8">
          <ChartBarIcon className="w-12 h-12 mx-auto text-slate-400 mb-4" />
          <p className="text-slate-500 dark:text-slate-400 mb-4">
            {st?.missing_state?.reason || 'No spending in the last 30 days.'}
          </p>
          <Link
            href="/dashboard/finance/accounts"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            View Accounts
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow dark:bg-slate-800 p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Spending Trends</h2>
        <span className="text-xs text-slate-400">Last 30 days</span>
      </div>

      <div className="mb-6">
        <div className="h-4 w-full flex rounded-full overflow-hidden">
          {categories.map((c) => (
            <div
              key={c.category}
              className={`${colorFor(c.category)} h-full`}
              style={{ width: `${c.percentage}%` }}
              title={`${pretty(c.category)}: $${c.amount.toFixed(2)}`}
            />
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {categories.map((c) => (
          <div key={c.category} className="flex items-center justify-between">
            <div className="flex items-center">
              <div className={`w-3 h-3 rounded-full ${colorFor(c.category)} mr-2`} />
              <span className="text-sm font-medium dark:text-white">{pretty(c.category)}</span>
            </div>
            <div className="flex items-center">
              <span className="text-sm font-medium mr-2 dark:text-white">
                $
                {c.amount.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">{c.percentage}%</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
        <div className="flex justify-between items-center">
          <span className="text-sm text-slate-500 dark:text-slate-400">Total Spending</span>
          <span className="text-lg font-medium dark:text-white">
            $
            {totalSpending.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        </div>
      </div>
    </div>
  );
}
