// FILE: src/components/finance/overview/UpcomingBills.tsx
'use client';

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { CalendarDaysIcon } from "@heroicons/react/24/outline";

interface Bill {
  id: string;
  name: string;
  amount: number;
  dueDate: Date;
  category: string;
}

export function UpcomingBills() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRecurringBills = async () => {
      try {
        setLoading(true);

        // Fetch recent transactions to identify recurring payments
        const now = new Date();
        const startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1); // Look back 2 months

        const response = await fetch(
          `/api/plaid/transactions?startDate=${startDate.toISOString()}&endDate=${now.toISOString()}&limit=500`
        );

        if (!response.ok) {
          // 401 means user not authenticated - show empty state silently
          if (response.status === 401) {
            setBills([]);
            setError(null);
            setLoading(false);
            return;
          }
          throw new Error('Failed to fetch transactions');
        }

        const data = await response.json();
        const transactions = data.transactions || [];

        // Identify recurring bills by looking for similar merchants/names
        // that appear multiple times with similar amounts
        const merchantCounts: Record<string, { count: number; amounts: number[]; category: string; lastDate: string }> = {};

        transactions.forEach((tx: { name: string; merchantName: string | null; amount: number; category: string | null; date: string }) => {
          // Only consider expenses (positive amounts)
          if (tx.amount > 0) {
            const key = (tx.merchantName || tx.name).toLowerCase().trim();
            if (!merchantCounts[key]) {
              merchantCounts[key] = { count: 0, amounts: [], category: tx.category || 'Other', lastDate: tx.date };
            }
            merchantCounts[key].count++;
            merchantCounts[key].amounts.push(tx.amount);
            if (new Date(tx.date) > new Date(merchantCounts[key].lastDate)) {
              merchantCounts[key].lastDate = tx.date;
            }
          }
        });

        // Filter for likely recurring bills (appeared at least twice with consistent amounts)
        const recurringBills: Bill[] = [];
        const today = new Date();
        const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, today.getDate());

        Object.entries(merchantCounts).forEach(([merchant, data]) => {
          if (data.count >= 2) {
            // Check if amounts are consistent (within 10% variance)
            const avgAmount = data.amounts.reduce((a, b) => a + b, 0) / data.amounts.length;
            const variance = Math.max(...data.amounts) - Math.min(...data.amounts);
            const isConsistent = variance / avgAmount < 0.1;

            if (isConsistent || data.count >= 3) {
              // Estimate next due date based on last payment
              const lastDate = new Date(data.lastDate);
              const estimatedNextDate = new Date(lastDate);
              estimatedNextDate.setMonth(estimatedNextDate.getMonth() + 1);

              // Only include if the estimated date is in the future (within next 30 days)
              if (estimatedNextDate > today && estimatedNextDate <= nextMonth) {
                recurringBills.push({
                  id: merchant,
                  name: merchant.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
                  amount: avgAmount,
                  dueDate: estimatedNextDate,
                  category: data.category.split(',')[0]?.trim() || 'Other',
                });
              }
            }
          }
        });

        // Sort by due date
        recurringBills.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

        setBills(recurringBills.slice(0, 5)); // Show top 5 upcoming bills
        setError(null);
      } catch (err) {
        console.error('Error fetching recurring bills:', err);
        setError('Unable to load upcoming bills');
        setBills([]);
      } finally {
        setLoading(false);
      }
    };

    fetchRecurringBills();
  }, []);

  // Format date as "May 10"
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Calculate days until due date
  const getDaysUntil = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(date);
    dueDate.setHours(0, 0, 0, 0);
    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // Calculate total upcoming bills
  const totalUpcoming = bills.reduce((sum, bill) => sum + bill.amount, 0);

  // Loading state
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow dark:bg-slate-800 p-6">
        <h2 className="text-xl font-semibold mb-4">Upcoming Bills</h2>
        <div className="animate-pulse space-y-4">
          <div className="h-12 bg-slate-200 dark:bg-slate-700 rounded"></div>
          <div className="h-12 bg-slate-200 dark:bg-slate-700 rounded"></div>
          <div className="h-12 bg-slate-200 dark:bg-slate-700 rounded"></div>
        </div>
      </div>
    );
  }

  // Empty state
  if (bills.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow dark:bg-slate-800 p-6">
        <h2 className="text-xl font-semibold mb-4">Upcoming Bills</h2>
        <div className="text-center py-8">
          <CalendarDaysIcon className="w-12 h-12 mx-auto text-slate-400 mb-4" />
          <p className="text-slate-500 dark:text-slate-400 mb-4">
            {error || "No upcoming bills detected"}
          </p>
          <p className="text-sm text-slate-400 dark:text-slate-500 mb-4">
            Bills are automatically detected from your recurring transactions
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
        <h2 className="text-xl font-semibold">Upcoming Bills</h2>
        <Link
          href="/dashboard/finance/transactions"
          className="text-sm font-medium text-blue-600 dark:text-blue-400 cursor-pointer hover:underline"
        >
          View All
        </Link>
      </div>

      <div className="space-y-4 mb-6">
        {bills.map((bill) => {
          const daysUntil = getDaysUntil(bill.dueDate);
          let statusColor = "text-yellow-500";
          if (daysUntil <= 3) statusColor = "text-red-500";
          if (daysUntil > 10) statusColor = "text-green-500";

          return (
            <div
              key={bill.id}
              className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-slate-700 last:border-none"
            >
              <div>
                <p className="font-medium">{bill.name}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">{bill.category}</p>
              </div>
              <div className="text-right">
                <p className="font-medium">${bill.amount.toFixed(2)}</p>
                <p className={`text-sm ${statusColor}`}>
                  Due {formatDate(bill.dueDate)} ({daysUntil} days)
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
        <div className="flex justify-between items-center">
          <span className="text-sm text-slate-500 dark:text-slate-400">Total Upcoming</span>
          <span className="text-lg font-medium dark:text-white">${totalUpcoming.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}
