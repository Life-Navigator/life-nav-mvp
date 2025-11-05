// FILE: src/components/finance/investment/PortfolioPerformance.tsx
'use client';

import React, { useState } from "react";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from "recharts";

// Mock performance data
const performanceData = {
  "1M": [
    { date: "05/05", portfolioValue: 170075, benchmark: 168200 },
    { date: "05/12", portfolioValue: 168400, benchmark: 167500 },
    { date: "05/19", portfolioValue: 167200, benchmark: 166800 },
    { date: "05/26", portfolioValue: 169300, benchmark: 167900 },
    { date: "06/02", portfolioValue: 170750, benchmark: 169200 },
  ],
  "3M": [
    { date: "Mar", portfolioValue: 162300, benchmark: 160500 },
    { date: "Apr", portfolioValue: 165800, benchmark: 164200 },
    { date: "May", portfolioValue: 170750, benchmark: 169200 },
  ],
  "1Y": [
    { date: "Jun 24", portfolioValue: 138500, benchmark: 140200 },
    { date: "Sep 24", portfolioValue: 144800, benchmark: 145500 },
    { date: "Dec 24", portfolioValue: 156200, benchmark: 154800 },
    { date: "Mar 25", portfolioValue: 165800, benchmark: 164200 },
    { date: "May 25", portfolioValue: 170750, benchmark: 169200 },
  ],
  "3Y": [
    { date: "2022", portfolioValue: 112500, benchmark: 115800 },
    { date: "2023", portfolioValue: 135600, benchmark: 132500 },
    { date: "2024", portfolioValue: 156200, benchmark: 154800 },
    { date: "2025", portfolioValue: 170750, benchmark: 169200 },
  ],
  "5Y": [
    { date: "2021", portfolioValue: 92400, benchmark: 95600 },
    { date: "2022", portfolioValue: 112500, benchmark: 115800 },
    { date: "2023", portfolioValue: 135600, benchmark: 132500 },
    { date: "2024", portfolioValue: 156200, benchmark: 154800 },
    { date: "2025", portfolioValue: 170750, benchmark: 169200 },
  ],
};

type TimeRange = "1M" | "3M" | "1Y" | "3Y" | "5Y";

export function PortfolioPerformance() {
  const [timeRange, setTimeRange] = useState<TimeRange>("1Y");
  
  // Calculate performance metrics
  const data = performanceData[timeRange];
  const firstValue = data[0];
  const lastValue = data[data.length - 1];
  
  const portfolioPerformance = ((lastValue.portfolioValue / firstValue.portfolioValue) - 1) * 100;
  const benchmarkPerformance = ((lastValue.benchmark / firstValue.benchmark) - 1) * 100;
  const outperformance = portfolioPerformance - benchmarkPerformance;
  
  // Format percentage
  const formatPercent = (value: number) => {
    return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
  };
  
  // Format currency for tooltip
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };
  
  // Custom tooltip for chart
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-slate-800 p-3 border border-slate-200 dark:border-slate-700 rounded shadow-lg">
          <p className="font-medium mb-1">{label}</p>
          <p className="text-sm text-blue-600 dark:text-blue-400">
            Portfolio: {formatCurrency(payload[0].value)}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Benchmark: {formatCurrency(payload[1].value)}
          </p>
        </div>
      );
    }
    return null;
  };
  
  return (
    <div className="bg-white rounded-lg shadow dark:bg-slate-800 p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Performance</h2>
        <div className="flex space-x-1 bg-slate-100 dark:bg-slate-700 rounded-lg p-1">
          {(["1M", "3M", "1Y", "3Y", "5Y"] as TimeRange[]).map((range) => (
            <button
              key={range}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                timeRange === range 
                  ? "bg-white dark:bg-slate-600 text-blue-600 dark:text-blue-400 shadow-sm" 
                  : "text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
              }`}
              onClick={() => setTimeRange(range)}
            >
              {range}
            </button>
          ))}
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="p-4 bg-slate-50 dark:bg-slate-700 rounded-lg">
          <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Portfolio Return</h3>
          <p className={`text-2xl font-bold ${
            portfolioPerformance >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500"
          }`}>
            {formatPercent(portfolioPerformance)}
          </p>
        </div>
        
        <div className="p-4 bg-slate-50 dark:bg-slate-700 rounded-lg">
          <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Benchmark Return</h3>
          <p className={`text-2xl font-bold ${
            benchmarkPerformance >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500"
          }`}>
            {formatPercent(benchmarkPerformance)}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">S&P 500</p>
        </div>
        
        <div className="p-4 bg-slate-50 dark:bg-slate-700 rounded-lg">
          <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Alpha</h3>
          <p className={`text-2xl font-bold ${
            outperformance >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500"
          }`}>
            {formatPercent(outperformance)}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Excess return vs benchmark</p>
        </div>
      </div>
      
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={performanceData[timeRange]}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis 
              domain={['dataMin - 5000', 'dataMax + 5000']}
              tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="portfolioValue" 
              name="Portfolio" 
              stroke="#3B82F6" 
              strokeWidth={2} 
              activeDot={{ r: 8 }} 
            />
            <Line 
              type="monotone" 
              dataKey="benchmark" 
              name="Benchmark (S&P 500)" 
              stroke="#6B7280" 
              strokeWidth={2} 
              dot={{ r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      
      <div className="mt-6 p-4 bg-slate-50 dark:bg-slate-700 rounded-lg">
        <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Performance Insights</h3>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {outperformance >= 0 
            ? `Your portfolio has outperformed the S&P 500 by ${formatPercent(outperformance)} over the ${timeRange} period. This outperformance is mainly driven by technology sector allocations.`
            : `Your portfolio has underperformed the S&P 500 by ${formatPercent(Math.abs(outperformance))} over the ${timeRange} period. Underweight positions in energy and financials may be contributing factors.`
          }
        </p>
      </div>
    </div>
  );
}