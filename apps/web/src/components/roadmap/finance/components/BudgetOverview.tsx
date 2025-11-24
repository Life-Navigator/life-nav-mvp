'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/cards/Card';
import { Button } from '@/components/ui/buttons/Button';

interface BudgetCategory {
  category: string;
  planned: number;
  actual: number;
  variance: number;
}

interface IncomeSource {
  source: string;
  amount: number;
}

interface SavingsGoal {
  name: string;
  target: number;
  current: number;
  monthly: number;
}

export function BudgetOverview() {
  const [budgetData, setBudgetData] = useState<BudgetCategory[]>([]);
  const [incomeData, setIncomeData] = useState<IncomeSource[]>([]);
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [timeframe, setTimeframe] = useState<'monthly' | 'yearly'>('monthly');
  const [viewMode, setViewMode] = useState<'table' | 'chart'>('table');

  useEffect(() => {
    const fetchBudgetData = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/financial/budget');
        if (!response.ok) {
          throw new Error('Failed to fetch budget data');
        }
        const data = await response.json();
        setBudgetData(data.categories || []);
        setIncomeData(data.income || []);
        setSavingsGoals(data.savingsGoals || []);
        setError(null);
      } catch (err) {
        console.error('Error fetching budget data:', err);
        setError(err instanceof Error ? err : new Error('Failed to fetch budget'));
        setBudgetData([]);
        setIncomeData([]);
        setSavingsGoals([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBudgetData();
  }, []);

  // Calculate totals
  const totalPlanned = budgetData.reduce((sum, item) => sum + item.planned, 0);
  const totalActual = budgetData.reduce((sum, item) => sum + item.actual, 0);
  const totalVariance = budgetData.reduce((sum, item) => sum + item.variance, 0);
  const totalIncome = incomeData.reduce((sum, item) => sum + item.amount, 0);
  const netCashflow = totalIncome - totalActual;
  const savingsRate = totalIncome > 0 ? Math.round((netCashflow / totalIncome) * 100) : 0;

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-semibold">Budget Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Card key={i} className="p-4">
              <div className="animate-pulse">
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/2 mb-2"></div>
                <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-3/4"></div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Empty state - no budget data
  if (budgetData.length === 0 && incomeData.length === 0) {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-semibold">Budget Overview</h2>
        <Card className="p-8 text-center">
          <div className="max-w-md mx-auto">
            <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium mb-2">No Budget Set Up</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              Create a budget to track your income, expenses, and savings goals.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button>Create Budget</Button>
              <Button variant="outline">Import from Bank</Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-4">
        <h2 className="text-xl font-semibold">Budget Overview</h2>
        <div className="flex space-x-2">
          <div className="flex rounded-md overflow-hidden border border-gray-300">
            <Button
              onClick={() => setTimeframe('monthly')}
              variant={timeframe === 'monthly' ? 'default' : 'ghost'}
              size="sm"
              className="rounded-none"
            >
              Monthly
            </Button>
            <Button
              onClick={() => setTimeframe('yearly')}
              variant={timeframe === 'yearly' ? 'default' : 'ghost'}
              size="sm"
              className="rounded-none"
            >
              Yearly
            </Button>
          </div>
          <div className="flex rounded-md overflow-hidden border border-gray-300">
            <Button
              onClick={() => setViewMode('table')}
              variant={viewMode === 'table' ? 'default' : 'ghost'}
              size="sm"
              className="rounded-none"
            >
              Table
            </Button>
            <Button
              onClick={() => setViewMode('chart')}
              variant={viewMode === 'chart' ? 'default' : 'ghost'}
              size="sm"
              className="rounded-none"
            >
              Chart
            </Button>
          </div>
        </div>
      </div>

      {/* Financial Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="p-4">
          <h3 className="text-sm font-medium text-gray-500 mb-1">Total Income</h3>
          <p className="text-2xl font-semibold">${totalIncome.toLocaleString()}</p>
          <p className="text-sm text-gray-500 mt-1">{timeframe === 'monthly' ? 'per month' : 'per year'}</p>
        </Card>
        <Card className="p-4">
          <h3 className="text-sm font-medium text-gray-500 mb-1">Total Expenses</h3>
          <p className="text-2xl font-semibold">${totalActual.toLocaleString()}</p>
          <p className="text-sm text-gray-500 mt-1">{timeframe === 'monthly' ? 'per month' : 'per year'}</p>
        </Card>
        <Card className="p-4">
          <h3 className="text-sm font-medium text-gray-500 mb-1">Net Cashflow</h3>
          <p className={`text-2xl font-semibold ${netCashflow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            ${netCashflow.toLocaleString()}
          </p>
          <p className="text-sm text-gray-500 mt-1">Saving {savingsRate}% of income</p>
        </Card>
      </div>

      {/* Budget Categories */}
      {budgetData.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-medium mb-4">Budget Categories</h3>

          {viewMode === 'table' ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Category</th>
                    <th className="px-4 py-2 text-right text-sm font-medium text-gray-500">Planned</th>
                    <th className="px-4 py-2 text-right text-sm font-medium text-gray-500">Actual</th>
                    <th className="px-4 py-2 text-right text-sm font-medium text-gray-500">Variance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {budgetData.map((item, index) => (
                    <tr key={index}>
                      <td className="px-4 py-3 text-sm">{item.category}</td>
                      <td className="px-4 py-3 text-sm text-right">${item.planned}</td>
                      <td className="px-4 py-3 text-sm text-right">${item.actual}</td>
                      <td className={`px-4 py-3 text-sm text-right ${item.variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {item.variance >= 0 ? '+' : ''}{item.variance}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50 font-medium">
                    <td className="px-4 py-3 text-sm">Total</td>
                    <td className="px-4 py-3 text-sm text-right">${totalPlanned}</td>
                    <td className="px-4 py-3 text-sm text-right">${totalActual}</td>
                    <td className={`px-4 py-3 text-sm text-right ${totalVariance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {totalVariance >= 0 ? '+' : ''}{totalVariance}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <div className="space-y-2">
              {budgetData.map((item, index) => (
                <div key={index} className="flex flex-col">
                  <div className="flex justify-between mb-1">
                    <span className="text-sm">{item.category}</span>
                    <span className="text-sm">${item.actual} / ${item.planned}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2">
                    <div
                      className={`h-2.5 rounded-full ${
                        item.actual <= item.planned ? 'bg-green-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${Math.min(100, (item.actual / item.planned) * 100)}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Income Sources */}
      {incomeData.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-medium mb-4">Income Sources</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Source</th>
                  <th className="px-4 py-2 text-right text-sm font-medium text-gray-500">Amount</th>
                  <th className="px-4 py-2 text-right text-sm font-medium text-gray-500">% of Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {incomeData.map((item, index) => (
                  <tr key={index}>
                    <td className="px-4 py-3 text-sm">{item.source}</td>
                    <td className="px-4 py-3 text-sm text-right">${item.amount}</td>
                    <td className="px-4 py-3 text-sm text-right">
                      {totalIncome > 0 ? Math.round((item.amount / totalIncome) * 100) : 0}%
                    </td>
                  </tr>
                ))}
                <tr className="bg-gray-50 font-medium">
                  <td className="px-4 py-3 text-sm">Total</td>
                  <td className="px-4 py-3 text-sm text-right">${totalIncome}</td>
                  <td className="px-4 py-3 text-sm text-right">100%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Savings Goals */}
      {savingsGoals.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-medium mb-4">Savings Goals</h3>
          <div className="space-y-6">
            {savingsGoals.map((goal, index) => {
              const progressPercent = goal.target > 0 ? Math.round((goal.current / goal.target) * 100) : 0;

              return (
                <div key={index} className="space-y-2">
                  <div className="flex justify-between items-end">
                    <div>
                      <h4 className="font-medium">{goal.name}</h4>
                      <p className="text-sm text-gray-500">
                        ${goal.current.toLocaleString()} of ${goal.target.toLocaleString()}
                      </p>
                    </div>
                    <p className="text-sm font-medium">{progressPercent}%</p>
                  </div>
                  <div className="relative w-full">
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div
                        className="bg-blue-500 h-2.5 rounded-full"
                        style={{ width: `${progressPercent}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between mt-1">
                      <p className="text-xs text-gray-500">
                        Contributing ${goal.monthly}/mo
                      </p>
                      <p className="text-xs text-gray-500">
                        {goal.monthly > 0 ? Math.ceil((goal.target - goal.current) / goal.monthly) : '∞'} months left
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}

            <Button size="sm" variant="outline" className="mt-4">
              Add New Savings Goal
            </Button>
          </div>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2 mt-6">
        <Button>
          Adjust Budget
        </Button>
        <Button variant="outline">
          Set Up Auto-Transfers
        </Button>
        <Button variant="outline">
          Schedule Bill Payments
        </Button>
      </div>
    </div>
  );
}
