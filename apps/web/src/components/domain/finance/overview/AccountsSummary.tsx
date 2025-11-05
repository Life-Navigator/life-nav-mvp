// FILE: src/components/finance/overview/AccountsSummary.tsx
'use client';

import React, { useState } from "react";
import { 
  BuildingLibraryIcon, 
  CreditCardIcon, 
  HomeIcon, 
  CurrencyDollarIcon 
} from "@heroicons/react/24/outline";

// Mock data for accounts - in production this would come from an API
const accountsData = [
  {
    id: "acc1",
    name: "Chase Checking",
    type: "checking",
    balance: 6432.51,
    icon: <BuildingLibraryIcon className="w-5 h-5" />,
  },
  {
    id: "acc2",
    name: "Chase Savings",
    type: "savings",
    balance: 15245.32,
    icon: <BuildingLibraryIcon className="w-5 h-5" />,
  },
  {
    id: "acc3",
    name: "Citi Credit Card",
    type: "credit",
    balance: -2145.67,
    icon: <CreditCardIcon className="w-5 h-5" />,
  },
  {
    id: "acc4",
    name: "Mortgage",
    type: "loan",
    balance: -235600.00,
    icon: <HomeIcon className="w-5 h-5" />,
  },
  {
    id: "acc5",
    name: "Vanguard Brokerage",
    type: "investment",
    balance: 104325.78,
    icon: <CurrencyDollarIcon className="w-5 h-5" />,
  },
];

export function AccountsSummary() {
  const [filter, setFilter] = useState<string>("all");
  
  // Filter accounts based on selected type
  const filteredAccounts = filter === "all" 
    ? accountsData 
    : accountsData.filter(account => account.type === filter);

  // Calculate totals
  const totalAssets = accountsData
    .filter(account => account.balance > 0)
    .reduce((sum, account) => sum + account.balance, 0);
    
  const totalLiabilities = accountsData
    .filter(account => account.balance < 0)
    .reduce((sum, account) => sum + Math.abs(account.balance), 0);

  return (
    <div className="bg-white rounded-lg shadow dark:bg-slate-800 p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Accounts Summary</h2>
        <div className="flex space-x-2">
          <select
            aria-label="Filter accounts"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-3 py-1 text-sm rounded border border-slate-300 bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-white"
          >
            <option value="all">All Accounts</option>
            <option value="checking">Checking</option>
            <option value="savings">Savings</option>
            <option value="credit">Credit Cards</option>
            <option value="loan">Loans</option>
            <option value="investment">Investments</option>
          </select>
        </div>
      </div>
      
      <div className="space-y-4 mb-6">
        {filteredAccounts.map((account) => (
          <div 
            key={account.id}
            className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-slate-700"
          >
            <div className="flex items-center">
              <div className="bg-slate-100 dark:bg-slate-700 p-2 rounded-full mr-3">
                {account.icon}
              </div>
              <div>
                <p className="font-medium">{account.name}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400 capitalize">{account.type}</p>
              </div>
            </div>
            <div className={`text-right font-medium ${account.balance < 0 ? 'text-red-500' : 'text-green-600 dark:text-green-400'}`}>
              {account.balance < 0 ? "-" : ""}${Math.abs(account.balance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        ))}
      </div>
      
      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200 dark:border-slate-700">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400">Total Assets</p>
          <p className="text-lg font-medium text-green-600 dark:text-green-400">
            ${totalAssets.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400">Total Liabilities</p>
          <p className="text-lg font-medium text-red-500">
            ${totalLiabilities.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
      </div>
    </div>
  );
}