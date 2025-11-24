'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/cards/Card';
import { Button } from '@/components/ui/buttons/Button';
import { useInvestmentPortfolio, useInvestmentHoldings } from '@/hooks/useInvestments';

// Asset class colors
const assetColors = {
  stocks: 'bg-blue-500',
  bonds: 'bg-green-500',
  cash: 'bg-gray-500',
  other: 'bg-purple-500'
};

interface InvestmentAccount {
  id: string;
  name: string;
  institution: string;
  type: string;
  balance: number;
  roi: number;
  allocation: {
    stocks: number;
    bonds: number;
    cash: number;
    other: number;
  };
  contributions: {
    annual: number;
    lastContribution: string;
    frequency: string;
  };
  growth: Array<{ month: string; value: number }>;
}

export function InvestmentTracker() {
  const { portfolio, isLoading: portfolioLoading, error: portfolioError } = useInvestmentPortfolio();
  const { holdings, isLoading: holdingsLoading, error: holdingsError } = useInvestmentHoldings();

  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [growthProjection, setGrowthProjection] = useState<'conservative' | 'moderate' | 'aggressive'>('moderate');

  const isLoading = portfolioLoading || holdingsLoading;
  const hasError = portfolioError || holdingsError;

  // Transform holdings data into investment accounts format
  const accounts: InvestmentAccount[] = holdings.map(holding => ({
    id: holding.id,
    name: holding.name,
    institution: 'Unknown',
    type: holding.type || 'investment',
    balance: holding.totalValue,
    roi: holding.unrealizedGainPercent || 0,
    allocation: {
      stocks: holding.type === 'stock' || holding.type === 'etf' ? 100 : 0,
      bonds: holding.type === 'bond' ? 100 : 0,
      cash: 0,
      other: holding.type === 'crypto' || holding.type === 'cryptocurrency' ? 100 : 0
    },
    contributions: {
      annual: 0,
      lastContribution: '',
      frequency: 'N/A'
    },
    growth: []
  }));

  // Calculate total balance
  const totalBalance = portfolio?.totalValue || 0;

  // Calculate weighted ROI
  const weightedROI = totalBalance > 0 && accounts.length > 0
    ? accounts.reduce((sum, account) => sum + (account.roi * (account.balance / totalBalance)), 0)
    : 0;

  // Calculate overall asset allocation from portfolio data
  const overallAllocation = portfolio?.assetAllocation?.reduce((allocation, item) => {
    const percentage = item.percentage || 0;
    const name = item.name?.toLowerCase() || '';
    if (name.includes('stock') || name === 'etf') {
      return { ...allocation, stocks: allocation.stocks + percentage };
    }
    if (name.includes('bond')) {
      return { ...allocation, bonds: allocation.bonds + percentage };
    }
    if (name.includes('cash')) {
      return { ...allocation, cash: allocation.cash + percentage };
    }
    return { ...allocation, other: allocation.other + percentage };
  }, { stocks: 0, bonds: 0, cash: 0, other: 0 }) || { stocks: 0, bonds: 0, cash: 0, other: 0 };

  // Calculate projections based on current portfolio value
  const calculateProjections = () => {
    const rates = {
      conservative: 0.05,
      moderate: 0.07,
      aggressive: 0.09
    };
    const rate = rates[growthProjection];
    const years = [1, 5, 10, 20, 30];
    const annualContribution = accounts.reduce((sum, acct) => sum + acct.contributions.annual, 0);

    return years.map(year => {
      // Future value with compound interest and contributions
      const fv = totalBalance * Math.pow(1 + rate, year) +
                 annualContribution * ((Math.pow(1 + rate, year) - 1) / rate);
      return Math.round(fv);
    });
  };

  const projections = calculateProjections();
  const projectionYears = [1, 5, 10, 20, 30];

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-semibold">Investment Portfolio Tracker</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Card key={i} className="p-4">
              <div className="animate-pulse">
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/2 mb-2"></div>
                <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-3/4"></div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (hasError) {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-semibold">Investment Portfolio Tracker</h2>
        <Card className="p-6 text-center">
          <p className="text-red-500 mb-4">Unable to load investment data</p>
          <Button onClick={() => window.location.reload()}>Try Again</Button>
        </Card>
      </div>
    );
  }

  // Empty state - no investments
  if (accounts.length === 0) {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-semibold">Investment Portfolio Tracker</h2>
        <Card className="p-8 text-center">
          <div className="max-w-md mx-auto">
            <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <h3 className="text-lg font-medium mb-2">No Investment Accounts</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              Connect your investment accounts or manually add your investments to track your portfolio performance.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button>Connect Account</Button>
              <Button variant="outline">Add Investment Manually</Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Investment Portfolio Tracker</h2>

      {/* Portfolio Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="p-4">
          <h3 className="text-sm font-medium text-gray-500 mb-1">Total Portfolio Value</h3>
          <p className="text-2xl font-semibold">${totalBalance.toLocaleString()}</p>
          <p className="text-sm text-gray-500 mt-1">Across {accounts.length} {accounts.length === 1 ? 'account' : 'accounts'}</p>
        </Card>
        <Card className="p-4">
          <h3 className="text-sm font-medium text-gray-500 mb-1">Average Return (YTD)</h3>
          <p className="text-2xl font-semibold">{weightedROI.toFixed(1)}%</p>
          <p className="text-sm text-gray-500 mt-1">Weighted average</p>
        </Card>
        <Card className="p-4">
          <h3 className="text-sm font-medium text-gray-500 mb-1">Annual Contributions</h3>
          <p className="text-2xl font-semibold">
            ${accounts.reduce((sum, acct) => sum + acct.contributions.annual, 0).toLocaleString()}
          </p>
          <p className="text-sm text-gray-500 mt-1">Across all accounts</p>
        </Card>
      </div>

      {/* Overall Asset Allocation */}
      <Card className="p-6">
        <h3 className="text-lg font-medium mb-4">Asset Allocation</h3>
        <div className="flex items-center mb-4">
          <div className="relative w-32 h-32 mr-6">
            {/* Pie chart visualization (simplified with color bars for this example) */}
            <div className="h-6 flex rounded-md overflow-hidden mb-2">
              <div className={`${assetColors.stocks}`} style={{ width: `${overallAllocation.stocks}%` }}></div>
              <div className={`${assetColors.bonds}`} style={{ width: `${overallAllocation.bonds}%` }}></div>
              <div className={`${assetColors.cash}`} style={{ width: `${overallAllocation.cash}%` }}></div>
              <div className={`${assetColors.other}`} style={{ width: `${overallAllocation.other}%` }}></div>
            </div>
          </div>
          <div className="flex flex-col space-y-2">
            <div className="flex items-center">
              <div className={`w-3 h-3 rounded-full ${assetColors.stocks} mr-2`}></div>
              <span className="text-sm">Stocks: {Math.round(overallAllocation.stocks)}%</span>
            </div>
            <div className="flex items-center">
              <div className={`w-3 h-3 rounded-full ${assetColors.bonds} mr-2`}></div>
              <span className="text-sm">Bonds: {Math.round(overallAllocation.bonds)}%</span>
            </div>
            <div className="flex items-center">
              <div className={`w-3 h-3 rounded-full ${assetColors.cash} mr-2`}></div>
              <span className="text-sm">Cash: {Math.round(overallAllocation.cash)}%</span>
            </div>
            <div className="flex items-center">
              <div className={`w-3 h-3 rounded-full ${assetColors.other} mr-2`}></div>
              <span className="text-sm">Other: {Math.round(overallAllocation.other)}%</span>
            </div>
          </div>
        </div>
        <Button variant="outline" size="sm">Adjust Allocation</Button>
      </Card>

      {/* Accounts List */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium">Investment Accounts</h3>
          <Button variant="outline" size="sm">Connect Account</Button>
        </div>

        <div className="space-y-3">
          {accounts.map(account => (
            <Card
              key={account.id}
              className={`p-4 cursor-pointer transition-all duration-200 hover:shadow-md ${
                selectedAccount === account.id ? 'ring-2 ring-blue-500' : ''
              }`}
              onClick={() => setSelectedAccount(selectedAccount === account.id ? null : account.id)}
            >
              <div className="flex flex-col md:flex-row md:justify-between md:items-center">
                <div>
                  <div className="flex items-center">
                    <h3 className="font-medium">{account.name}</h3>
                    {account.institution !== 'Unknown' && (
                      <span className="text-xs ml-2 text-gray-500">({account.institution})</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 capitalize">{account.type}</p>
                </div>

                <div className="mt-2 md:mt-0 md:text-right">
                  <p className="font-medium">${account.balance.toLocaleString()}</p>
                  <p className={`text-sm ${account.roi >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {account.roi >= 0 ? '+' : ''}{account.roi.toFixed(1)}% YTD
                  </p>
                </div>
              </div>

              {selectedAccount === account.id && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="space-y-3">
                    {account.growth.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium mb-2">Account Growth</h4>
                        <div className="flex w-full justify-between">
                          {account.growth.map((month, index) => (
                            <div key={index} className="text-center">
                              <div className="h-24 flex items-end justify-center">
                                <div
                                  className="w-8 bg-blue-500 rounded-t"
                                  style={{
                                    height: `${(month.value / Math.max(...account.growth.map(m => m.value))) * 100}%`
                                  }}
                                ></div>
                              </div>
                              <p className="text-xs mt-1">{month.month}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500">Asset Type</p>
                        <p className="font-medium capitalize">{account.type}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Current Value</p>
                        <p className="font-medium">${account.balance.toLocaleString()}</p>
                      </div>
                    </div>

                    <div className="flex gap-2 mt-4">
                      <Button size="sm">Update Balance</Button>
                      <Button variant="outline" size="sm">View Details</Button>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      </div>

      {/* Retirement Projections */}
      {totalBalance > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-medium mb-4">Retirement Projections</h3>

          <div className="flex justify-end space-x-2 mb-4">
            <div className="flex rounded-md overflow-hidden border border-gray-300">
              <Button
                onClick={() => setGrowthProjection('conservative')}
                variant={growthProjection === 'conservative' ? 'default' : 'ghost'}
                size="sm"
                className="rounded-none"
              >
                Conservative
              </Button>
              <Button
                onClick={() => setGrowthProjection('moderate')}
                variant={growthProjection === 'moderate' ? 'default' : 'ghost'}
                size="sm"
                className="rounded-none"
              >
                Moderate
              </Button>
              <Button
                onClick={() => setGrowthProjection('aggressive')}
                variant={growthProjection === 'aggressive' ? 'default' : 'ghost'}
                size="sm"
                className="rounded-none"
              >
                Aggressive
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Years</th>
                  {projectionYears.map(year => (
                    <th key={year} className="px-4 py-2 text-right text-sm font-medium text-gray-500">
                      {year} {year === 1 ? 'Year' : 'Years'}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="px-4 py-3 text-sm font-medium">Projected Value</td>
                  {projections.map((value, index) => (
                    <td key={index} className="px-4 py-3 text-sm text-right">
                      ${value.toLocaleString()}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>

            <p className="text-sm text-gray-500">
              {growthProjection === 'conservative' ? 'Conservative projection assumes 5% average annual return.' :
               growthProjection === 'moderate' ? 'Moderate projection assumes 7% average annual return.' :
               'Aggressive projection assumes 9% average annual return.'}
            </p>

            <p className="text-sm text-gray-500">
              Projections are based on your current portfolio value of ${totalBalance.toLocaleString()}.
            </p>
          </div>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2 mt-6">
        <Button>
          Rebalance Portfolio
        </Button>
        <Button variant="outline">
          Schedule Contribution
        </Button>
        <Button variant="outline">
          Investment Recommendations
        </Button>
      </div>
    </div>
  );
}
