'use client';

// Renders backend-owned recurring-bill detection (/api/finance/analytics → upcoming_bills). The
// recurrence detection + amount/variance are computed server-side (Rule 1). This only formats.

import React from 'react';
import Link from 'next/link';
import { CalendarDaysIcon } from '@heroicons/react/24/outline';
import { useFinanceData } from '@/components/domain/finance/FinanceDataContext';

const fmt = (n: number) =>
  `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function UpcomingBills() {
  const fin = useFinanceData();
  const ub = fin?.analytics?.upcoming_bills as
    | {
        bills: {
          name: string;
          amount: number;
          due_date?: string | null;
          variance?: number | null;
        }[];
        missing_state?: { reason: string };
      }
    | undefined;
  const loading = fin?.analyticsStatus === 'loading';
  const bills = ub?.bills || [];

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow dark:bg-slate-800 p-6">
        <h2 className="text-xl font-semibold mb-4">Upcoming Bills</h2>
        <div className="animate-pulse space-y-3">
          <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded"></div>
          <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded"></div>
        </div>
      </div>
    );
  }

  if (bills.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow dark:bg-slate-800 p-6">
        <h2 className="text-xl font-semibold mb-4">Upcoming Bills</h2>
        <div className="text-center py-8">
          <CalendarDaysIcon className="w-12 h-12 mx-auto text-slate-400 mb-4" />
          <p className="text-slate-500 dark:text-slate-400 mb-4">
            {ub?.missing_state?.reason ||
              'No recurring bills detected from your recent transactions.'}
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
      <h2 className="text-xl font-semibold mb-4">Upcoming Bills</h2>
      <div className="space-y-3">
        {bills.map((b, i) => (
          <div
            key={i}
            className="flex items-center justify-between p-3 border border-slate-200 dark:border-slate-700 rounded-lg"
          >
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">{b.name}</p>
              <p className="text-xs text-slate-400">Recurring · detected from transactions</p>
            </div>
            <span className="text-sm font-semibold text-gray-900 dark:text-white">
              {fmt(b.amount)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
