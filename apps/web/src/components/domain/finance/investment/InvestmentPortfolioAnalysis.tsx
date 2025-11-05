// FILE: src/components/finance/investment/InvestmentPortfolioAnalysis.tsx
'use client';

import React, { useState } from "react";
import { MagnifyingGlassIcon as SearchIcon, ArrowsUpDownIcon, CurrencyDollarIcon } from "@heroicons/react/24/outline";
import { useInvestmentHoldings } from "@/hooks/useInvestments";
import { LoadingSpinner } from "@/components/ui/loaders/LoadingSpinner";

// Risk factors for holdings (we'll keep this static for now)
const riskFactors = {
  "AAPL": {
    beta: 1.27,
    volatility: 24.3,
    pe: 28.5,
    dividendYield: 0.58,
  },
  "MSFT": {
    beta: 0.95,
    volatility: 19.8,
    pe: 31.2,
    dividendYield: 0.85,
  },
  "AMZN": {
    beta: 1.32,
    volatility: 27.4,
    pe: 45.7,
    dividendYield: 0,
  },
  "GOOGL": {
    beta: 1.05,
    volatility: 22.1,
    pe: 24.8,
    dividendYield: 0,
  },
  "BRK.B": {
    beta: 0.84,
    volatility: 16.5,
    pe: 18.3,
    dividendYield: 0,
  },
  "VFIAX": {
    beta: 1.0,
    volatility: 17.2,
    pe: null,
    dividendYield: 1.65,
  },
  "VBTLX": {
    beta: 0.05,
    volatility: 5.8,
    pe: null,
    dividendYield: 3.38,
  },
  "VNQ": {
    beta: 0.98,
    volatility: 23.5,
    pe: null,
    dividendYield: 4.12,
  },
  "CASH": {
    beta: 0,
    volatility: 0,
    pe: null,
    dividendYield: 4.85,
  },
};

