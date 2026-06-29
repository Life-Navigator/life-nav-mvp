'use client';

// Renders backend-owned insights (/api/finance/analytics → financial_insights). The month-over-month
// percent_change and severity are computed server-side (Rule 1). This only formats.

import React from 'react';
import Link from 'next/link';
import { LightBulbIcon } from '@heroicons/react/24/outline';
import { useFinanceData } from '@/components/domain/finance/FinanceDataContext';

const TONE: Record<string, string> = {
  warning: 'border-l-amber-500 bg-amber-50 dark:bg-amber-900/10',
  risk: 'border-l-rose-500 bg-rose-50 dark:bg-rose-900/10',
  opportunity: 'border-l-emerald-500 bg-emerald-50 dark:bg-emerald-900/10',
  info: 'border-l-blue-500 bg-blue-50 dark:bg-blue-900/10',
};

export function FinancialInsights() {
  const fin = useFinanceData();
  const insights = (fin?.analytics?.financial_insights?.insights || []) as Array<{
    title: string;
    description: string;
    severity: string;
    percent_change?: number | null;
  }>;
  const loading = fin?.analyticsStatus === 'loading';

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow dark:bg-slate-800 p-6">
        <h2 className="text-xl font-semibold mb-4">Financial Insights</h2>
        <div className="animate-pulse space-y-3">
          <div className="h-12 bg-slate-200 dark:bg-slate-700 rounded"></div>
          <div className="h-12 bg-slate-200 dark:bg-slate-700 rounded"></div>
        </div>
      </div>
    );
  }

  if (insights.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow dark:bg-slate-800 p-6">
        <h2 className="text-xl font-semibold mb-4">Financial Insights</h2>
        <div className="text-center py-8">
          <LightBulbIcon className="w-12 h-12 mx-auto text-slate-400 mb-4" />
          <p className="text-slate-500 dark:text-slate-400 mb-4">
            Insights appear once account balances or transactions are connected.
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
      <h2 className="text-xl font-semibold mb-4">Financial Insights</h2>
      <div className="space-y-3">
        {insights.map((ins, i) => (
          <div key={i} className={`p-3 border-l-4 rounded-lg ${TONE[ins.severity] || TONE.info}`}>
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">{ins.title}</h4>
              {ins.percent_change != null && (
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {ins.percent_change > 0 ? '+' : ''}
                  {ins.percent_change}%
                </span>
              )}
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{ins.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
