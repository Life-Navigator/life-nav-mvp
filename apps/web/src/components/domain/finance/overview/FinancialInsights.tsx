// FILE: src/components/finance/overview/FinancialInsights.tsx
'use client';

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { LightBulbIcon, ArrowTrendingUpIcon, ArrowTrendingDownIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";

interface Insight {
  id: string;
  title: string;
  description: string;
  type: 'warning' | 'success' | 'info';
  icon: React.ReactNode;
  actionText: string;
  actionUrl?: string;
}

export function FinancialInsights() {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const generateInsights = async () => {
      try {
        setLoading(true);

        // Fetch transactions from the last 2 months to generate insights
        const now = new Date();
        const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        const response = await fetch(
          `/api/plaid/transactions?startDate=${twoMonthsAgo.toISOString()}&endDate=${now.toISOString()}&limit=500`
        );

        if (!response.ok) {
          // 401 means user not authenticated - show empty state silently
          if (response.status === 401) {
            setInsights([]);
            setError(null);
            setLoading(false);
            return;
          }
          throw new Error('Failed to fetch transactions');
        }

        const data = await response.json();
        const transactions = data.transactions || [];

        if (transactions.length === 0) {
          setInsights([]);
          setError(null);
          setLoading(false);
          return;
        }

        // Separate this month's and last month's transactions
        const thisMonthTx = transactions.filter((tx: { date: string }) => new Date(tx.date) >= thisMonthStart);
        const lastMonthTx = transactions.filter((tx: { date: string }) => {
          const txDate = new Date(tx.date);
          return txDate >= oneMonthAgo && txDate < thisMonthStart;
        });

        // Calculate spending by category for both months
        const thisMonthSpending: Record<string, number> = {};
        const lastMonthSpending: Record<string, number> = {};

        thisMonthTx.forEach((tx: { amount: number; category: string | null }) => {
          if (tx.amount > 0) {
            const category = (tx.category || 'Other').split(',')[0]?.trim() || 'Other';
            thisMonthSpending[category] = (thisMonthSpending[category] || 0) + tx.amount;
          }
        });

        lastMonthTx.forEach((tx: { amount: number; category: string | null }) => {
          if (tx.amount > 0) {
            const category = (tx.category || 'Other').split(',')[0]?.trim() || 'Other';
            lastMonthSpending[category] = (lastMonthSpending[category] || 0) + tx.amount;
          }
        });

        const generatedInsights: Insight[] = [];

        // Generate insights based on spending comparisons
        Object.entries(thisMonthSpending).forEach(([category, thisAmount]) => {
          const lastAmount = lastMonthSpending[category] || 0;
          if (lastAmount > 0) {
            const percentChange = ((thisAmount - lastAmount) / lastAmount) * 100;

            if (percentChange > 25 && thisAmount > 100) {
              // Spending increased significantly
              generatedInsights.push({
                id: `increase-${category}`,
                title: `${category} spending is up`,
                description: `Your ${category.toLowerCase()} expenses are ${Math.round(percentChange)}% higher than last month.`,
                type: 'warning',
                icon: <ArrowTrendingUpIcon className="w-5 h-5" />,
                actionText: 'View transactions',
                actionUrl: '/dashboard/finance/transactions',
              });
            } else if (percentChange < -20 && lastAmount > 100) {
              // Spending decreased significantly
              generatedInsights.push({
                id: `decrease-${category}`,
                title: `${category} spending reduced`,
                description: `Your ${category.toLowerCase()} expenses are ${Math.round(Math.abs(percentChange))}% lower than last month.`,
                type: 'success',
                icon: <ArrowTrendingDownIcon className="w-5 h-5" />,
                actionText: 'See details',
                actionUrl: '/dashboard/finance/transactions',
              });
            }
          }
        });

        // Calculate total income and expenses for savings rate insight
        const thisMonthIncome = thisMonthTx
          .filter((tx: { amount: number }) => tx.amount < 0)
          .reduce((sum: number, tx: { amount: number }) => sum + Math.abs(tx.amount), 0);
        const thisMonthExpenses = thisMonthTx
          .filter((tx: { amount: number }) => tx.amount > 0)
          .reduce((sum: number, tx: { amount: number }) => sum + tx.amount, 0);

        if (thisMonthIncome > 0) {
          const savingsRate = ((thisMonthIncome - thisMonthExpenses) / thisMonthIncome) * 100;

          if (savingsRate >= 20) {
            generatedInsights.push({
              id: 'savings-rate-good',
              title: 'Great savings rate',
              description: `You're saving ${savingsRate.toFixed(0)}% of your income this month. Keep it up!`,
              type: 'success',
              icon: <LightBulbIcon className="w-5 h-5" />,
              actionText: 'View cash flow',
              actionUrl: '/dashboard/finance/overview',
            });
          } else if (savingsRate < 10 && savingsRate >= 0) {
            generatedInsights.push({
              id: 'savings-rate-low',
              title: 'Low savings this month',
              description: `Your savings rate is ${savingsRate.toFixed(0)}%. Consider reviewing your expenses.`,
              type: 'warning',
              icon: <ExclamationTriangleIcon className="w-5 h-5" />,
              actionText: 'Review spending',
              actionUrl: '/dashboard/finance/transactions',
            });
          } else if (savingsRate < 0) {
            generatedInsights.push({
              id: 'overspending',
              title: 'Spending exceeds income',
              description: `You've spent more than you've earned this month. Time to review your budget.`,
              type: 'warning',
              icon: <ExclamationTriangleIcon className="w-5 h-5" />,
              actionText: 'Review budget',
              actionUrl: '/dashboard/finance/budget',
            });
          }
        }

        // Limit to top 3 insights
        setInsights(generatedInsights.slice(0, 3));
        setError(null);
      } catch (err) {
        console.error('Error generating insights:', err);
        setError('Unable to generate insights');
        setInsights([]);
      } finally {
        setLoading(false);
      }
    };

    generateInsights();
  }, []);

  const getTypeStyles = (type: string) => {
    switch (type) {
      case "warning":
        return {
          bg: "bg-amber-50 dark:bg-amber-900/20",
          icon: "text-amber-500",
          border: "border-amber-200 dark:border-amber-800"
        };
      case "success":
        return {
          bg: "bg-green-50 dark:bg-green-900/20",
          icon: "text-green-500",
          border: "border-green-200 dark:border-green-800"
        };
      case "info":
        return {
          bg: "bg-blue-50 dark:bg-blue-900/20",
          icon: "text-blue-500",
          border: "border-blue-200 dark:border-blue-800"
        };
      default:
        return {
          bg: "bg-slate-50 dark:bg-slate-700",
          icon: "text-slate-500",
          border: "border-slate-200 dark:border-slate-600"
        };
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow dark:bg-slate-800 p-6">
        <h2 className="text-xl font-semibold mb-4">Financial Insights</h2>
        <div className="animate-pulse space-y-4">
          <div className="h-24 bg-slate-200 dark:bg-slate-700 rounded"></div>
          <div className="h-24 bg-slate-200 dark:bg-slate-700 rounded"></div>
        </div>
      </div>
    );
  }

  // Empty state
  if (insights.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow dark:bg-slate-800 p-6">
        <h2 className="text-xl font-semibold mb-4">Financial Insights</h2>
        <div className="text-center py-8">
          <LightBulbIcon className="w-12 h-12 mx-auto text-slate-400 mb-4" />
          <p className="text-slate-500 dark:text-slate-400 mb-4">
            {error || "No insights available yet"}
          </p>
          <p className="text-sm text-slate-400 dark:text-slate-500 mb-4">
            Insights are generated based on your transaction history
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
        <h2 className="text-xl font-semibold">Financial Insights</h2>
        <Link
          href="/dashboard/finance/overview"
          className="text-sm font-medium text-blue-600 dark:text-blue-400 cursor-pointer hover:underline"
        >
          View All
        </Link>
      </div>

      <div className="space-y-4">
        {insights.map((insight) => {
          const styles = getTypeStyles(insight.type);

          return (
            <div
              key={insight.id}
              className={`p-4 rounded-lg border ${styles.border} ${styles.bg}`}
            >
              <div className="flex items-start">
                <div className={`mr-3 ${styles.icon}`}>
                  {insight.icon}
                </div>
                <div className="flex-1">
                  <h3 className="font-medium mb-1">{insight.title}</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300 mb-2">
                    {insight.description}
                  </p>
                  {insight.actionUrl ? (
                    <Link
                      href={insight.actionUrl}
                      className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {insight.actionText}
                    </Link>
                  ) : (
                    <button className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline focus:outline-none">
                      {insight.actionText}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Insights are generated based on your transaction history and spending patterns.
        </p>
      </div>
    </div>
  );
}
