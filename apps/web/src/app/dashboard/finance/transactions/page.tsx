'use client';

import React, { useState, useEffect } from 'react';
import FinancialResolverPanel from '@/components/finance/FinancialResolverPanel';
import TransactionFilters from '@/components/financial/transactions/TransactionFilters';
import TransactionList from '@/components/financial/transactions/TransactionList';
import { EnhancedTransaction } from '@/types/financial';
// Removed mock data import - will fetch from database

export default function TransactionsPage() {
  // Default to ALL available transactions — for pilot/demo a user must see their data immediately,
  // not have to widen a 30-day filter. The date filters below still let them narrow the range.
  const [startDate, setStartDate] = useState(() => new Date('2000-01-01'));

  const [endDate, setEndDate] = useState(new Date());
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<EnhancedTransaction[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Accounts come from the canonical account list (/api/plaid/accounts → finance.financial_accounts);
  // the transaction ROWS come from the same canonical source the Financial Overview reads
  // (/api/finance/analytics → finance.transactions). The /api/financial proxy's DomainViewModel
  // summary carries no transaction rows, so reading it directly rendered this page empty under the
  // proxy; analytics fixes that with real data (Gap 3). Both read finance.* under RLS.
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [acctRes, analyticsRes] = await Promise.all([
          fetch('/api/plaid/accounts', { cache: 'no-store' }),
          fetch('/api/finance/analytics', { cache: 'no-store' }),
        ]);
        if (!analyticsRes.ok) {
          setAccounts([]);
          setTransactions([]);
          return;
        }
        const acctData = acctRes.ok ? await acctRes.json() : {};
        const analytics = await analyticsRes.json();
        const apiAccounts = Array.isArray(acctData?.accounts) ? acctData.accounts : [];
        const recent = Array.isArray(analytics?.recent_transactions)
          ? analytics.recent_transactions
          : [];

        // Adapt the aggregator shape to TransactionList's EnhancedTransaction.
        const nowIso = new Date().toISOString();
        const adapted: EnhancedTransaction[] = recent.map((t: Record<string, unknown>) => {
          const direction = String(t.type ?? '').toLowerCase();
          const isIncome = direction === 'income' || direction === 'credit';
          return {
            id: String(t.id ?? ''),
            accountId: String(t.account_id ?? ''),
            amount: Math.abs(Number(t.amount ?? 0)),
            currency: String(t.currency ?? 'USD'),
            date: String(t.date ?? ''),
            description: String(t.description ?? ''),
            merchant: String(t.merchant ?? ''),
            category: String(t.category ?? ''),
            isIncome,
            isPending: false,
            createdAt: nowIso,
            updatedAt: nowIso,
          } as unknown as EnhancedTransaction;
        });
        setAccounts(apiAccounts);
        setTransactions(adapted);
      } catch (error) {
        console.error('[Transactions] Error fetching data:', error);
        setAccounts([]);
        setTransactions([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Filter transactions when criteria change
  useEffect(() => {
    let filtered = [...transactions];

    // Filter by date range
    filtered = filtered.filter((txn) => {
      const txnDate = new Date(txn.date);
      return txnDate >= startDate && txnDate <= endDate;
    });

    // Filter by selected accounts
    if (selectedAccountIds.length > 0) {
      filtered = filtered.filter((txn) => selectedAccountIds.includes(txn.accountId));
    }

    // Sort transactions by date (newest first)
    filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    setFilteredTransactions(filtered);
  }, [startDate, endDate, selectedAccountIds, transactions]);

  // Handle date range change
  const handleDateRangeChange = (start: Date, end: Date) => {
    setStartDate(start);
    setEndDate(end);
  };

  // Income / expenses / net are computed by the BACKEND (Rule 1: no frontend money summation).
  // The client only supplies the active filter (date range + selected accounts); the server sums.
  const [summary, setSummary] = useState<{ income: number; expenses: number; net: number } | null>(
    null
  );
  useEffect(() => {
    const params = new URLSearchParams({
      start: startDate.toISOString(),
      end: endDate.toISOString(),
    });
    if (selectedAccountIds.length) params.set('accounts', selectedAccountIds.join(','));
    fetch(`/api/finance/transaction-summary?${params.toString()}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && typeof d.net === 'number') setSummary(d);
      })
      .catch(() => {});
  }, [startDate, endDate, selectedAccountIds]);
  const totalIncome = summary?.income ?? 0;
  const totalExpenses = summary?.expenses ?? 0;
  const netAmount = summary?.net ?? 0;

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <div className="container mx-auto py-6 px-4 md:px-6">
      <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white mb-6">
        Transactions
      </h1>
      <div className="mb-6">
        <FinancialResolverPanel title="Canonical balances" keys={['cash_balance']} />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <h3 className="text-sm text-gray-500 dark:text-gray-400 mb-1">Income</h3>
          <p className="text-xl font-semibold text-emerald-600 dark:text-emerald-400">
            {formatCurrency(totalIncome)}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <h3 className="text-sm text-gray-500 dark:text-gray-400 mb-1">Expenses</h3>
          <p className="text-xl font-semibold text-rose-600 dark:text-rose-400">
            {formatCurrency(totalExpenses)}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <h3 className="text-sm text-gray-500 dark:text-gray-400 mb-1">Net</h3>
          <p
            className={`text-xl font-semibold ${netAmount >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}
          >
            {formatCurrency(netAmount)}
          </p>
        </div>
      </div>

      {/* Filters */}
      <TransactionFilters
        accounts={accounts}
        selectedAccountIds={selectedAccountIds}
        startDate={startDate}
        endDate={endDate}
        onAccountChange={setSelectedAccountIds}
        onDateRangeChange={handleDateRangeChange}
      />

      {/* Transaction List */}
      {loading ? (
        <div className="text-center py-8">
          <p className="text-gray-500 dark:text-gray-400">Loading transactions...</p>
        </div>
      ) : filteredTransactions.length > 0 ? (
        <TransactionList transactions={filteredTransactions} accounts={accounts} />
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-8 text-center">
          <p className="text-gray-500 dark:text-gray-400">
            No transactions found for the selected filters.
          </p>
        </div>
      )}
    </div>
  );
}