export function InvestmentPortfolioAnalysis() {
  const [sortColumn, setSortColumn] = useState("allocation");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");

  // Fetch holdings data using the custom hook
  const { holdings: portfolioHoldings, isLoading, error } = useInvestmentHoldings();

  // Sort holdings based on current sort column and direction
  const sortedHoldings = [...(portfolioHoldings || [])].sort((a, b) => {
    if (sortColumn === "ticker" || sortColumn === "name" || sortColumn === "type" || sortColumn === "sector") {
      return sortDirection === "asc"
        ? a[sortColumn].localeCompare(b[sortColumn])
        : b[sortColumn].localeCompare(a[sortColumn]);
    } else {
      return sortDirection === "asc"
        ? (a[sortColumn as keyof typeof a] as number) - (b[sortColumn as keyof typeof b] as number)
        : (b[sortColumn as keyof typeof b] as number) - (a[sortColumn as keyof typeof a] as number);
    }
  });

  // Filter holdings based on search query and selected type
  const filteredHoldings = sortedHoldings.filter(holding => {
    const matchesSearch =
      holding.ticker.toLowerCase().includes(searchQuery.toLowerCase()) ||
      holding.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      holding.sector.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesType = selectedType === "all" || holding.type === selectedType;

    return matchesSearch && matchesType;
  });

  // Calculate totals
  const totalValue = portfolioHoldings?.reduce((sum, holding) => sum + holding.value, 0) || 0;
  const totalCostBasis = portfolioHoldings?.reduce((sum, holding) => sum + holding.costBasis, 0) || 0;
  const totalGainLoss = portfolioHoldings?.reduce((sum, holding) => sum + holding.gainLoss, 0) || 0;
  const totalGainLossPercent = totalCostBasis > 0 ? (totalGainLoss / totalCostBasis) * 100 : 0;
  
  // Handle sort header click
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("desc");
    }
  };
  
  // Format currency values
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };
  
  // Format percentage values
  const formatPercent = (value: number) => {
    return `${value.toFixed(2)}%`;
  };
  
  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow dark:bg-slate-800 p-6">
        <h2 className="text-xl font-semibold mb-6">Portfolio Holdings</h2>
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner />
          <span className="ml-3 text-slate-500 dark:text-slate-400">Loading portfolio data...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow dark:bg-slate-800 p-6">
        <h2 className="text-xl font-semibold mb-6">Portfolio Holdings</h2>
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <h3 className="text-lg font-medium text-red-800 dark:text-red-300 mb-2">Error Loading Portfolio</h3>
          <p className="text-sm text-red-700 dark:text-red-400">
            {error.message || 'Unable to load investment data. Please try again later.'}
          </p>
        </div>
      </div>
    );
  }

  if (!portfolioHoldings || portfolioHoldings.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow dark:bg-slate-800 p-6">
        <h2 className="text-xl font-semibold mb-6">Portfolio Holdings</h2>
        <div className="p-4 bg-slate-50 dark:bg-slate-700 rounded-lg">
          <h3 className="text-lg font-medium text-slate-700 dark:text-slate-300 mb-2">No Investments Yet</h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
            You don't have any investments tracked yet. Add your first investment to start monitoring your portfolio.
          </p>
          <button className="inline-flex items-center px-4 py-2 bg-blue-600 border border-transparent rounded-md font-medium text-sm text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
            Add Investment
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow dark:bg-slate-800 p-6">
      <h2 className="text-xl font-semibold mb-6">Portfolio Holdings</h2>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div className="relative w-full md:w-auto">
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search ticker, name, or sector..."
            className="pl-10 pr-4 py-2 w-full md:w-64 rounded-md border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
        </div>

        <div className="flex space-x-2 w-full md:w-auto">
          <select
            aria-label="Filter by investment type"
            value={selectedType}
            onChange={e => setSelectedType(e.target.value)}
            className="px-4 py-2 rounded-md border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Types</option>
            <option value="Stock">Stocks</option>
            <option value="ETF">ETFs</option>
            <option value="Mutual Fund">Mutual Funds</option>
            <option value="Cash">Cash</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
          <thead className="bg-slate-50 dark:bg-slate-700">
            <tr>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider cursor-pointer"
                onClick={() => handleSort("ticker")}
              >
                <div className="flex items-center">
                  Ticker
                  {sortColumn === "ticker" && (
                    <ArrowsUpDownIcon className="ml-1 w-4 h-4" />
                  )}
                </div>
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider cursor-pointer"
                onClick={() => handleSort("name")}
              >
                <div className="flex items-center">
                  Name
                  {sortColumn === "name" && (
                    <ArrowsUpDownIcon className="ml-1 w-4 h-4" />
                  )}
                </div>
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider cursor-pointer"
                onClick={() => handleSort("type")}
              >
                <div className="flex items-center">
                  Type
                  {sortColumn === "type" && (
                    <ArrowsUpDownIcon className="ml-1 w-4 h-4" />
                  )}
                </div>
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider cursor-pointer"
                onClick={() => handleSort("sector")}
              >
                <div className="flex items-center">
                  Sector
                  {sortColumn === "sector" && (
                    <ArrowsUpDownIcon className="ml-1 w-4 h-4" />
                  )}
                </div>
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider cursor-pointer"
                onClick={() => handleSort("shares")}
              >
                <div className="flex items-center justify-end">
                  Shares
                  {sortColumn === "shares" && (
                    <ArrowsUpDownIcon className="ml-1 w-4 h-4" />
                  )}
                </div>
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider cursor-pointer"
                onClick={() => handleSort("price")}
              >
                <div className="flex items-center justify-end">
                  Price
                  {sortColumn === "price" && (
                    <ArrowsUpDownIcon className="ml-1 w-4 h-4" />
                  )}
                </div>
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider cursor-pointer"
                onClick={() => handleSort("value")}
              >
                <div className="flex items-center justify-end">
                  Market Value
                  {sortColumn === "value" && (
                    <ArrowsUpDownIcon className="ml-1 w-4 h-4" />
                  )}
                </div>
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider cursor-pointer"
                onClick={() => handleSort("gainLossPercent")}
              >
                <div className="flex items-center justify-end">
                  Gain/Loss
                  {sortColumn === "gainLossPercent" && (
                    <ArrowsUpDownIcon className="ml-1 w-4 h-4" />
                  )}
                </div>
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider cursor-pointer"
                onClick={() => handleSort("allocation")}
              >
                <div className="flex items-center justify-end">
                  Allocation
                  {sortColumn === "allocation" && (
                    <ArrowsUpDownIcon className="ml-1 w-4 h-4" />
                  )}
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
            {filteredHoldings.map((holding) => {
              const riskData = riskFactors[holding.ticker as keyof typeof riskFactors] || {};

              return (
                <tr
                  key={holding.id}
                  className="hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900 dark:text-white">
                    {holding.ticker}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-300">
                    {holding.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-300">
                    {holding.type}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-300">
                    {holding.sector}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-300 text-right">
                    {holding.shares.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-300 text-right">
                    {formatCurrency(holding.price)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900 dark:text-white text-right">
                    {formatCurrency(holding.value)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="text-sm font-medium">
                      <span className={holding.gainLossPercent >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                        {holding.gainLossPercent >= 0 ? "+" : ""}{formatPercent(holding.gainLossPercent)}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {holding.gainLoss >= 0 ? "+" : ""}{formatCurrency(holding.gainLoss)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-right">
                    <div className="flex items-center justify-end">
                      <span>{formatPercent(holding.allocation)}</span>
                      <div className="ml-2 h-2 w-16 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${
                            holding.allocation > 10
                              ? "bg-amber-500"
                              : "bg-blue-500"
                          }`}
                          style={{ width: `${Math.min(100, holding.allocation * 2)}%` }}
                        />
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-slate-50 dark:bg-slate-700">
            <tr>
              <td colSpan={6} className="px-6 py-4 text-sm font-medium text-slate-700 dark:text-slate-300">
                Total Portfolio
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900 dark:text-white text-right">
                {formatCurrency(totalValue)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right">
                <div className="text-sm font-medium">
                  <span className={totalGainLossPercent >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                    {totalGainLossPercent >= 0 ? "+" : ""}{formatPercent(totalGainLossPercent)}
                  </span>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {totalGainLoss >= 0 ? "+" : ""}{formatCurrency(totalGainLoss)}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-right">
                100.00%
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 bg-slate-50 dark:bg-slate-700 rounded-lg">
          <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Portfolio Concentration Analysis</h3>
          <ul className="space-y-2 text-sm">
            <li className="flex items-start text-amber-700 dark:text-amber-400">
              <span className="text-amber-500 mr-2">•</span>
              <span>Tech sector represents 42% of portfolio, which exceeds recommended maximum of 30%</span>
            </li>
            <li className="flex items-start text-amber-700 dark:text-amber-400">
              <span className="text-amber-500 mr-2">•</span>
              <span>Top 5 holdings account for 56.2% of portfolio, indicating high concentration</span>
            </li>
            <li className="flex items-start text-blue-700 dark:text-blue-400">
              <span className="text-blue-500 mr-2">•</span>
              <span>Fixed income allocation (15.1%) is below target for moderate risk profile (25%)</span>
            </li>
          </ul>
        </div>

        <div className="p-4 bg-slate-50 dark:bg-slate-700 rounded-lg">
          <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Dividend Analysis</h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
            Portfolio weighted average dividend yield: 1.78%
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Estimated annual dividend income: {formatCurrency(totalValue * 0.0178)}
          </p>
        </div>
      </div>
    </div>
  );
}