// FILE: src/components/finance/overview/SpendingTrends.tsx
'use client';

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ChartBarIcon } from "@heroicons/react/24/outline";

interface SpendingCategory {
  id: string;
  name: string;
  amount: number;
  color: string;
}

const categoryColors: Record<string, string> = {
  'FOOD_AND_DRINK': 'bg-green-500',
  'TRANSPORTATION': 'bg-yellow-500',
  'ENTERTAINMENT': 'bg-purple-500',
  'MEDICAL': 'bg-red-500',
  'SHOPPING': 'bg-indigo-500',
  'PERSONAL_CARE': 'bg-pink-500',
  'GENERAL_SERVICES': 'bg-blue-500',
  'RENT_AND_UTILITIES': 'bg-cyan-500',
  'TRAVEL': 'bg-orange-500',
  'OTHER': 'bg-gray-500',
};

const timeRanges = ["This Month", "Last Month", "3 Months", "6 Months", "Year"];

export function SpendingTrends() {
  const [timeRange, setTimeRange] = useState("This Month");
  const [categories, setCategories] = useState<SpendingCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch transactions and aggregate by category
  useEffect(() => {
    const fetchSpendingData = async () => {
      try {
        setLoading(true);

        // Calculate date range based on selection
        const now = new Date();
        let startDate: Date;

        switch (timeRange) {
          case "Last Month":
            startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            break;
          case "3 Months":
            startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
            break;
          case "6 Months":
            startDate = new Date(now.getFullYear(), now.getMonth() - 6, 1);
            break;
          case "Year":
            startDate = new Date(now.getFullYear() - 1, now.getMonth(), 1);
            break;
          default: // This Month
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        }

        const response = await fetch(
          `/api/plaid/transactions?startDate=${startDate.toISOString()}&endDate=${now.toISOString()}&limit=500`
        );

        if (!response.ok) {
          // 401 means user not authenticated - show empty state silently
          if (response.status === 401) {
            setCategories([]);
            setError(null);
            setLoading(false);
            return;
          }
          throw new Error('Failed to fetch transactions');
        }

        const data = await response.json();
        const transactions = data.transactions || [];

        // Aggregate spending by category (only negative amounts = spending)
        const categoryTotals: Record<string, number> = {};

        transactions.forEach((tx: { amount: number; category: string | null }) => {
          // Plaid uses positive amounts for debits (spending)
          if (tx.amount > 0) {
            const category = tx.category || 'OTHER';
            const mainCategory = category.split(',')[0]?.trim().toUpperCase().replace(/ /g, '_') || 'OTHER';
            categoryTotals[mainCategory] = (categoryTotals[mainCategory] || 0) + tx.amount;
          }
        });

        // Convert to array and sort by amount
        const sortedCategories = Object.entries(categoryTotals)
          .map(([name, amount], index) => ({
            id: `cat${index}`,
            name: name.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase()),
            amount,
            color: categoryColors[name] || 'bg-gray-500',
          }))
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 7); // Top 7 categories

        setCategories(sortedCategories);
        setError(null);
      } catch (err) {
        console.error('Error fetching spending data:', err);
        setError('Unable to load spending data');
        setCategories([]);
      } finally {
        setLoading(false);
      }
    };

    fetchSpendingData();
  }, [timeRange]);

  // Calculate total spending
  const totalSpending = categories.reduce((sum, cat) => sum + cat.amount, 0);

  // Loading state
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow dark:bg-slate-800 p-6">
        <h2 className="text-xl font-semibold mb-4">Spending Trends</h2>
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-full"></div>
          <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded"></div>
          <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded"></div>
          <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded"></div>
        </div>
      </div>
    );
  }

  // Empty state
  if (categories.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow dark:bg-slate-800 p-6">
        <h2 className="text-xl font-semibold mb-4">Spending Trends</h2>
        <div className="text-center py-8">
          <ChartBarIcon className="w-12 h-12 mx-auto text-slate-400 mb-4" />
          <p className="text-slate-500 dark:text-slate-400 mb-4">
            {error || "No spending data available yet"}
          </p>
          <Link
            href="/dashboard/finance/accounts"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Connect Account
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow dark:bg-slate-800 p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Spending Trends</h2>
        <select
          aria-label="Select time range"
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value)}
          className="px-3 py-1 text-sm rounded border border-slate-300 bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-white"
        >
          {timeRanges.map((range) => (
            <option key={range} value={range}>{range}</option>
          ))}
        </select>
      </div>

      <div className="mb-6">
        <div className="h-4 w-full flex rounded-full overflow-hidden">
          {categories.map((category) => {
            const percentage = totalSpending > 0 ? (category.amount / totalSpending) * 100 : 0;
            return (
              <div
                key={category.id}
                className={`${category.color} h-full`}
                style={{ width: `${percentage}%` }}
                title={`${category.name}: $${category.amount.toFixed(2)}`}
              />
            );
          })}
        </div>
      </div>

      <div className="space-y-4">
        {categories.map((category) => {
          const percentage = totalSpending > 0 ? ((category.amount / totalSpending) * 100).toFixed(1) : '0';
          return (
            <div key={category.id} className="flex items-center justify-between">
              <div className="flex items-center">
                <div className={`w-3 h-3 rounded-full ${category.color} mr-2`} />
                <span className="text-sm font-medium dark:text-white">{category.name}</span>
              </div>
              <div className="flex items-center">
                <span className="text-sm font-medium mr-2 dark:text-white">
                  ${category.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">{percentage}%</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
        <div className="flex justify-between items-center">
          <span className="text-sm text-slate-500 dark:text-slate-400">Total Spending</span>
          <span className="text-lg font-medium dark:text-white">
            ${totalSpending.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>
    </div>
  );
}
