'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/cards/Card';
import { Button } from '@/components/ui/buttons/Button';

// Mock investment accounts data
const mockAccounts = [
  {
    id: 'acct1',
    name: '401(k)',
    institution: 'Fidelity',
    type: 'retirement',
    balance: 120000,
    roi: 8.2,
    allocation: {
      stocks: 70,
      bonds: 25,
      cash: 5,
      other: 0
    },
    contributions: {
      annual: 19500,
      lastContribution: '2025-04-15',
      frequency: 'bi-weekly'
    },
    growth: [
      { month: 'Jan', value: 100000 },
      { month: 'Feb', value: 102000 },
      { month: 'Mar', value: 105000 },
      { month: 'Apr', value: 110000 },
      { month: 'May', value: 115000 },
      { month: 'Jun', value: 120000 }
    ]
  },
  {
    id: 'acct2',
    name: 'Roth IRA',
    institution: 'Vanguard',
    type: 'retirement',
    balance: 45000,
    roi: 9.1,
    allocation: {
      stocks: 80,
      bonds: 15,
      cash: 5,
      other: 0
    },
    contributions: {
      annual: 6500,
      lastContribution: '2025-03-30',
      frequency: 'monthly'
    },
    growth: [
      { month: 'Jan', value: 38000 },
      { month: 'Feb', value: 39500 },
      { month: 'Mar', value: 41000 },
      { month: 'Apr', value: 42500 },
      { month: 'May', value: 44000 },
      { month: 'Jun', value: 45000 }
    ]
  },
  {
    id: 'acct3',
    name: 'Brokerage Account',
    institution: 'Charles Schwab',
    type: 'taxable',
    balance: 65000,
    roi: 7.5,
    allocation: {
      stocks: 60,
      bonds: 10,
      cash: 10,
      other: 20
    },
    contributions: {
      annual: 12000,
      lastContribution: '2025-05-01',
      frequency: 'monthly'
    },
    growth: [
      { month: 'Jan', value: 55000 },
      { month: 'Feb', value: 57000 },
      { month: 'Mar', value: 59000 },
      { month: 'Apr', value: 62000 },
      { month: 'May', value: 64000 },
      { month: 'Jun', value: 65000 }
    ]
  },
  {
    id: 'acct4',
    name: 'HSA',
    institution: 'HealthEquity',
    type: 'health',
    balance: 12000,
    roi: 5.8,
    allocation: {
      stocks: 50,
      bonds: 40,
      cash: 10,
      other: 0
    },
    contributions: {
      annual: 3850,
      lastContribution: '2025-04-15',
      frequency: 'bi-weekly'
    },
    growth: [
      { month: 'Jan', value: 9800 },
      { month: 'Feb', value: 10200 },
      { month: 'Mar', value: 10600 },
      { month: 'Apr', value: 11000 },
      { month: 'May', value: 11500 },
      { month: 'Jun', value: 12000 }
    ]
  }
];

// Mock investment projections
const mockProjections = {
  years: [1, 5, 10, 20, 30],
  conservative: [247000, 290000, 380000, 650000, 1100000],
  moderate: [255000, 320000, 450000, 900000, 1800000],
  aggressive: [260000, 350000, 550000, 1200000, 2500000]
};

// Asset class colors
const assetColors = {
  stocks: 'bg-blue-500',
  bonds: 'bg-green-500',
  cash: 'bg-gray-500',
  other: 'bg-purple-500'
};

export function InvestmentTracker() {
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState<'YTD' | '1Y' | '3Y' | '5Y'>('YTD');
  const [growthProjection, setGrowthProjection] = useState<'conservative' | 'moderate' | 'aggressive'>('moderate');
  
  // Calculate total balance
  const totalBalance = mockAccounts.reduce((sum, account) => sum + account.balance, 0);
  
  // Calculate weighted ROI
  const weightedROI = mockAccounts.reduce((sum, account) => sum + (account.roi * (account.balance / totalBalance)), 0);
  
  // Calculate overall asset allocation
  const overallAllocation = mockAccounts.reduce((allocation, account) => {
    const weight = account.balance / totalBalance;
    return {
      stocks: allocation.stocks + (account.allocation.stocks * weight),
      bonds: allocation.bonds + (account.allocation.bonds * weight),
      cash: allocation.cash + (account.allocation.cash * weight),
      other: allocation.other + (account.allocation.other * weight)
    };
  }, { stocks: 0, bonds: 0, cash: 0, other: 0 });
  
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Investment Portfolio Tracker</h2>
      
      {/* Portfolio Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="p-4">
          <h3 className="text-sm font-medium text-gray-500 mb-1">Total Portfolio Value</h3>
          <p className="text-2xl font-semibold">${totalBalance.toLocaleString()}</p>
          <p className="text-sm text-gray-500 mt-1">Across {mockAccounts.length} accounts</p>
        </Card>
        <Card className="p-4">
          <h3 className="text-sm font-medium text-gray-500 mb-1">Average Return (YTD)</h3>
          <p className="text-2xl font-semibold">{weightedROI.toFixed(1)}%</p>
          <p className="text-sm text-gray-500 mt-1">Weighted average</p>
        </Card>
        <Card className="p-4">
          <h3 className="text-sm font-medium text-gray-500 mb-1">Annual Contributions</h3>
          <p className="text-2xl font-semibold">
            ${mockAccounts.reduce((sum, acct) => sum + acct.contributions.annual, 0).toLocaleString()}
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
          {mockAccounts.map(account => (
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
                    <span className="text-xs ml-2 text-gray-500">({account.institution})</span>
                  </div>
                  <p className="text-sm text-gray-500">
                    {account.type === 'retirement' ? 'Retirement Account' :
                     account.type === 'taxable' ? 'Taxable Account' :
                     account.type === 'health' ? 'Health Savings Account' : 'Other Account'}
                  </p>
                </div>
                
                <div className="mt-2 md:mt-0 md:text-right">
                  <p className="font-medium">${account.balance.toLocaleString()}</p>
                  <p className="text-sm text-green-600">+{account.roi}% YTD</p>
                </div>
              </div>
              
              {selectedAccount === account.id && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="space-y-3">
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
                    
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500">Annual Contribution</p>
                        <p className="font-medium">${account.contributions.annual.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Contribution Frequency</p>
                        <p className="font-medium capitalize">{account.contributions.frequency}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Last Contribution</p>
                        <p className="font-medium">{new Date(account.contributions.lastContribution).toLocaleDateString()}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Asset Allocation</p>
                        <p className="font-medium">
                          {account.allocation.stocks}% Stocks, {account.allocation.bonds}% Bonds
                        </p>
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
                {mockProjections.years.map(year => (
                  <th key={year} className="px-4 py-2 text-right text-sm font-medium text-gray-500">
                    {year} {year === 1 ? 'Year' : 'Years'}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="px-4 py-3 text-sm font-medium">Projected Value</td>
                {mockProjections[growthProjection].map((value, index) => (
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
            Projections include your current portfolio value of ${totalBalance.toLocaleString()} and
            annual contributions of ${mockAccounts.reduce((sum, acct) => sum + acct.contributions.annual, 0).toLocaleString()}.
          </p>
        </div>
      </Card>
      
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