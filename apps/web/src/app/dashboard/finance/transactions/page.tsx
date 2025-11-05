'use client';

import React, { useState, useEffect } from 'react';
import TransactionFilters from '@/components/financial/transactions/TransactionFilters';
import TransactionList from '@/components/financial/transactions/TransactionList';
import { EnhancedTransaction } from '@/types/financial';
// Removed mock data import - will fetch from database

export default function TransactionsPage() {
  // Initialize with last 30 days as default
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date;
  });
  
  const [endDate, setEndDate] = useState(new Date());
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<EnhancedTransaction[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Fetch accounts and transactions from database
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // TODO: Implement API endpoints for fetching accounts and transactions
        // const accountsRes = await fetch('/api/finance/accounts');
        // const transactionsRes = await fetch('/api/finance/transactions');
        // setAccounts(await accountsRes.json());
        // setTransactions(await transactionsRes.json());
        setAccounts([]);
        setTransactions([]);
      } catch (error) {
        console.error('Error fetching data:', error);
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
    filtered = filtered.filter(txn => {
      const txnDate = new Date(txn.date);
      return txnDate >= startDate && txnDate <= endDate;
    });
    
    // Filter by selected accounts
    if (selectedAccountIds.length > 0) {
      filtered = filtered.filter(txn => selectedAccountIds.includes(txn.accountId));
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
  
  // Calculate total income and expenses
  const totalIncome = filteredTransactions
    .filter(txn => txn.isIncome)
    .reduce((sum, txn) => sum + txn.amount, 0);
    
  const totalExpenses = filteredTransactions
    .filter(txn => !txn.isIncome)
    .reduce((sum, txn) => sum + txn.amount, 0);
    
  const netAmount = totalIncome - totalExpenses;
  
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
      <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white mb-6">Transactions</h1>
      
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
          <p className={`text-xl font-semibold ${netAmount >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
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
        <TransactionList
          transactions={filteredTransactions}
          accounts={accounts}
        />
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-8 text-center">
          <p className="text-gray-500 dark:text-gray-400">No transactions found for the selected filters.</p>
        </div>
      )}
    </div>
  );
}