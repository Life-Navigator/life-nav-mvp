// FILE: src/components/finance/investment/PortfolioRiskAnalysis.tsx
'use client';

import React, { useState, useEffect } from "react";
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
import { InformationCircleIcon, ExclamationTriangleIcon, ShieldExclamationIcon } from "@heroicons/react/24/outline";

interface RiskMetrics {
  beta: number;
  sharpeRatio: number;
  volatility: number;
  maxDrawdown: number;
  downside: number;
  concentrationRisk: number;
}

interface RiskAlert {
  id: string;
  type: 'warning' | 'info';
  title: string;
  description: string;
}

interface StressTestScenario {
  name: string;
  portfolioImpact: number;
}

export function PortfolioRiskAnalysis() {
  const [activeTab, setActiveTab] = useState<"overview" | "stressTest" | "alerts">("overview");
  const [riskMetrics, setRiskMetrics] = useState<RiskMetrics | null>(null);
  const [riskAlerts, setRiskAlerts] = useState<RiskAlert[]>([]);
  const [stressTestScenarios, setStressTestScenarios] = useState<StressTestScenario[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchRiskData = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/financial/investments/risk');

        // Handle non-OK responses gracefully - show empty state
        if (!response.ok) {
          console.warn('[PortfolioRiskAnalysis] API returned non-OK status:', response.status);
          setRiskMetrics(null);
          setRiskAlerts([]);
          setStressTestScenarios([]);
          setError(null);
          setIsLoading(false);
          return;
        }
        const data = await response.json();
        setRiskMetrics(data.metrics || null);
        setRiskAlerts(data.alerts || []);
        setStressTestScenarios(data.stressTests || []);
        setError(null);
      } catch (err) {
        console.error('Error fetching risk data:', err);
        setError(err instanceof Error ? err : new Error('Failed to fetch risk data'));
        setRiskMetrics(null);
        setRiskAlerts([]);
        setStressTestScenarios([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRiskData();
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow dark:bg-slate-800 p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">Risk Analysis</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="p-4 bg-slate-50 dark:bg-slate-700 rounded-lg animate-pulse">
              <div className="h-4 bg-slate-200 dark:bg-slate-600 rounded w-1/2 mb-2"></div>
              <div className="h-8 bg-slate-200 dark:bg-slate-600 rounded w-3/4"></div>
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
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">Risk Analysis</h2>
        </div>
        <div className="text-center py-8">
          <p className="text-red-500 mb-4">Unable to load risk analysis data</p>
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

  // Empty state - no risk data
  if (!riskMetrics) {
    return (
      <div className="bg-white rounded-lg shadow dark:bg-slate-800 p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">Risk Analysis</h2>
        </div>
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center">
            <ShieldExclamationIcon className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-medium mb-2">No Risk Data Available</h3>
          <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            Add investments to your portfolio to see risk analysis, stress tests, and alerts.
          </p>
        </div>
      </div>
    );
  }

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
              <p className="text-2xl font-bold">{riskMetrics.beta.toFixed(2)}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">vs. S&P 500</p>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-700 rounded-lg">
              <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Sharpe Ratio</h3>
              <p className="text-2xl font-bold">{riskMetrics.sharpeRatio.toFixed(2)}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Risk-adjusted return</p>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-700 rounded-lg">
              <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Volatility</h3>
              <p className="text-2xl font-bold">{riskMetrics.volatility.toFixed(1)}%</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Annualized std. deviation</p>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-700 rounded-lg">
              <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Max Drawdown</h3>
              <p className="text-2xl font-bold text-red-500">{riskMetrics.maxDrawdown.toFixed(1)}%</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Historical worst loss</p>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-700 rounded-lg">
              <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Downside Risk</h3>
              <p className="text-2xl font-bold">{riskMetrics.downside.toFixed(1)}%</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Focus on negative returns</p>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-700 rounded-lg">
              <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Concentration Risk</h3>
              <p className={`text-2xl font-bold ${riskMetrics.concentrationRisk > 25 ? 'text-amber-500' : ''}`}>
                {riskMetrics.concentrationRisk.toFixed(1)}%
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Top 5 holdings</p>
            </div>
          </div>

          {riskMetrics.concentrationRisk > 25 && (
            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg mb-4">
              <div className="flex items-start">
                <ExclamationTriangleIcon className="w-5 h-5 text-amber-500 mr-2 mt-0.5" />
                <div>
                  <h3 className="font-medium text-amber-800 dark:text-amber-300">Risk Assessment</h3>
                  <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
                    Your portfolio shows concentration risk. Consider diversifying across sectors to reduce volatility.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "stressTest" && (
        <div>
          {stressTestScenarios.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-slate-500 dark:text-slate-400">
                No stress test data available. Add more investments to enable stress testing.
              </p>
            </div>
          ) : (
            <>
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
                      <Bar dataKey="portfolioImpact" fill="#EF4444" name="Portfolio Impact">
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
                  Review how your portfolio might perform under different market conditions.
                  Consider increasing exposure to defensive assets to mitigate extreme market events.
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === "alerts" && (
        <div className="space-y-4">
          {riskAlerts.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 mx-auto mb-4 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="font-medium mb-2">No Risk Alerts</h3>
              <p className="text-slate-500 dark:text-slate-400">
                Your portfolio has no current risk alerts. Keep monitoring for changes.
              </p>
            </div>
          ) : (
            <>
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
            </>
          )}

          <div className="p-4 bg-slate-50 dark:bg-slate-700 rounded-lg mt-6">
            <h3 className="font-medium mb-2">Risk Management Tips</h3>
            <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
              <li className="flex items-start">
                <span className="text-green-500 mr-2">•</span>
                <span>Keep sector exposure below 30% of portfolio</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2">•</span>
                <span>Consider adding defensive assets to reduce overall volatility</span>
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
