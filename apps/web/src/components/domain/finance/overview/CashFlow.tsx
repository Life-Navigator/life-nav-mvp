// FILE: src/components/finance/overview/CashFlow.tsx
'use client';

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowsRightLeftIcon } from "@heroicons/react/24/outline";

interface CashFlowData {
  monthly: {
    income: number;
    expenses: number;
    savings: number;
    savingsRate: number;
  };
  income: { category: string; amount: number }[];
  expenses: { category: string; amount: number }[];
}

export function CashFlow() {
  const [viewMode, setViewMode] = useState<"summary" | "income" | "expenses">("summary");
  const [cashFlowData, setCashFlowData] = useState<CashFlowData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCashFlowData = async () => {
      try {
        setLoading(true);

        // Get current month's transactions
        const now = new Date();
        const startDate = new Date(now.getFullYear(), now.getMonth(), 1);

        const response = await fetch(
          `/api/plaid/transactions?startDate=${startDate.toISOString()}&endDate=${now.toISOString()}&limit=500`
        );

        if (!response.ok) {
          // 401 means user not authenticated - show empty state silently
          if (response.status === 401) {
            setCashFlowData(null);
            setError(null);
            setLoading(false);
            return;
          }
          throw new Error('Failed to fetch transactions');
        }

        const data = await response.json();
        const transactions = data.transactions || [];

        // Calculate income and expenses
        const incomeByCategory: Record<string, number> = {};
        const expensesByCategory: Record<string, number> = {};
        let totalIncome = 0;
        let totalExpenses = 0;

        transactions.forEach((tx: { amount: number; category: string | null; name: string }) => {
          const category = tx.category || 'Other';
          const mainCategory = category.split(',')[0]?.trim() || 'Other';

          // Plaid: negative amounts = income/credits, positive = debits/expenses
          if (tx.amount < 0) {
            // Income (negative amounts in Plaid)
            const amount = Math.abs(tx.amount);
            totalIncome += amount;
            incomeByCategory[mainCategory] = (incomeByCategory[mainCategory] || 0) + amount;
          } else if (tx.amount > 0) {
            // Expense (positive amounts in Plaid)
            totalExpenses += tx.amount;
            expensesByCategory[mainCategory] = (expensesByCategory[mainCategory] || 0) + tx.amount;
          }
        });

        const savings = totalIncome - totalExpenses;
        const savingsRate = totalIncome > 0 ? (savings / totalIncome) * 100 : 0;

        // Convert to arrays and sort
        const income = Object.entries(incomeByCategory)
          .map(([category, amount]) => ({ category, amount }))
          .sort((a, b) => b.amount - a.amount);

        const expenses = Object.entries(expensesByCategory)
          .map(([category, amount]) => ({ category, amount }))
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 10); // Top 10 expense categories

        setCashFlowData({
          monthly: {
            income: totalIncome,
            expenses: totalExpenses,
            savings,
            savingsRate,
          },
          income,
          expenses,
        });
        setError(null);
      } catch (err) {
        console.error('Error fetching cash flow data:', err);
        setError('Unable to load cash flow data');
        setCashFlowData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchCashFlowData();
  }, []);

  // Loading state
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow dark:bg-slate-800 p-6">
        <h2 className="text-xl font-semibold mb-4">Cash Flow</h2>
        <div className="animate-pulse space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="h-20 bg-slate-200 dark:bg-slate-700 rounded"></div>
            <div className="h-20 bg-slate-200 dark:bg-slate-700 rounded"></div>
          </div>
          <div className="h-16 bg-slate-200 dark:bg-slate-700 rounded"></div>
        </div>
      </div>
    );
  }

  // Empty state
  if (!cashFlowData || (cashFlowData.monthly.income === 0 && cashFlowData.monthly.expenses === 0)) {
    return (
      <div className="bg-white rounded-lg shadow dark:bg-slate-800 p-6">
        <h2 className="text-xl font-semibold mb-4">Cash Flow</h2>
        <div className="text-center py-8">
          <ArrowsRightLeftIcon className="w-12 h-12 mx-auto text-slate-400 mb-4" />
          <p className="text-slate-500 dark:text-slate-400 mb-4">
            {error || "No cash flow data available yet"}
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
        <h2 className="text-xl font-semibold">Cash Flow</h2>
        <div className="flex space-x-1 bg-slate-100 dark:bg-slate-700 rounded-lg p-1">
          <button
            className={`px-3 py-1 text-sm rounded-md transition-colors ${
              viewMode === "summary"
                ? "bg-white dark:bg-slate-600 text-blue-600 dark:text-blue-400 shadow-sm"
                : "text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
            }`}
            onClick={() => setViewMode("summary")}
          >
            Summary
          </button>
          <button
            className={`px-3 py-1 text-sm rounded-md transition-colors ${
              viewMode === "income"
                ? "bg-white dark:bg-slate-600 text-blue-600 dark:text-blue-400 shadow-sm"
                : "text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
            }`}
            onClick={() => setViewMode("income")}
          >
            Income
          </button>
          <button
            className={`px-3 py-1 text-sm rounded-md transition-colors ${
              viewMode === "expenses"
                ? "bg-white dark:bg-slate-600 text-blue-600 dark:text-blue-400 shadow-sm"
                : "text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
            }`}
            onClick={() => setViewMode("expenses")}
          >
            Expenses
          </button>
        </div>
      </div>

      {viewMode === "summary" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 dark:bg-slate-700 p-4 rounded-lg">
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Monthly Income</p>
              <p className="text-xl font-semibold text-green-600 dark:text-green-400">
                ${cashFlowData.monthly.income.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-700 p-4 rounded-lg">
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Monthly Expenses</p>
              <p className="text-xl font-semibold text-red-500">
                ${cashFlowData.monthly.expenses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
            <div className="flex justify-between items-center mb-4">
              <span className="font-medium">Monthly Savings</span>
              <span className={`font-medium ${cashFlowData.monthly.savings >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-500'}`}>
                {cashFlowData.monthly.savings < 0 ? '-' : ''}${Math.abs(cashFlowData.monthly.savings).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-500 dark:text-slate-400">Savings Rate</span>
              <span className={`text-sm font-medium ${cashFlowData.monthly.savingsRate >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                {cashFlowData.monthly.savingsRate.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      )}

      {viewMode === "income" && (
        <div className="space-y-4">
          {cashFlowData.income.length > 0 ? (
            <>
              {cashFlowData.income.map((item, index) => (
                <div
                  key={index}
                  className="flex justify-between items-center py-3 border-b border-slate-100 dark:border-slate-700 last:border-none"
                >
                  <span>{item.category}</span>
                  <span className="font-medium text-green-600 dark:text-green-400">
                    ${item.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              ))}

              <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Total Income</span>
                  <span className="font-medium text-green-600 dark:text-green-400">
                    ${cashFlowData.monthly.income.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </>
          ) : (
            <p className="text-center py-4 text-slate-500 dark:text-slate-400">No income recorded this month</p>
          )}
        </div>
      )}

      {viewMode === "expenses" && (
        <div className="space-y-4">
          {cashFlowData.expenses.length > 0 ? (
            <>
              {cashFlowData.expenses.map((item, index) => (
                <div
                  key={index}
                  className="flex justify-between items-center py-3 border-b border-slate-100 dark:border-slate-700 last:border-none"
                >
                  <span>{item.category}</span>
                  <span className="font-medium text-red-500">
                    ${item.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              ))}

              <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Total Expenses</span>
                  <span className="font-medium text-red-500">
                    ${cashFlowData.monthly.expenses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </>
          ) : (
            <p className="text-center py-4 text-slate-500 dark:text-slate-400">No expenses recorded this month</p>
          )}
        </div>
      )}
    </div>
  );
}
