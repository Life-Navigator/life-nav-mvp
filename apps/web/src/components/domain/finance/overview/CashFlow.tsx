// FILE: src/components/finance/overview/CashFlow.tsx
'use client';

import React, { useState } from "react";

// Mock data for cash flow
const cashFlowData = {
  monthly: {
    income: 8250.00,
    expenses: 5415.85,
    savings: 1834.15,
    savingsRate: 22.23,
  },
  income: [
    { category: "Salary", amount: 7500.00 },
    { category: "Freelance", amount: 750.00 },
  ],
  expenses: [
    { category: "Housing", amount: 2100.00 },
    { category: "Food", amount: 850.75 },
    { category: "Transportation", amount: 450.25 },
    { category: "Entertainment", amount: 325.50 },
    { category: "Healthcare", amount: 275.80 },
    { category: "Shopping", amount: 425.35 },
    { category: "Utilities", amount: 345.00 },
    { category: "Insurance", amount: 225.00 },
    { category: "Other", amount: 418.20 },
  ],
};

export function CashFlow() {
  const [viewMode, setViewMode] = useState<"summary" | "income" | "expenses">("summary");
  
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
                ${cashFlowData.monthly.income.toLocaleString()}
              </p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-700 p-4 rounded-lg">
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Monthly Expenses</p>
              <p className="text-xl font-semibold text-red-500">
                ${cashFlowData.monthly.expenses.toLocaleString()}
              </p>
            </div>
          </div>
          
          <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
            <div className="flex justify-between items-center mb-4">
              <span className="font-medium">Monthly Savings</span>
              <span className="font-medium text-blue-600 dark:text-blue-400">
                ${cashFlowData.monthly.savings.toLocaleString()}
              </span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-500 dark:text-slate-400">Savings Rate</span>
              <span className="text-sm font-medium text-green-600 dark:text-green-400">
                {cashFlowData.monthly.savingsRate.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      )}
      
      {viewMode === "income" && (
        <div className="space-y-4">
          {cashFlowData.income.map((item, index) => (
            <div 
              key={index}
              className="flex justify-between items-center py-3 border-b border-slate-100 dark:border-slate-700 last:border-none"
            >
              <span>{item.category}</span>
              <span className="font-medium text-green-600 dark:text-green-400">
                ${item.amount.toLocaleString()}
              </span>
            </div>
          ))}
          
          <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
            <div className="flex justify-between items-center">
              <span className="font-medium">Total Income</span>
              <span className="font-medium text-green-600 dark:text-green-400">
                ${cashFlowData.monthly.income.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      )}
      
      {viewMode === "expenses" && (
        <div className="space-y-4">
          {cashFlowData.expenses.map((item, index) => (
            <div 
              key={index}
              className="flex justify-between items-center py-3 border-b border-slate-100 dark:border-slate-700 last:border-none"
            >
              <span>{item.category}</span>
              <span className="font-medium text-red-500">
                ${item.amount.toLocaleString()}
              </span>
            </div>
          ))}
          
          <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
            <div className="flex justify-between items-center">
              <span className="font-medium">Total Expenses</span>
              <span className="font-medium text-red-500">
                ${cashFlowData.monthly.expenses.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}