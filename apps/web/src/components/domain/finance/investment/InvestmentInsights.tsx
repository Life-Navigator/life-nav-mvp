// FILE: src/components/finance/investment/InvestmentInsights.tsx
'use client';

import React, { useState, useEffect } from "react";
import {
  LightBulbIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  BanknotesIcon,
  ArrowTrendingUpIcon,
  InformationCircleIcon
} from "@heroicons/react/24/outline";

interface PortfolioInsight {
  id: string;
  type: 'warning' | 'info' | 'success';
  title: string;
  description: string;
  action?: string;
}

interface RebalancingRecommendation {
  action: 'Reduce' | 'Increase' | 'Add New';
  ticker: string;
  name: string;
  current: number;
  target: number;
  difference: number;
}

// Map insight types to icons
const getInsightIcon = (type: string) => {
  switch (type) {
    case 'warning':
      return <ExclamationTriangleIcon className="w-5 h-5" />;
    case 'success':
      return <ArrowTrendingUpIcon className="w-5 h-5" />;
    case 'info':
    default:
      return <InformationCircleIcon className="w-5 h-5" />;
  }
};

export function InvestmentInsights() {
  const [insights, setInsights] = useState<PortfolioInsight[]>([]);
  const [recommendations, setRecommendations] = useState<RebalancingRecommendation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchInsights = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/financial/investments/insights');

        // Handle non-OK responses gracefully - show empty state
        if (!response.ok) {
          console.warn('[InvestmentInsights] API returned non-OK status:', response.status);
          setInsights([]);
          setRecommendations([]);
          setError(null);
          setIsLoading(false);
          return;
        }
        const data = await response.json();
        setInsights(data.insights || []);
        setRecommendations(data.recommendations || []);
        setError(null);
      } catch (err) {
        console.error('Error fetching investment insights:', err);
        setError(err instanceof Error ? err : new Error('Failed to fetch insights'));
        setInsights([]);
        setRecommendations([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchInsights();
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow dark:bg-slate-800 p-6">
        <h2 className="text-xl font-semibold mb-6">Investment Insights</h2>
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="p-4 rounded-lg border border-slate-200 dark:border-slate-700 animate-pulse">
              <div className="flex items-start">
                <div className="w-5 h-5 bg-slate-200 dark:bg-slate-600 rounded mr-3"></div>
                <div className="flex-1">
                  <div className="h-4 bg-slate-200 dark:bg-slate-600 rounded w-1/3 mb-2"></div>
                  <div className="h-3 bg-slate-200 dark:bg-slate-600 rounded w-full"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-white rounded-lg shadow dark:bg-slate-800 p-6">
        <h2 className="text-xl font-semibold mb-6">Investment Insights</h2>
        <div className="text-center py-8">
          <p className="text-red-500 mb-4">Unable to load investment insights</p>
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

  // Empty state - no insights
  if (insights.length === 0 && recommendations.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow dark:bg-slate-800 p-6">
        <h2 className="text-xl font-semibold mb-6">Investment Insights</h2>
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center">
            <LightBulbIcon className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-medium mb-2">No Insights Available</h3>
          <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            Add investments to your portfolio to receive personalized insights and rebalancing recommendations.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow dark:bg-slate-800 p-6">
      <h2 className="text-xl font-semibold mb-6">Investment Insights</h2>

      {insights.length > 0 && (
        <div className="space-y-4">
          {insights.map((insight) => {
            const getTypeStyles = () => {
              switch (insight.type) {
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
                default:
                  return {
                    bg: "bg-blue-50 dark:bg-blue-900/20",
                    icon: "text-blue-500",
                    border: "border-blue-200 dark:border-blue-800"
                  };
              }
            };

            const styles = getTypeStyles();

            return (
              <div
                key={insight.id}
                className={`p-4 rounded-lg border ${styles.border} ${styles.bg}`}
              >
                <div className="flex items-start">
                  <div className={`mr-3 ${styles.icon}`}>
                    {getInsightIcon(insight.type)}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium mb-1">{insight.title}</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-300 mb-2">
                      {insight.description}
                    </p>
                    {insight.action && (
                      <button className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline focus:outline-none">
                        {insight.action}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {recommendations.length > 0 && (
        <div className="mt-8">
          <h3 className="text-lg font-medium mb-4">Rebalancing Recommendations</h3>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
              <thead className="bg-slate-50 dark:bg-slate-700">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">
                    Action
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">
                    Holding
                  </th>
                  <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">
                    Current %
                  </th>
                  <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">
                    Target %
                  </th>
                  <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">
                    Difference
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                {recommendations.map((rec, index) => (
                  <tr key={index} className="hover:bg-slate-50 dark:hover:bg-slate-700">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        rec.action === "Reduce"
                          ? "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400"
                          : rec.action === "Increase"
                          ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400"
                          : "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400"
                      }`}>
                        {rec.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm font-medium text-slate-900 dark:text-white">
                        {rec.ticker}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {rec.name}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-slate-500 dark:text-slate-400">
                      {rec.current.toFixed(2)}%
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-slate-500 dark:text-slate-400">
                      {rec.target.toFixed(2)}%
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <span className={`text-sm font-medium ${
                        rec.difference > 0
                          ? "text-green-600 dark:text-green-400"
                          : "text-red-600 dark:text-red-400"
                      }`}>
                        {rec.difference > 0 ? "+" : ""}{rec.difference.toFixed(2)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 p-4 bg-slate-50 dark:bg-slate-700 rounded-lg">
            <div className="flex items-start">
              <LightBulbIcon className="w-5 h-5 text-amber-500 mr-2 mt-0.5" />
              <div>
                <h3 className="font-medium text-slate-700 dark:text-slate-300">Portfolio Optimization</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  Following these rebalancing recommendations could help optimize your portfolio.
                  Consider implementing these changes during your next portfolio review.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
