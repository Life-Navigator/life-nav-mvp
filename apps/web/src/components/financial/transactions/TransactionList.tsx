'use client';

import React from 'react';
import { EnhancedTransaction, FinancialAccount } from '@/types/financial';

interface TransactionListProps {
  transactions: EnhancedTransaction[];
  accounts: FinancialAccount[];
}

export default function TransactionList({ transactions, accounts }: TransactionListProps) {
  // Group transactions by date
  const groupTransactionsByDate = () => {
    const groups: { [date: string]: EnhancedTransaction[] } = {};
    
    transactions.forEach(transaction => {
      const dateStr = new Date(transaction.date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      
      if (!groups[dateStr]) {
        groups[dateStr] = [];
      }
      
      groups[dateStr].push(transaction);
    });
    
    // Sort each group by amount (largest absolute value first)
    Object.keys(groups).forEach(date => {
      groups[date].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
    });
    
    return groups;
  };
  
  // Get account name by ID
  const getAccountName = (accountId: string) => {
    const account = accounts.find(acc => acc.id === accountId);
    return account ? account.name : 'Unknown Account';
  };
  
  // Format currency
  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Math.abs(amount));
  };
  
  // Get transaction groups
  const transactionGroups = groupTransactionsByDate();
  const dateKeys = Object.keys(transactionGroups).sort((a, b) => 
    new Date(b).getTime() - new Date(a).getTime()
  );
  
  // Get category icon (simplified version)
  const getCategoryIcon = (category: string) => {
    const lowerCategory = category.toLowerCase();
    
    if (lowerCategory.includes('food') || lowerCategory.includes('dining')) return '🍽️';
    if (lowerCategory.includes('transport')) return '🚗';
    if (lowerCategory.includes('home') || lowerCategory.includes('housing')) return '🏠';
    if (lowerCategory.includes('entertainment')) return '🎭';
    if (lowerCategory.includes('shopping')) return '🛍️';
    if (lowerCategory.includes('utilities')) return '💡';
    if (lowerCategory.includes('health')) return '🏥';
    if (lowerCategory.includes('travel')) return '✈️';
    if (lowerCategory.includes('income')) return '💰';
    if (lowerCategory.includes('transfer')) return '🔄';
    
    return '📋';
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      {transactions.length === 0 ? (
        <div className="p-6 text-center">
          <p className="text-gray-500 dark:text-gray-400">No transactions found for the selected criteria.</p>
        </div>
      ) : (
        <div>
          {dateKeys.map(date => (
            <div key={date} className="border-b border-gray-200 dark:border-gray-700 last:border-0">
              <div className="px-4 py-3 bg-gray-50 dark:bg-gray-750 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">{date}</h3>
              </div>
              
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {transactionGroups[date].map(transaction => (
                  <div key={transaction.id} className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mr-3">
                          {transaction.merchant?.logo ? (
                            <img src={transaction.merchant.logo} alt={transaction.merchant.name} className="w-6 h-6" />
                          ) : (
                            <span className="text-lg">{getCategoryIcon(transaction.category)}</span>
                          )}
                        </div>
                        
                        <div>
                          <h4 className="font-medium text-gray-900 dark:text-white">{transaction.description}</h4>
                          <div className="flex gap-2 text-xs text-gray-500 dark:text-gray-400">
                            <span>{getAccountName(transaction.accountId)}</span>
                            <span>•</span>
                            <span>{transaction.category}</span>
                            {transaction.isPending && (
                              <>
                                <span>•</span>
                                <span className="text-amber-600 dark:text-amber-400">Pending</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <p className={`font-medium ${
                          transaction.isIncome 
                            ? 'text-emerald-600 dark:text-emerald-400' 
                            : 'text-gray-700 dark:text-gray-300'
                        }`}>
                          {transaction.isIncome ? '+' : '-'}{formatCurrency(transaction.amount, transaction.currency)}
                        </p>
                        {transaction.tags && transaction.tags.length > 0 && (
                          <div className="flex gap-1 justify-end mt-1">
                            {transaction.tags.map(tag => (
                              <span 
                                key={tag} 
                                className="px-1.5 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}