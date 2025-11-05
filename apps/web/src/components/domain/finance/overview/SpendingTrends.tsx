// FILE: src/components/finance/overview/SpendingTrends.tsx
'use client';

import React, { useState } from "react";

// Mock data for spending trends
const spendingCategories = [
  { id: "cat1", name: "Housing", amount: 2100.00, color: "bg-blue-500" },
  { id: "cat2", name: "Food", amount: 850.75, color: "bg-green-500" },
  { id: "cat3", name: "Transportation", amount: 450.25, color: "bg-yellow-500" },
  { id: "cat4", name: "Entertainment", amount: 325.50, color: "bg-purple-500" },
  { id: "cat5", name: "Healthcare", amount: 275.80, color: "bg-red-500" },
  { id: "cat6", name: "Shopping", amount: 425.35, color: "bg-indigo-500" },
  { id: "cat7", name: "Other", amount: 195.20, color: "bg-gray-500" },
];

const timeRanges = ["This Month", "Last Month", "3 Months", "6 Months", "Year"];

export function SpendingTrends() {
  const [timeRange, setTimeRange] = useState("This Month");
  
  // Calculate total spending
  const totalSpending = spendingCategories.reduce((sum, cat) => sum + cat.amount, 0);
  
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
          {spendingCategories.map((category) => {
            const percentage = (category.amount / totalSpending) * 100;
            return (
              <div 
                key={category.id}
                className={`${category.color} h-full`}
                style={{ width: `${percentage}%` }}
                title={`${category.name}: $${category.amount}`}
              />
            );
          })}
        </div>
      </div>
      
      <div className="space-y-4">
        {spendingCategories.map((category) => {
          const percentage = ((category.amount / totalSpending) * 100).toFixed(1);
          return (
            <div key={category.id} className="flex items-center justify-between">
              <div className="flex items-center">
                <div className={`w-3 h-3 rounded-full ${category.color} mr-2`} />
                <span className="text-sm font-medium dark:text-white">{category.name}</span>
              </div>
              <div className="flex items-center">
                <span className="text-sm font-medium mr-2 dark:text-white">${category.amount.toLocaleString()}</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">{percentage}%</span>
              </div>
            </div>
          );
        })}
      </div>
      
      <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
        <div className="flex justify-between items-center">
          <span className="text-sm text-slate-500 dark:text-slate-400">Total Spending</span>
          <span className="text-lg font-medium dark:text-white">${totalSpending.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}