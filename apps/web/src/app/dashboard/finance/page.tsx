// Financial Dashboard Component
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import FinancialResolverPanel from '@/components/finance/FinancialResolverPanel';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
} from 'recharts';
import {
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  Briefcase,
  CreditCard,
  Bitcoin,
  AlertTriangle,
  TrendingUp,
  Upload,
  Link2,
  PenLine,
} from 'lucide-react';
// Import lodash with type definitions
import { get, sum, groupBy } from 'lodash';
import type { get as GetType, sum as SumType, groupBy as GroupByType } from 'lodash';
import AddDataModal from '@/components/dashboard/AddDataModal';
import { normalizeFinancePayload, type FinanceCore } from '@/lib/finance/domainViewModel';
// Remove @types/lodash import since types are included in lodash-es

// Main dashboard component
const FinancialDashboard = () => {
  // State for financial data with proper typing
  const [accounts, setAccounts] = useState<
    {
      id: string;
      name: string;
      type: 'banking' | 'investment' | 'credit';
      balance: number;
      institution: string;
    }[]
  >([]);
  const [transactions, setTransactions] = useState<{
    dailySpending: Array<{
      date: string;
      amount: number;
      category: string;
    }>;
    categorySpending: Array<{
      category: string;
      amount: number;
    }>;
    recentTransactions: Array<{
      id: string;
      date: string;
      description: string;
      amount: number;
      category: string;
    }>;
  }>({
    dailySpending: [],
    categorySpending: [],
    recentTransactions: [],
  });
  const [investments, setInvestments] = useState<{
    portfolioPerformance: Array<{
      date: string;
      value: number;
    }>;
    assetAllocation: Array<{
      name: string;
      value: number;
    }>;
    holdings: Array<{
      symbol: string;
      name: string;
      shares: number;
      price: number;
      value: number;
    }>;
    totalValue: number;
    dayChange: number;
    dayChangePercent: number;
  }>({
    portfolioPerformance: [],
    assetAllocation: [],
    holdings: [],
    totalValue: 0,
    dayChange: 0,
    dayChangePercent: 0,
  });
  const [cryptoAssets, setCryptoAssets] = useState<
    {
      symbol: string;
      name: string;
      quantity: number;
      price: number;
      value: number;
      change24h: number;
    }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState('month'); // week, month, year
  const [selectedAccount, setSelectedAccount] = useState('all');
  const [showAddDataModal, setShowAddDataModal] = useState(false);
  // Core API DomainViewModel metadata (authoritative money tiles, recommendations,
  // missing-data flags). Null until the first successful fetch. Source-agnostic:
  // populated from either the Core API shape or the legacy payload via the mapper.
  const [core, setCore] = useState<FinanceCore | null>(null);
  // P0: the authoritative net worth comes from the ONE canonical finance summary so this page can
  // never disagree with the dashboard / overview / resolver. (Falls back to legacy sums if absent.)
  const [canonicalNetWorth, setCanonicalNetWorth] = useState<number | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [canonicalSummary, setCanonicalSummary] = useState<any | null>(null);
  useEffect(() => {
    fetch('/api/finance/canonical-summary')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && typeof d.net_worth === 'number') {
          setCanonicalNetWorth(d.net_worth);
          setCanonicalSummary(d);
        }
      })
      .catch(() => {});
  }, []);

  // Colors for charts
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

  // Fetch data on component mount with comprehensive error handling
  const fetchFinancialData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Add timeout to fetch request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch(`/api/financial?timeframe=${timeframe}`, {
        signal: controller.signal,
      }).catch((fetchError) => {
        clearTimeout(timeoutId);
        // Handle network errors specifically
        if (fetchError.name === 'AbortError') {
          throw new Error('Request timed out. Please check your connection and try again.');
        }
        throw new Error('Network error. Please check your internet connection.');
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        // 401/403/500 - show empty state instead of error for better UX
        // Users without data or not authenticated should see empty dashboard
        if (response.status === 401 || response.status === 403 || response.status === 500) {
          setAccounts([]);
          setTransactions({ dailySpending: [], categorySpending: [], recentTransactions: [] });
          setInvestments({
            portfolioPerformance: [],
            assetAllocation: [],
            holdings: [],
            totalValue: 0,
            dayChange: 0,
            dayChangePercent: 0,
          });
          setCryptoAssets([]);
          setCore(null);
          setError(null);
          setLoading(false);
          return;
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      const data = await response.json();

      // Normalize EITHER the Core API DomainViewModel (proxy on) or the legacy
      // payload (proxy off) into the shape the dashboard renders. All shape /
      // Plaid coupling lives in the mapper — never in this component.
      const norm = normalizeFinancePayload(data);
      setAccounts(norm.accounts);
      setTransactions(norm.transactions);
      setInvestments(norm.investments);
      setCryptoAssets(norm.cryptoAssets);
      setCore(norm.core);

      setError(null);
      setLoading(false);
    } catch (err) {
      // Log error for debugging
      console.error('[Finance] Error fetching data:', err);

      // Set safe defaults and show empty state instead of error
      // This provides better UX - users can still interact with "Connect Account" buttons
      setAccounts([]);
      setTransactions({ dailySpending: [], categorySpending: [], recentTransactions: [] });
      setInvestments({
        portfolioPerformance: [],
        assetAllocation: [],
        holdings: [],
        totalValue: 0,
        dayChange: 0,
        dayChangePercent: 0,
      });
      setCryptoAssets([]);
      setCore(null);
      setError(null); // Don't show error, show empty state instead
      setLoading(false);
    }
  }, [timeframe]);

  useEffect(() => {
    fetchFinancialData();
  }, [fetchFinancialData]);

  // Calculate total assets and liabilities with elite error handling
  const calculateTotals = () => {
    try {
      const bankingTotal = Array.isArray(accounts)
        ? accounts
            .filter((account) => account?.type === 'banking')
            .reduce((sum, account) => sum + (Number(account?.balance) || 0), 0)
        : 0;

      const investmentTotal = Array.isArray(accounts)
        ? accounts
            .filter((account) => account?.type === 'investment')
            .reduce((sum, account) => sum + (Number(account?.balance) || 0), 0)
        : 0;

      const creditTotal = Array.isArray(accounts)
        ? accounts
            .filter((account) => account?.type === 'credit')
            .reduce((sum, account) => sum + (Number(account?.balance) || 0), 0)
        : 0;

      const cryptoTotal = Array.isArray(cryptoAssets)
        ? cryptoAssets.reduce((sum, asset) => sum + (Number(asset?.value) || 0), 0)
        : 0;

      const netWorth = bankingTotal + investmentTotal + cryptoTotal + creditTotal;

      return {
        bankingTotal,
        investmentTotal,
        creditTotal,
        cryptoTotal,
        netWorth,
      };
    } catch (err) {
      console.error('Error calculating totals:', err);
      return {
        bankingTotal: 0,
        investmentTotal: 0,
        creditTotal: 0,
        cryptoTotal: 0,
        netWorth: 0,
      };
    }
  };

  // Format currency
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  // Group transactions by category
  const transactionsByCategory = transactions.categorySpending.map((item) => ({
    name: item.category,
    value: item.amount,
  }));

  // Format date for charts
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Safely calculate totals with error handling
  const totals = calculateTotals();

  // Money-tile display: prefer the backend's authoritative figures (Core API),
  // fall back to the client-side sum (legacy payload). NEVER render a fake $0 when
  // data is absent — show an em dash + a premium "connect" prompt instead.
  const hasFinanceData =
    (core?.hasData ?? false) || (Array.isArray(accounts) && accounts.length > 0);
  // P0 single source of truth: net worth comes ONLY from the canonical finance
  // summary, so this page can never disagree with the dashboard / overview /
  // resolver. If the canonical summary is unavailable we show a MISSING state
  // ("—") — never a divergent client-side or legacy backend sum.
  const displayNetWorth = canonicalNetWorth;
  const moneyTile = (value: number | null | undefined): string =>
    hasFinanceData && value != null ? formatCurrency(value) : '—';

  const hasData =
    (Array.isArray(accounts) && accounts.length > 0) ||
    (transactions?.dailySpending &&
      Array.isArray(transactions.dailySpending) &&
      transactions.dailySpending.length > 0);

  // Show loading state
  if (loading) {
    return (
      <div className="p-6 bg-gray-50 dark:bg-gray-900 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading your financial data...</p>
        </div>
      </div>
    );
  }

  // Show error state with retry option
  if (error) {
    return (
      <div className="p-6 bg-gray-50 dark:bg-gray-900 min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-red-600 dark:text-red-400 text-5xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Unable to Load Financial Data
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Financial Dashboard</h1>
        <p className="text-gray-600 dark:text-gray-400">Your complete financial picture</p>
      </header>
      <div className="mb-6">
        <FinancialResolverPanel
          title="What we know (from your data)"
          keys={['cash_balance', 'investment_balance', 'retirement_balance', 'debt_total']}
        />
      </div>

      {/* Time period selector */}
      <div className="mb-6 flex space-x-4">
        <button
          className={`px-4 py-2 rounded-md ${timeframe === 'week' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300'}`}
          onClick={() => setTimeframe('week')}
        >
          This Week
        </button>
        <button
          className={`px-4 py-2 rounded-md ${timeframe === 'month' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300'}`}
          onClick={() => setTimeframe('month')}
        >
          This Month
        </button>
        <button
          className={`px-4 py-2 rounded-md ${timeframe === 'year' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300'}`}
          onClick={() => setTimeframe('year')}
        >
          This Year
        </button>
      </div>

      {/* Financial summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-700">Net Worth</h2>
            <DollarSign className="text-blue-600" size={24} />
          </div>
          <div className="text-2xl font-bold text-gray-900">{moneyTile(displayNetWorth)}</div>
          <div className="text-sm text-gray-500 mt-2">
            {hasFinanceData
              ? 'Total assets minus liabilities'
              : 'Connect your accounts to see your net worth'}
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-700">Bank Accounts</h2>
            <CreditCard className="text-green-600" size={24} />
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {moneyTile(canonicalSummary?.cash_balance ?? core?.cash)}
          </div>
          <div className="text-sm text-gray-500 mt-2">Total balance across all accounts</div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-700">Investments</h2>
            <Briefcase className="text-purple-600" size={24} />
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {moneyTile(canonicalSummary?.investment_balance)}
          </div>
          {investments.dayChangePercent !== 0 ? (
            <div className="flex items-center text-sm text-green-600 mt-2">
              <ArrowUpRight size={16} className="mr-1" />
              <span>{investments.dayChangePercent.toFixed(2)}% today</span>
            </div>
          ) : (
            <div className="text-sm text-gray-500 mt-2">Investment &amp; retirement balances</div>
          )}
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-700">Crypto</h2>
            <Bitcoin className="text-yellow-600" size={24} />
          </div>
          <div className="text-2xl font-bold text-gray-900">{moneyTile(totals.cryptoTotal)}</div>
          <div className="text-sm text-gray-500 mt-2">{cryptoAssets.length} assets</div>
        </div>
      </div>

      {/* Recommended next moves — Core API H-contract recommendations */}
      {core && core.recommendations.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow-md mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Recommended next moves</h2>
          <div className="space-y-4">
            {core.recommendations.map((rec) => (
              <div key={rec.id} className="border-l-4 border-blue-600 pl-4 py-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">{rec.title}</h3>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      rec.priority === 'high'
                        ? 'bg-red-100 text-red-700'
                        : rec.priority === 'medium'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {rec.priority}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mt-1">{rec.why_it_matters}</p>
                {rec.action_steps.length > 0 && (
                  <ul className="list-disc list-inside text-sm text-gray-700 mt-2">
                    {rec.action_steps.map((s, i) => (
                      <li key={i}>{s.step}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Connected accounts */}
        <div className="bg-white p-6 rounded-lg shadow-md lg:col-span-1">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Connected Accounts</h2>
          {accounts.length > 0 ? (
            <>
              <div className="space-y-4">
                {accounts.map((account) => (
                  <div
                    key={account.id}
                    className="flex justify-between items-center p-3 bg-gray-50 rounded-md"
                  >
                    <div>
                      <div className="font-medium">{account.name}</div>
                      <div className="text-sm text-gray-500">{account.institution}</div>
                    </div>
                    <div
                      className={`font-semibold ${account.balance < 0 ? 'text-red-600' : 'text-gray-900'}`}
                    >
                      {formatCurrency(account.balance)}
                    </div>
                  </div>
                ))}
              </div>
              <button className="mt-4 w-full py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
                Manage Accounts
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="text-5xl mb-4">🏦</div>
              <p className="text-gray-600 dark:text-gray-400 mb-2 font-medium">
                No Accounts Connected
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500 mb-4">
                Add your financial data to start tracking
              </p>
              <button
                onClick={() => setShowAddDataModal(true)}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Add Financial Data
              </button>
            </div>
          )}
        </div>

        {/* Monthly spending */}
        <div className="bg-white p-6 rounded-lg shadow-md lg:col-span-2">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Spending Trends</h2>
          {transactions.dailySpending.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart
                data={transactions.dailySpending}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDate}
                  interval={timeframe === 'week' ? 0 : timeframe === 'month' ? 5 : 30}
                />
                <YAxis tickFormatter={(value) => `$${value}`} />
                <Tooltip
                  formatter={(value) => [`$${value}`, 'Spent']}
                  labelFormatter={(value) => `Date: ${formatDate(value)}`}
                />
                <Line type="monotone" dataKey="amount" stroke="#3b82f6" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-[300px] text-center">
              <div className="text-5xl mb-4">📊</div>
              <p className="text-gray-600 dark:text-gray-400 mb-2 font-medium">No Spending Data</p>
              <p className="text-sm text-gray-500 dark:text-gray-500 mb-4">
                Your spending trends will appear here once you connect accounts
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Spending by category */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Spending by Category</h2>
          {transactionsByCategory.length > 0 ? (
            <div className="flex items-center justify-center h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={transactionsByCategory}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {transactionsByCategory.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`$${value}`, 'Spent']} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <div className="text-5xl mb-4">📈</div>
              <p className="text-gray-600 dark:text-gray-400 mb-2 font-medium">No Category Data</p>
              <p className="text-sm text-gray-500 dark:text-gray-500">
                Spending breakdown by category will appear here
              </p>
            </div>
          )}
        </div>

        {/* Investment performance */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Investment Performance</h2>
          {investments.portfolioPerformance.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart
                data={investments.portfolioPerformance}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={formatDate} interval={5} />
                <YAxis tickFormatter={(value) => `$${value.toLocaleString()}`} />
                <Tooltip
                  formatter={(value) => [`$${value.toLocaleString()}`, 'Portfolio Value']}
                  labelFormatter={(value) => `Date: ${formatDate(value)}`}
                />
                <Line type="monotone" dataKey="value" stroke="#8884d8" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-[300px] text-center">
              <div className="text-5xl mb-4">💼</div>
              <p className="text-gray-600 dark:text-gray-400 mb-2 font-medium">
                No Investment Data
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500 mb-4">
                Add your investment data to track portfolio performance
              </p>
              <button
                onClick={() => setShowAddDataModal(true)}
                className="px-6 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
              >
                Add Investment Data
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Recent transactions */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-8">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Recent Transactions</h2>
        {transactions.recentTransactions.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {transactions.recentTransactions.map((transaction) => (
                    <tr key={transaction.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(transaction.date)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {transaction.description}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {transaction.category}
                      </td>
                      <td
                        className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${
                          transaction.amount < 0 ? 'text-red-600' : 'text-green-600'
                        }`}
                      >
                        {formatCurrency(transaction.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 text-center">
              <button className="text-blue-600 hover:text-blue-800 font-medium">
                View All Transactions
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="text-5xl mb-4">💳</div>
            <p className="text-gray-600 dark:text-gray-400 mb-2 font-medium">No Transactions Yet</p>
            <p className="text-sm text-gray-500 dark:text-gray-500">
              Your recent transactions will appear here after connecting accounts
            </p>
          </div>
        )}
      </div>

      {/* Financial insights */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-8">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Financial Insights</h2>
        {hasData ? (
          <p className="text-gray-600 text-center py-8">
            Insights will be generated based on your financial data.
          </p>
        ) : (
          <div className="text-center py-8">
            <div className="text-5xl mb-4">💡</div>
            <p className="text-gray-600 dark:text-gray-400 mb-2 font-medium">
              No Insights Available
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mb-4">
              Connect your accounts to receive personalized financial insights
            </p>
            <button
              onClick={() => setShowAddDataModal(true)}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Get Started
            </button>
          </div>
        )}
      </div>

      {/* Add Data Modal */}
      <AddDataModal
        isOpen={showAddDataModal}
        onClose={() => setShowAddDataModal(false)}
        domain="financial"
      />
    </div>
  );
};

export default FinancialDashboard;
