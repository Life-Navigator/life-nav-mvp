// FILE: src/components/finance/investment/PortfolioPerformance.tsx
'use client';

import React, { useState, useEffect } from "react";
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
import { ChartBarIcon } from "@heroicons/react/24/outline";

interface PerformanceDataPoint {
  date: string;
  portfolioValue: number;
  benchmark: number;
}

type TimeRange = "1M" | "3M" | "1Y" | "3Y" | "5Y";

export function PortfolioPerformance() {
  const [timeRange, setTimeRange] = useState<TimeRange>("1Y");
  const [performanceData, setPerformanceData] = useState<Record<TimeRange, PerformanceDataPoint[]>>({
    "1M": [],
    "3M": [],
    "1Y": [],
    "3Y": [],
    "5Y": [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchPerformanceData = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/financial/investments/performance');
        if (!response.ok) {
          throw new Error('Failed to fetch performance data');
        }
        const data = await response.json();
        if (data && typeof data === 'object') {
          setPerformanceData({
            "1M": data["1M"] || [],
            "3M": data["3M"] || [],
            "1Y": data["1Y"] || [],
            "3Y": data["3Y"] || [],
            "5Y": data["5Y"] || [],
          });
        }
        setError(null);
      } catch (err) {
        console.error('Error fetching performance data:', err);
        setError(err instanceof Error ? err : new Error('Failed to fetch performance'));
        setPerformanceData({
          "1M": [],
          "3M": [],
          "1Y": [],
          "3Y": [],
          "5Y": [],
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchPerformanceData();
  }, []);

  // Get current data for selected time range
  const data = performanceData[timeRange];
  const hasData = data && data.length > 0;

  // Calculate performance metrics only if we have data
  const calculateMetrics = () => {
    if (!hasData) {
      return { portfolioPerformance: 0, benchmarkPerformance: 0, outperformance: 0 };
    }

    const firstValue = data[0];
    const lastValue = data[data.length - 1];

    const portfolioPerformance = ((lastValue.portfolioValue / firstValue.portfolioValue) - 1) * 100;
    const benchmarkPerformance = ((lastValue.benchmark / firstValue.benchmark) - 1) * 100;
    const outperformance = portfolioPerformance - benchmarkPerformance;

    return { portfolioPerformance, benchmarkPerformance, outperformance };
  };

  const { portfolioPerformance, benchmarkPerformance, outperformance } = calculateMetrics();

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

  // Loading state
  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow dark:bg-slate-800 p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">Performance</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="p-4 bg-slate-50 dark:bg-slate-700 rounded-lg animate-pulse">
              <div className="h-4 bg-slate-200 dark:bg-slate-600 rounded w-1/2 mb-2"></div>
              <div className="h-8 bg-slate-200 dark:bg-slate-600 rounded w-3/4"></div>
            </div>
          ))}
        </div>
        <div className="h-72 bg-slate-50 dark:bg-slate-700 rounded-lg animate-pulse"></div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-white rounded-lg shadow dark:bg-slate-800 p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">Performance</h2>
        </div>
        <div className="text-center py-8">
          <p className="text-red-500 mb-4">Unable to load performance data</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Check if all time ranges are empty
  const allEmpty = Object.values(performanceData).every(arr => arr.length === 0);

  // Empty state - no performance data
  if (allEmpty) {
    return (
      <div className="bg-white rounded-lg shadow dark:bg-slate-800 p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">Performance</h2>
        </div>
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center">
            <ChartBarIcon className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-medium mb-2">No Performance Data</h3>
          <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            Add investments to your portfolio to track performance over time and compare against benchmarks.
          </p>
        </div>
      </div>
    );
  }

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

      {hasData ? (
        <>
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
                data={data}
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
                ? `Your portfolio has outperformed the S&P 500 by ${formatPercent(outperformance)} over the ${timeRange} period.`
                : `Your portfolio has underperformed the S&P 500 by ${formatPercent(Math.abs(outperformance))} over the ${timeRange} period.`
              }
            </p>
          </div>
        </>
      ) : (
        <div className="text-center py-12">
          <p className="text-slate-500 dark:text-slate-400">
            No data available for the selected time period ({timeRange}).
          </p>
        </div>
      )}
    </div>
  );
}
