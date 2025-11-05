'use client';

import React from 'react';
import { FinancialAccount } from '@/types/financial';

interface TransactionFiltersProps {
  accounts: FinancialAccount[];
  selectedAccountIds: string[];
  startDate: Date;
  endDate: Date;
  onAccountChange: (accountIds: string[]) => void;
  onDateRangeChange: (startDate: Date, endDate: Date) => void;
}

export default function TransactionFilters({
  accounts,
  selectedAccountIds,
  startDate,
  endDate,
  onAccountChange,
  onDateRangeChange,
}: TransactionFiltersProps) {
  // Predefined date ranges
  const dateRanges = [
    { label: 'Last 7 days', days: 7 },
    { label: 'Last 30 days', days: 30 },
    { label: 'Last 90 days', days: 90 },
    { label: 'Year to date', value: 'ytd' },
  ];

  // Toggle account selection
  const toggleAccount = (accountId: string) => {
    if (selectedAccountIds.includes(accountId)) {
      onAccountChange(selectedAccountIds.filter(id => id !== accountId));
    } else {
      onAccountChange([...selectedAccountIds, accountId]);
    }
  };

  // Select all accounts
  const selectAllAccounts = () => {
    onAccountChange(accounts.map(account => account.id));
  };

  // Clear account selection
  const clearAccountSelection = () => {
    onAccountChange([]);
  };

  // Set date range using predefined ranges
  const setDateRange = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days);
    onDateRangeChange(start, end);
  };

  // Set year to date range
  const setYearToDate = () => {
    const end = new Date();
    const start = new Date(end.getFullYear(), 0, 1); // January 1st of current year
    onDateRangeChange(start, end);
  };

  // Format date for display
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-6">
      <div className="mb-4">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Accounts</h3>
        <div className="flex flex-wrap gap-2 mb-2">
          {accounts.map(account => (
            <button
              key={account.id}
              onClick={() => toggleAccount(account.id)}
              className={`flex items-center py-1 px-3 rounded-full text-sm transition-colors ${
                selectedAccountIds.includes(account.id)
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              <span className="mr-1">{selectedAccountIds.includes(account.id) ? '✓' : ''}</span>
              {account.name}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button
            onClick={selectAllAccounts}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            Select All
          </button>
          <button
            onClick={clearAccountSelection}
            className="text-sm text-gray-500 dark:text-gray-400 hover:underline"
          >
            Clear All
          </button>
        </div>
      </div>
      
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Date Range</h3>
        <div className="flex flex-wrap gap-2 mb-4">
          {dateRanges.map(range => (
            <button
              key={range.label}
              onClick={() => range.value === 'ytd' ? setYearToDate() : setDateRange(range.days!)}
              className="py-1 px-3 rounded-full text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
            >
              {range.label}
            </button>
          ))}
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Start Date</label>
            <input
              type="date"
              value={startDate.toISOString().split('T')[0]}
              onChange={(e) => {
                const newDate = new Date(e.target.value);
                onDateRangeChange(newDate, endDate);
              }}
              className="w-full p-2 border rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">End Date</label>
            <input
              type="date"
              value={endDate.toISOString().split('T')[0]}
              onChange={(e) => {
                const newDate = new Date(e.target.value);
                onDateRangeChange(startDate, newDate);
              }}
              className="w-full p-2 border rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
        </div>
        
        <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Showing transactions from {formatDate(startDate)} to {formatDate(endDate)}
        </div>
      </div>
    </div>
  );
}