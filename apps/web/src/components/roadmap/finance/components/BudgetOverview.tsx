'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/cards/Card';
import { Button } from '@/components/ui/buttons/Button';

// Mock data for budget categories
const mockBudgetData = [
  { category: 'Housing', planned: 2000, actual: 2100, variance: -100 },
  { category: 'Food', planned: 800, actual: 750, variance: 50 },
  { category: 'Transportation', planned: 450, actual: 420, variance: 30 },
  { category: 'Utilities', planned: 350, actual: 380, variance: -30 },
  { category: 'Insurance', planned: 250, actual: 250, variance: 0 },
  { category: 'Debt Payments', planned: 600, actual: 600, variance: 0 },
  { category: 'Savings', planned: 1000, actual: 750, variance: -250 },
  { category: 'Entertainment', planned: 300, actual: 450, variance: -150 },
  { category: 'Personal', planned: 200, actual: 350, variance: -150 },
  { category: 'Miscellaneous', planned: 100, actual: 120, variance: -20 },
];

// Mock data for monthly income
const mockIncomeData = [
  { source: 'Primary Job', amount: 5000 },
  { source: 'Side Hustle', amount: 800 },
  { source: 'Investments', amount: 250 },
];

// Mock data for savings goals
const mockSavingsGoals = [
  { name: 'Emergency Fund', target: 25000, current: 15000, monthly: 1000 },
  { name: 'Home Down Payment', target: 60000, current: 12000, monthly: 1500 },
  { name: 'Vacation', target: 5000, current: 2500, monthly: 500 },
];

export function BudgetOverview() {
  const [timeframe, setTimeframe] = useState<'monthly' | 'yearly'>('monthly');
  const [viewMode, setViewMode] = useState<'table' | 'chart'>('table');
  
  // Calculate totals
  const totalPlanned = mockBudgetData.reduce((sum, item) => sum + item.planned, 0);
  const totalActual = mockBudgetData.reduce((sum, item) => sum + item.actual, 0);
  const totalVariance = mockBudgetData.reduce((sum, item) => sum + item.variance, 0);
  
  const totalIncome = mockIncomeData.reduce((sum, item) => sum + item.amount, 0);
  const netCashflow = totalIncome - totalActual;
  const savingsRate = Math.round((netCashflow / totalIncome) * 100);
  
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
                {mockBudgetData.map((item, index) => (
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
            {mockBudgetData.map((item, index) => (
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
      
      {/* Income Sources */}
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
              {mockIncomeData.map((item, index) => (
                <tr key={index}>
                  <td className="px-4 py-3 text-sm">{item.source}</td>
                  <td className="px-4 py-3 text-sm text-right">${item.amount}</td>
                  <td className="px-4 py-3 text-sm text-right">
                    {Math.round((item.amount / totalIncome) * 100)}%
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
      
      {/* Savings Goals */}
      <Card className="p-6">
        <h3 className="text-lg font-medium mb-4">Savings Goals</h3>
        <div className="space-y-6">
          {mockSavingsGoals.map((goal, index) => {
            const progressPercent = Math.round((goal.current / goal.target) * 100);
            
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
                      {Math.ceil((goal.target - goal.current) / goal.monthly)} months left
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