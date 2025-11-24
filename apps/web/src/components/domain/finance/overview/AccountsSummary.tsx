// FILE: src/components/finance/overview/AccountsSummary.tsx
'use client';

import React, { useState, useEffect } from "react";
import {
  BuildingLibraryIcon,
  CreditCardIcon,
  HomeIcon,
  CurrencyDollarIcon,
  BanknotesIcon,
  PlusIcon
} from "@heroicons/react/24/outline";
import Link from "next/link";

interface Account {
  id: string;
  name: string;
  type: string;
  subtype?: string;
  currentBalance: number;
  institution?: string;
}

// Helper to get icon based on account type
function getAccountIcon(type: string) {
  switch (type) {
    case 'depository':
      return <BuildingLibraryIcon className="w-5 h-5" />;
    case 'credit':
      return <CreditCardIcon className="w-5 h-5" />;
    case 'loan':
      return <HomeIcon className="w-5 h-5" />;
    case 'investment':
      return <CurrencyDollarIcon className="w-5 h-5" />;
    default:
      return <BanknotesIcon className="w-5 h-5" />;
  }
}

export function AccountsSummary() {
  const [filter, setFilter] = useState<string>("all");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch accounts from Plaid API
  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/plaid/accounts');
        if (!response.ok) {
          // 401 means user not authenticated - show empty state silently
          if (response.status === 401) {
            setAccounts([]);
            setError(null);
            return;
          }
          throw new Error('Failed to fetch accounts');
        }
        const data = await response.json();
        setAccounts(data.accounts || []);
        setError(null);
      } catch (err) {
        console.error('Error fetching accounts:', err);
        setError('Unable to load accounts');
        setAccounts([]);
      } finally {
        setLoading(false);
      }
    };
    fetchAccounts();
  }, []);

  // Filter accounts based on selected type
  const filteredAccounts = filter === "all"
    ? accounts
    : accounts.filter(account => account.type === filter);

  // Calculate totals
  const totalAssets = accounts
    .filter(account => (account.currentBalance || 0) > 0)
    .reduce((sum, account) => sum + (account.currentBalance || 0), 0);

  const totalLiabilities = accounts
    .filter(account => (account.currentBalance || 0) < 0)
    .reduce((sum, account) => sum + Math.abs(account.currentBalance || 0), 0);

  // Loading state
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow dark:bg-slate-800 p-6">
        <h2 className="text-xl font-semibold mb-4">Accounts Summary</h2>
        <div className="animate-pulse space-y-4">
          <div className="h-12 bg-slate-200 dark:bg-slate-700 rounded"></div>
          <div className="h-12 bg-slate-200 dark:bg-slate-700 rounded"></div>
          <div className="h-12 bg-slate-200 dark:bg-slate-700 rounded"></div>
        </div>
      </div>
    );
  }

  // Empty state - no accounts connected
  if (accounts.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow dark:bg-slate-800 p-6">
        <h2 className="text-xl font-semibold mb-4">Accounts Summary</h2>
        <div className="text-center py-8">
          <BuildingLibraryIcon className="w-12 h-12 mx-auto text-slate-400 mb-4" />
          <p className="text-slate-500 dark:text-slate-400 mb-4">
            {error || "No accounts connected yet"}
          </p>
          <Link
            href="/dashboard/finance/accounts"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            <PlusIcon className="w-5 h-5 mr-2" />
            Connect Account
          </Link>
        </div>
      </div>
    );
  }

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
            <option value="depository">Bank Accounts</option>
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
                {getAccountIcon(account.type)}
              </div>
              <div>
                <p className="font-medium">{account.name}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {account.institution || account.subtype || account.type}
                </p>
              </div>
            </div>
            <div className={`text-right font-medium ${(account.currentBalance || 0) < 0 ? 'text-red-500' : 'text-green-600 dark:text-green-400'}`}>
              {(account.currentBalance || 0) < 0 ? "-" : ""}${Math.abs(account.currentBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
