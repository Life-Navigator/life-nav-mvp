// FILE: src/components/finance/investment/PortfolioRiskAnalysis.tsx
'use client';

import React, { useState } from "react";
import { 
  BarChart, 
  Bar, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from "recharts";
import { InformationCircleIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";

// Mock risk data
const riskMetrics = {
  beta: 0.85,
  sharpeRatio: 1.12,
  volatility: 12.4,
  maxDrawdown: -18.6,
  downside: 10.2,
  concentrationRisk: 27.5,
};

// Mock risk alerts
const riskAlerts = [
  {
    id: "risk1",
    type: "warning",
    title: "Sector concentration",
    description: "Technology sector represents 42% of your portfolio, increasing volatility risk.",
  },
  {
    id: "risk2",
    type: "info",
    title: "Market correlation",
    description: "Your portfolio has a 0.85 beta, suggesting moderate market correlation.",
  },
  {
    id: "risk3",
    type: "warning",
    title: "Single stock exposure",
    description: "AAPL represents 15% of your portfolio, creating concentration risk.",
  },
];

// Mock stress test data
const stressTestScenarios = [
  { name: "Market Crash (-40%)", portfolioImpact: -34 },
  { name: "Recession (-20%)", portfolioImpact: -17 },
  { name: "Tech Crash (-30%)", portfolioImpact: -26 },
  { name: "Inflation Spike", portfolioImpact: -12 },
  { name: "Interest Rate Hike", portfolioImpact: -8 },
];

export function PortfolioRiskAnalysis() {
  const [activeTab, setActiveTab] = useState<"overview" | "stressTest" | "alerts">("overview");
  
  return (
    <div className="bg-white rounded-lg shadow dark:bg-slate-800 p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Risk Analysis</h2>
        <div className="flex space-x-1 bg-slate-100 dark:bg-slate-700 rounded-lg p-1">
          <button
            className={`px-3 py-1 text-sm rounded-md transition-colors ${
              activeTab === "overview" 
                ? "bg-white dark:bg-slate-600 text-blue-600 dark:text-blue-400 shadow-sm" 
                : "text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
            }`}
            onClick={() => setActiveTab("overview")}
          >
            Overview
          </button>
          <button
            className={`px-3 py-1 text-sm rounded-md transition-colors ${
              activeTab === "stressTest" 
                ? "bg-white dark:bg-slate-600 text-blue-600 dark:text-blue-400 shadow-sm" 
                : "text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
            }`}
            onClick={() => setActiveTab("stressTest")}
          >
            Stress Test
          </button>
          <button
            className={`px-3 py-1 text-sm rounded-md transition-colors ${
              activeTab === "alerts" 
                ? "bg-white dark:bg-slate-600 text-blue-600 dark:text-blue-400 shadow-sm" 
                : "text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
            }`}
            onClick={() => setActiveTab("alerts")}
          >
            Alerts
          </button>
        </div>
      </div>
      
      {activeTab === "overview" && (
        <div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
            <div className="p-4 bg-slate-50 dark:bg-slate-700 rounded-lg">
              <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Beta</h3>
              <p className="text-2xl font-bold">{riskMetrics.beta}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">vs. S&P 500</p>
            </div>
            
            <div className="p-4 bg-slate-50 dark:bg-slate-700 rounded-lg">
              <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Sharpe Ratio</h3>
              <p className="text-2xl font-bold">{riskMetrics.sharpeRatio}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Risk-adjusted return</p>
            </div>
            
            <div className="p-4 bg-slate-50 dark:bg-slate-700 rounded-lg">
              <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Volatility</h3>
              <p className="text-2xl font-bold">{riskMetrics.volatility}%</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Annualized std. deviation</p>
            </div>
            
            <div className="p-4 bg-slate-50 dark:bg-slate-700 rounded-lg">
              <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Max Drawdown</h3>
              <p className="text-2xl font-bold text-red-500">{riskMetrics.maxDrawdown}%</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Historical worst loss</p>
            </div>
            
            <div className="p-4 bg-slate-50 dark:bg-slate-700 rounded-lg">
              <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Downside Risk</h3>
              <p className="text-2xl font-bold">{riskMetrics.downside}%</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Focus on negative returns</p>
            </div>
            
            <div className="p-4 bg-slate-50 dark:bg-slate-700 rounded-lg">
              <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Concentration Risk</h3>
              <p className="text-2xl font-bold text-amber-500">{riskMetrics.concentrationRisk}%</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Top 5 holdings</p>
            </div>
          </div>
          
          <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg mb-4">
            <div className="flex items-start">
              <ExclamationTriangleIcon className="w-5 h-5 text-amber-500 mr-2 mt-0.5" />
              <div>
                <h3 className="font-medium text-amber-800 dark:text-amber-300">Risk Assessment</h3>
                <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
                  Your portfolio has moderate risk with a concentration in technology stocks. 
                  Consider diversifying across sectors to reduce volatility.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {activeTab === "stressTest" && (
        <div>
          <div className="mb-6">
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              Stress testing shows how your portfolio might perform during various market scenarios.
            </p>
            
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={stressTestScenarios}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  layout="vertical"
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    type="number"
                    domain={[-40, 0]}
                    tickFormatter={(value) => `${value}%`}
                  />
                  <YAxis dataKey="name" type="category" width={150} />
                  <Tooltip formatter={(value) => `${value}%`} />
                  <Legend />
                  <Bar dataKey="portfolioImpact" fill="#EF4444">
                    {stressTestScenarios.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.portfolioImpact < -20 ? "#EF4444" : "#F59E0B"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          <div className="p-4 bg-slate-50 dark:bg-slate-700 rounded-lg">
            <h3 className="font-medium mb-2">Stress Test Analysis</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Your portfolio shows moderate resilience to market stress events. The tech sector 
              concentration makes it vulnerable to tech-specific downturns (-26%). Consider 
              increasing exposure to defensive assets to mitigate extreme market events.
            </p>
          </div>
        </div>
      )}
      
      {activeTab === "alerts" && (
        <div className="space-y-4">
          {riskAlerts.map((alert) => (
            <div 
              key={alert.id}
              className={`p-4 rounded-lg ${
                alert.type === 'warning' 
                  ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800' 
                  : 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
              }`}
            >
              <div className="flex items-start">
                {alert.type === 'warning' ? (
                  <ExclamationTriangleIcon className="w-5 h-5 text-amber-500 mr-2 mt-0.5" />
                ) : (
                  <InformationCircleIcon className="w-5 h-5 text-blue-500 mr-2 mt-0.5" />
                )}
                <div>
                  <h3 className={`font-medium ${
                    alert.type === 'warning' 
                      ? 'text-amber-800 dark:text-amber-300' 
                      : 'text-blue-800 dark:text-blue-300'
                  }`}>
                    {alert.title}
                  </h3>
                  <p className={`text-sm mt-1 ${
                    alert.type === 'warning' 
                      ? 'text-amber-700 dark:text-amber-400' 
                      : 'text-blue-700 dark:text-blue-400'
                  }`}>
                    {alert.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
          
          <div className="p-4 bg-slate-50 dark:bg-slate-700 rounded-lg mt-6">
            <h3 className="font-medium mb-2">Risk Management Recommendations</h3>
            <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
              <li className="flex items-start">
                <span className="text-green-500 mr-2">•</span>
                <span>Reduce technology sector exposure to below 30% of portfolio</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2">•</span>
                <span>Increase allocation to value stocks and defensive sectors</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2">•</span>
                <span>Consider adding fixed income assets to reduce overall volatility</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2">•</span>
                <span>Limit single stock positions to maximum 5% of portfolio</span>
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
