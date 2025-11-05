'use client';

import React from 'react';
import { AccountType } from '@/types/financial';

interface AccountTypeFilterProps {
  selectedType: AccountType | 'all';
  onChange: (type: AccountType | 'all') => void;
}

const accountTypeOptions: { value: AccountType | 'all'; label: string; icon: string }[] = [
  { value: 'all', label: 'All Accounts', icon: '💰' },
  { value: 'bank', label: 'Bank', icon: '🏦' },
  { value: 'credit', label: 'Credit', icon: '💳' },
  { value: 'investment', label: 'Investment', icon: '📈' },
  { value: 'retirement', label: 'Retirement', icon: '🏝️' },
  { value: 'loan', label: 'Loans', icon: '📝' },
  { value: 'crypto', label: 'Crypto', icon: '₿' },
  { value: 'other', label: 'Other', icon: '🔄' },
];

export default function AccountTypeFilter({ selectedType, onChange }: AccountTypeFilterProps) {
  return (
    <div className="flex flex-wrap gap-2 mb-6">
      {accountTypeOptions.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={`flex items-center py-2 px-4 rounded-full text-sm font-medium transition-colors ${
            selectedType === option.value
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          <span className="mr-2">{option.icon}</span>
          {option.label}
        </button>
      ))}
    </div>
  );
}