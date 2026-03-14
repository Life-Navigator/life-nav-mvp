'use client';
import React, { useState, useEffect } from 'react';
import { useSession } from '@/hooks/useSession';
import EmptyState from '@/components/common/EmptyState';

function BudgetIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      {...props}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z"
      />
    </svg>
  );
}

interface Budget {
  id: string;
  category: string;
  budgeted: number;
  spent: number;
  remaining: number;
}

export default function BudgetPage() {
  const { data: session, status } = useSession();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBudgets = async () => {
      try {
        setLoading(true);
        // TODO: Replace with actual API call
        // const response = await fetch('/api/finance/budgets');
        // const data = await response.json();
        // setBudgets(data);

        // For now, set empty array
        setBudgets([]);
      } catch (error) {
        console.error('Error fetching budgets:', error);
        setBudgets([]);
      } finally {
        setLoading(false);
      }
    };

    if (status === 'authenticated') {
      fetchBudgets();
    }
  }, [status]);

  if (status === 'loading' || loading) {
    return (
      <div className="container mx-auto py-6 px-4 md:px-6">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white mb-6">
          Budget
        </h1>
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400">Loading budgets...</p>
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <div className="container mx-auto py-6 px-4 md:px-6">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white mb-6">
          Budget
        </h1>
        <p className="text-gray-600 dark:text-gray-400">Please sign in to view your budgets.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-4 md:px-6">
      <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white mb-6">
        Budget
      </h1>

      {budgets.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-8">
          <EmptyState
            icon={BudgetIcon}
            title="No budgets yet"
            description="Create your first budget to track your spending and savings goals. Connect your financial accounts or manually add budget categories."
            actionLabel="Connect Account"
            actionHref="/dashboard/integrations"
            secondaryActionLabel="Learn More"
            secondaryActionHref="/dashboard/finance"
          />
        </div>
      ) : (
        <div className="space-y-4">
          {budgets.map((budget) => (
            <div
              key={budget.id}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4"
            >
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {budget.category}
              </h3>
              <div className="mt-2 flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">
                  Budgeted: ${budget.budgeted}
                </span>
                <span className="text-gray-600 dark:text-gray-400">Spent: ${budget.spent}</span>
                <span className="text-gray-600 dark:text-gray-400">
                  Remaining: ${budget.remaining}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
