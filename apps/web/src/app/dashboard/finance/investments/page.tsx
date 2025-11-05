'use client';

import { Suspense, useState, useEffect } from "react";
import { InvestmentPortfolioAnalysis } from "@/components/domain/finance/investment/InvestmentPortfolioAnalysis";
import { PortfolioPerformance } from "@/components/domain/finance/investment/PortfolioPerformance";
import { AssetAllocation } from "@/components/domain/finance/investment/AssetAllocation";
import { InvestmentCalculator } from "@/components/domain/finance/investment/InvestmentCalculator";
import { PortfolioRiskAnalysis } from "@/components/domain/finance/investment/PortfolioRiskAnalysis";
import { InvestmentInsights } from "@/components/domain/finance/investment/InvestmentInsights";
import { LoadingSpinner } from "@/components/ui/loaders/LoadingSpinner";
import { useInvestmentPortfolio } from "@/hooks/useInvestments";

export default function InvestmentPage() {
  const { portfolio, isLoading, error } = useInvestmentPortfolio();
  const [summaryData, setSummaryData] = useState({
    portfolioValue: 0,
    ytdReturn: 0,
    ytdReturnValue: 0,
    dailyChange: 0,
    dailyChangePercent: 0,
    beta: 0,
    riskProfile: 'Moderate'
  });

  useEffect(() => {
    if (portfolio) {
      setSummaryData({
        portfolioValue: portfolio.totalValue,
        ytdReturn: 8.24, // In a real app, calculate from performance data
        ytdReturnValue: 32450.12, // In a real app, calculate from performance data
        dailyChange: 2134.15, // In a real app, get from daily price change
        dailyChangePercent: 0.5, // In a real app, calculate from daily price change
        beta: portfolio.riskMetrics.beta,
        riskProfile: portfolio.risk
      });
    }
  }, [portfolio]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-2xl font-bold mb-6">Investment Dashboard</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="p-6 bg-white rounded-lg shadow dark:bg-slate-800">
          <h2 className="text-xl font-semibold mb-4">Portfolio Value</h2>
          {isLoading ? (
            <div className="animate-pulse">
              <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-3/4 mb-2"></div>
              <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-1/2"></div>
            </div>
          ) : (
            <>
              <p className="text-3xl font-bold">{formatCurrency(summaryData.portfolioValue)}</p>
              <div className="flex items-center mt-2">
                <span className="text-green-500 text-sm font-medium">
                  +{formatCurrency(summaryData.dailyChange)} ({summaryData.dailyChangePercent.toFixed(2)}%)
                </span>
                <span className="text-slate-500 text-sm ml-2">Today</span>
              </div>
            </>
          )}
        </div>

        <div className="p-6 bg-white rounded-lg shadow dark:bg-slate-800">
          <h2 className="text-xl font-semibold mb-4">YTD Return</h2>
          {isLoading ? (
            <div className="animate-pulse">
              <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-1/3 mb-2"></div>
              <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-2/5"></div>
            </div>
          ) : (
            <>
              <p className="text-3xl font-bold">{summaryData.ytdReturn.toFixed(2)}%</p>
              <div className="flex items-center mt-2">
                <span className="text-green-500 text-sm font-medium">
                  +{formatCurrency(summaryData.ytdReturnValue)}
                </span>
                <span className="text-slate-500 text-sm ml-2">Since Jan 1</span>
              </div>
            </>
          )}
        </div>

        <div className="p-6 bg-white rounded-lg shadow dark:bg-slate-800">
          <h2 className="text-xl font-semibold mb-4">Risk Profile</h2>
          {isLoading ? (
            <div className="animate-pulse">
              <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-2/5 mb-2"></div>
              <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-1/2"></div>
            </div>
          ) : (
            <>
              <p className="text-3xl font-bold">{summaryData.riskProfile}</p>
              <div className="flex items-center mt-2">
                <span className="text-yellow-500 text-sm font-medium">Beta: {summaryData.beta.toFixed(2)}</span>
                <span className="text-slate-500 text-sm ml-2">vs. S&P 500</span>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Suspense fallback={<LoadingSpinner />}>
          <PortfolioPerformance />
        </Suspense>

        <Suspense fallback={<LoadingSpinner />}>
          <AssetAllocation />
        </Suspense>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Suspense fallback={<LoadingSpinner />}>
          <PortfolioRiskAnalysis />
        </Suspense>

        <Suspense fallback={<LoadingSpinner />}>
          <InvestmentInsights />
        </Suspense>
      </div>

      <div className="mb-8">
        <Suspense fallback={<LoadingSpinner />}>
          <InvestmentPortfolioAnalysis />
        </Suspense>
      </div>

      <div>
        <Suspense fallback={<LoadingSpinner />}>
          <InvestmentCalculator />
        </Suspense>
      </div>
    </div>
  );
}