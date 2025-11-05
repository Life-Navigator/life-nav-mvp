'use client';

import React from 'react';
import { FinancialAccount } from '@/types/financial';

interface AccountCardProps {
  account: FinancialAccount;
  onClick?: () => void;
}

export default function AccountCard({ account, onClick }: AccountCardProps) {
  // Format currency using Intl.NumberFormat
  const formattedBalance = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: account.currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(account.balance));

  // Format the last updated date
  const lastUpdated = new Date(account.lastUpdated).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  // Determine text color based on account type and balance
  const getBalanceColor = () => {
    if (account.type === 'credit' || account.type === 'loan') {
      return account.balance < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400';
    }
    return account.balance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400';
  };

  // Add a sign based on the account type and balance
  const getBalancePrefix = () => {
    if (account.type === 'credit' || account.type === 'loan') {
      return account.balance < 0 ? '' : '+';
    }
    return account.balance >= 0 ? '' : '-';
  };

  // Account type badge
  const getAccountTypeBadge = () => {
    const badgeClasses = 'px-2 py-1 text-xs rounded-full';
    
    switch (account.type) {
      case 'bank':
        return <span className={`${badgeClasses} bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200`}>Banking</span>;
      case 'credit':
        return <span className={`${badgeClasses} bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200`}>Credit</span>;
      case 'investment':
        return <span className={`${badgeClasses} bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200`}>Investment</span>;
      case 'retirement':
        return <span className={`${badgeClasses} bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200`}>Retirement</span>;
      case 'loan':
        return <span className={`${badgeClasses} bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200`}>Loan</span>;
      case 'crypto':
        return <span className={`${badgeClasses} bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200`}>Crypto</span>;
      default:
        return <span className={`${badgeClasses} bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200`}>Other</span>;
    }
  };

  return (
    <div 
      className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-all cursor-pointer"
      onClick={onClick}
    >
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center">
          <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-md flex items-center justify-center mr-3">
            {account.institution.logo ? (
              <img src={account.institution.logo} alt={account.institution.name} className="w-6 h-6" />
            ) : (
              <div className="text-lg font-bold text-gray-600 dark:text-gray-400">
                {account.institution.name.charAt(0)}
              </div>
            )}
          </div>
          <div>
            <h3 className="font-medium text-gray-900 dark:text-white">{account.name}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">{account.institution.name}</p>
          </div>
        </div>
        <div className="flex flex-col items-end">
          {getAccountTypeBadge()}
          {account.status !== 'active' && (
            <span className="text-xs text-rose-600 dark:text-rose-400 mt-1">
              {account.status.charAt(0).toUpperCase() + account.status.slice(1)}
            </span>
          )}
        </div>
      </div>
      
      <div className="flex justify-between items-center mt-4">
        <span className={`text-lg font-semibold ${getBalanceColor()}`}>
          {getBalancePrefix()}{formattedBalance}
        </span>
        <div className="flex items-center">
          {account.maskedAccountNumber && (
            <span className="text-xs text-gray-500 dark:text-gray-400 mr-2">
              {account.maskedAccountNumber}
            </span>
          )}
          <span className="text-xs text-gray-400 dark:text-gray-500">
            Updated {lastUpdated}
          </span>
        </div>
      </div>
    </div>
  );
}