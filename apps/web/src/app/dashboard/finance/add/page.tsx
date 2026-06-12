'use client';

/**
 * Manual Financial Data Entry Page
 * Allows users to manually add financial accounts, transactions, investments, etc.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

type DataType = 'account' | 'transaction' | 'investment' | 'debt';

export default function AddFinancialDataPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [dataType, setDataType] = useState<DataType>('account');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Account form state
  const [accountData, setAccountData] = useState({
    name: '',
    type: 'checking',
    institution: '',
    balance: '',
    currency: 'USD',
  });

  // Transaction form state
  const [transactionData, setTransactionData] = useState({
    description: '',
    amount: '',
    category: '',
    date: new Date().toISOString().split('T')[0],
    accountId: '',
  });

  // Investment form state
  const [investmentData, setInvestmentData] = useState({
    symbol: '',
    name: '',
    shares: '',
    purchasePrice: '',
    currentPrice: '',
    purchaseDate: new Date().toISOString().split('T')[0],
  });

  // Debt form state
  const [debtData, setDebtData] = useState({
    name: '',
    type: 'credit_card',
    balance: '',
    interestRate: '',
    minimumPayment: '',
    dueDate: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // The friendly form fields for the active type; the API/service maps them to the real
      // finance.* columns + writes under the user session (RLS). No external backend URL needed.
      const dataByType: Record<DataType, Record<string, unknown>> = {
        account: accountData,
        transaction: transactionData,
        investment: investmentData,
        debt: debtData,
      };

      const response = await fetch('/api/finance/manual-entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: dataType, data: dataByType[dataType] }),
      });

      if (response.ok) {
        // Success - redirect back to finance dashboard
        router.push('/dashboard/finance');
      } else {
        const errorData = await response.json().catch(() => null);
        const reason = errorData?.error || errorData?.code || `HTTP ${response.status}`;
        setError(`Couldn't save your financial data (${reason}). Please try again.`);
      }
    } catch (err) {
      console.error('Error adding financial data:', err);
      setError('Failed to add financial data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4"
          >
            ← Back
          </button>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Add Financial Data
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manually enter your financial information
          </p>
        </div>

        {/* Data Type Selector */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            What would you like to add?
          </label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {(['account', 'transaction', 'investment', 'debt'] as DataType[]).map((type) => (
              <button
                key={type}
                onClick={() => setDataType(type)}
                className={`px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  dataType === type
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {/* Form */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {dataType === 'account' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Account Name
                  </label>
                  <input
                    type="text"
                    required
                    value={accountData.name}
                    onChange={(e) => setAccountData({ ...accountData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:text-white"
                    placeholder="e.g., Chase Checking"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Account Type
                  </label>
                  <select
                    value={accountData.type}
                    onChange={(e) => setAccountData({ ...accountData, type: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:text-white"
                  >
                    <option value="checking">Checking</option>
                    <option value="savings">Savings</option>
                    <option value="credit">Credit Card</option>
                    <option value="investment">Investment</option>
                    <option value="loan">Loan</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Institution
                  </label>
                  <input
                    type="text"
                    required
                    value={accountData.institution}
                    onChange={(e) =>
                      setAccountData({ ...accountData, institution: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:text-white"
                    placeholder="e.g., Chase Bank"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Current Balance
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={accountData.balance}
                    onChange={(e) => setAccountData({ ...accountData, balance: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:text-white"
                    placeholder="0.00"
                  />
                </div>
              </>
            )}

            {dataType === 'transaction' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Description
                  </label>
                  <input
                    type="text"
                    required
                    value={transactionData.description}
                    onChange={(e) =>
                      setTransactionData({ ...transactionData, description: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:text-white"
                    placeholder="e.g., Grocery Shopping"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Amount
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={transactionData.amount}
                    onChange={(e) =>
                      setTransactionData({ ...transactionData, amount: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:text-white"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Category
                  </label>
                  <select
                    value={transactionData.category}
                    onChange={(e) =>
                      setTransactionData({ ...transactionData, category: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:text-white"
                  >
                    <option value="">Select category...</option>
                    <option value="food">Food & Dining</option>
                    <option value="transportation">Transportation</option>
                    <option value="shopping">Shopping</option>
                    <option value="utilities">Utilities</option>
                    <option value="entertainment">Entertainment</option>
                    <option value="healthcare">Healthcare</option>
                    <option value="income">Income</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Date
                  </label>
                  <input
                    type="date"
                    required
                    value={transactionData.date}
                    onChange={(e) =>
                      setTransactionData({ ...transactionData, date: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>
              </>
            )}

            {/* Add similar forms for investment and debt */}
            {dataType === 'investment' && (
              <div className="text-center py-8">
                <p className="text-gray-600 dark:text-gray-400">
                  Investment entry form coming soon. For now, use the integrations to connect your
                  brokerage account.
                </p>
              </div>
            )}

            {dataType === 'debt' && (
              <div className="text-center py-8">
                <p className="text-gray-600 dark:text-gray-400">
                  Debt entry form coming soon. For now, add debts as credit card or loan accounts.
                </p>
              </div>
            )}

            {/* Submit Button */}
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => router.back()}
                className="flex-1 px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || dataType === 'investment' || dataType === 'debt'}
                className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Adding...' : 'Add Data'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
