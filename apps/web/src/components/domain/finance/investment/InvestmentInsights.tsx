// FILE: src/components/finance/investment/InvestmentInsights.tsx

import React from "react";
import { 
  LightBulbIcon, 
  ExclamationTriangleIcon, 
  CheckCircleIcon,
  BanknotesIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon
} from "@heroicons/react/24/outline";

// Mock insights data
const portfolioInsights = [
  {
    id: "insight1",
    type: "warning",
    title: "High tech concentration",
    description: "Tech sector (42%) exceeds recommended maximum of 30% for your risk profile.",
    icon: <ExclamationTriangleIcon className="w-5 h-5" />,
    action: "Review allocation",
  },
  {
    id: "insight2",
    type: "info",
    title: "Dividend growth opportunity",
    description: "Portfolio yield (1.78%) is below market average. Consider adding dividend stocks.",
    icon: <BanknotesIcon className="w-5 h-5" />,
    action: "See suggestions",
  },
  {
    id: "insight3",
    type: "success",
    title: "Portfolio outperformance",
    description: "Your portfolio has outperformed the S&P 500 by 1.5% over the past year.",
    icon: <ArrowTrendingUpIcon className="w-5 h-5" />,
    action: "View details",
  },
  {
    id: "insight4",
    type: "warning",
    title: "Single stock exposure",
    description: "AAPL and MSFT each represent >15% of portfolio, creating concentration risk.",
    icon: <ExclamationTriangleIcon className="w-5 h-5" />,
    action: "Diversify holdings",
  },
  {
    id: "insight5",
    type: "info",
    title: "Retirement planning",
    description: "Based on your growth rate, you're on track to meet your retirement goal of $1.2M by 2045.",
    icon: <CheckCircleIcon className="w-5 h-5" />,
    action: "View projection",
  },
];

// Mock rebalancing recommendations
const rebalancingRecommendations = [
  {
    action: "Reduce",
    ticker: "AAPL",
    name: "Apple Inc.",
    current: 15.21,
    target: 10.00,
    difference: -5.21,
  },
  {
    action: "Reduce",
    ticker: "MSFT",
    name: "Microsoft Corp.",
    current: 15.25,
    target: 10.00,
    difference: -5.25,
  },
  {
    action: "Increase",
    ticker: "VBTLX",
    name: "Vanguard Total Bond Market Index",
    current: 15.06,
    target: 25.00,
    difference: 9.94,
  },
  {
    action: "Add New",
    ticker: "VYM",
    name: "Vanguard High Dividend Yield ETF",
    current: 0,
    target: 5.00,
    difference: 5.00,
  },
];

export function InvestmentInsights() {
  return (
    <div className="bg-white rounded-lg shadow dark:bg-slate-800 p-6">
      <h2 className="text-xl font-semibold mb-6">Investment Insights</h2>
      
      <div className="space-y-4">
        {portfolioInsights.map((insight) => {
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
                  {insight.icon}
                </div>
                <div className="flex-1">
                  <h3 className="font-medium mb-1">{insight.title}</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300 mb-2">
                    {insight.description}
                  </p>
                  <button className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline focus:outline-none">
                    {insight.action}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
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
              {rebalancingRecommendations.map((rec, index) => (
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
                Following these rebalancing recommendations could potentially reduce portfolio volatility by 12% while maintaining similar returns. Consider implementing these changes during your next portfolio review.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}