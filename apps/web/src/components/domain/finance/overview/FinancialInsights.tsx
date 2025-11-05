// FILE: src/components/finance/overview/FinancialInsights.tsx

import React from "react";
import { LightBulbIcon, ArrowTrendingUpIcon, ArrowTrendingDownIcon } from "@heroicons/react/24/outline";

// Mock data for financial insights
const insights = [
  {
    id: "insight1",
    title: "Restaurant spending is up",
    description: "Your dining out expenses are 28% higher than last month.",
    type: "warning",
    icon: <ArrowTrendingUpIcon className="w-5 h-5" />,
    actionText: "See details",
  },
  {
    id: "insight2",
    title: "Electricity bill reduced",
    description: "Your electricity bill is 14% lower compared to the same month last year.",
    type: "success",
    icon: <ArrowTrendingDownIcon className="w-5 h-5" />,
    actionText: "Compare bills",
  },
  {
    id: "insight3",
    title: "Emergency fund goal",
    description: "You're 85% of the way to your emergency fund goal of $25,000.",
    type: "info",
    icon: <LightBulbIcon className="w-5 h-5" />,
    actionText: "Adjust goal",
  },
];

export function FinancialInsights() {
  const getTypeStyles = (type: string) => {
    switch (type) {
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
        return { 
          bg: "bg-blue-50 dark:bg-blue-900/20", 
          icon: "text-blue-500", 
          border: "border-blue-200 dark:border-blue-800" 
        };
      default:
        return { 
          bg: "bg-slate-50 dark:bg-slate-700", 
          icon: "text-slate-500", 
          border: "border-slate-200 dark:border-slate-600" 
        };
    }
  };
  
  return (
    <div className="bg-white rounded-lg shadow dark:bg-slate-800 p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Financial Insights</h2>
        <span className="text-sm font-medium text-blue-600 dark:text-blue-400 cursor-pointer hover:underline">
          View All
        </span>
      </div>
      
      <div className="space-y-4">
        {insights.map((insight) => {
          const styles = getTypeStyles(insight.type);
          
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
                    {insight.actionText}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Insights are generated based on your transaction history and financial goals.
        </p>
      </div>
    </div>
  );
}