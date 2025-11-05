'use client';

import React from 'react';
import { FinancialAccount } from '@/types/financial';

interface NetWorthSummaryProps {
  accounts: FinancialAccount[];
}

export default function NetWorthSummary({ accounts }: NetWorthSummaryProps) {
  // Calculate total assets, liabilities, and net worth
  const assetsTotal = accounts
    .filter(acc => acc.balance > 0 || (acc.type !== 'loan' && acc.type !== 'credit'))
    .reduce((sum, acc) => sum + Math.max(0, acc.balance), 0);

  const liabilitiesTotal = accounts
    .filter(acc => acc.balance < 0 || acc.type === 'loan' || acc.type === 'credit')
    .reduce((sum, acc) => sum + Math.abs(Math.min(0, acc.balance)), 0);

  const netWorth = assetsTotal - liabilitiesTotal;

  // Formatter for currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Financial Summary</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
          <h3 className="text-sm text-blue-700 dark:text-blue-300 mb-1">Net Worth</h3>
          <p className={`text-2xl font-bold ${netWorth >= 0 ? 'text-blue-700 dark:text-blue-300' : 'text-rose-600 dark:text-rose-400'}`}>
            {formatCurrency(netWorth)}
          </p>
        </div>
        
        <div className="p-4 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg">
          <h3 className="text-sm text-emerald-700 dark:text-emerald-300 mb-1">Assets</h3>
          <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
            {formatCurrency(assetsTotal)}
          </p>
        </div>
        
        <div className="p-4 bg-rose-50 dark:bg-rose-900/30 rounded-lg">
          <h3 className="text-sm text-rose-700 dark:text-rose-300 mb-1">Liabilities</h3>
          <p className="text-2xl font-bold text-rose-700 dark:text-rose-300">
            {formatCurrency(liabilitiesTotal)}
          </p>
        </div>
      </div>
      
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="relative h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div 
            className="absolute top-0 left-0 h-full bg-blue-600"
            style={{ 
              width: `${Math.min(100, (assetsTotal / (assetsTotal + liabilitiesTotal)) * 100)}%`
            }}
          ></div>
        </div>
        <div className="flex justify-between mt-2 text-xs text-gray-500 dark:text-gray-400">
          <span>Assets: {Math.round((assetsTotal / (assetsTotal + liabilitiesTotal)) * 100)}%</span>
          <span>Liabilities: {Math.round((liabilitiesTotal / (assetsTotal + liabilitiesTotal)) * 100)}%</span>
        </div>
      </div>
    </div>
  );
}