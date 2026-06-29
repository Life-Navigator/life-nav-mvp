'use client';

// Renders backend-owned cash-flow analytics (/api/finance/analytics → cash_flow). Income, expenses,
// net, savings, and savings rate are all computed server-side (Rule 1). This only formats.

import React from 'react';
import Link from 'next/link';
import { BanknotesIcon } from '@heroicons/react/24/outline';
import { useFinanceData } from '@/components/domain/finance/FinanceDataContext';

const fmt = (n: number | null | undefined) =>
  n == null
    ? '—'
    : `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function CashFlow() {
  const fin = useFinanceData();
  const cf = fin?.analytics?.cash_flow as
    | {
        income_total: number | null;
        expense_total: number | null;
        net_cash_flow: number | null;
        savings_amount: number | null;
        savings_rate: number | null;
        note?: string;
        missing_state?: { reason: string };
      }
    | undefined;
  const loading = fin?.analyticsStatus === 'loading';

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow dark:bg-slate-800 p-6">
        <h2 className="text-xl font-semibold mb-4">Cash Flow</h2>
        <div className="animate-pulse space-y-3">
          <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded"></div>
          <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded"></div>
        </div>
      </div>
    );
  }

  if (!cf || cf.income_total == null) {
    return (
      <div className="bg-white rounded-lg shadow dark:bg-slate-800 p-6">
        <h2 className="text-xl font-semibold mb-4">Cash Flow</h2>
        <div className="text-center py-8">
          <BanknotesIcon className="w-12 h-12 mx-auto text-slate-400 mb-4" />
          <p className="text-slate-500 dark:text-slate-400 mb-4">
            {cf?.missing_state?.reason || 'No cash-flow data in the last 30 days.'}
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
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Cash Flow</h2>
        <span className="text-xs text-slate-400">Last 30 days</span>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Tile
          label="Income"
          value={fmt(cf.income_total)}
          tone="text-emerald-600 dark:text-emerald-400"
        />
        <Tile
          label="Expenses"
          value={fmt(cf.expense_total)}
          tone="text-rose-600 dark:text-rose-400"
        />
        <Tile
          label="Net Cash Flow"
          value={fmt(cf.net_cash_flow)}
          tone={
            (cf.net_cash_flow ?? 0) >= 0
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-rose-600 dark:text-rose-400'
          }
        />
        <Tile label="Savings" value={fmt(cf.savings_amount)} tone="text-gray-900 dark:text-white" />
      </div>
      <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
        <span className="text-sm text-slate-500 dark:text-slate-400">Savings Rate</span>
        <span className="text-lg font-medium dark:text-white">
          {cf.savings_rate == null ? 'Not available' : `${cf.savings_rate}%`}
        </span>
      </div>
      {cf.note && <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">{cf.note}</p>}
    </div>
  );
}

function Tile({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div>
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`text-lg font-semibold ${tone}`}>{value}</p>
    </div>
  );
}
