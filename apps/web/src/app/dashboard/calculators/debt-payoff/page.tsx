'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/cards/Card';
import { ArrowLeft, Plus, Trash2, TrendingDown, DollarSign, Calendar } from 'lucide-react';

interface Debt {
  id: string;
  name: string;
  balance: number;
  interestRate: number;
  minimumPayment: number;
}

interface PayoffStrategy {
  method: 'avalanche' | 'snowball';
  monthsToPayoff: number;
  totalInterest: number;
  totalPaid: number;
  payoffDate: Date;
  monthlySavings?: number;
}

export default function DebtPayoffCalculator() {
  const [debts, setDebts] = useState<Debt[]>([
    { id: '1', name: 'Credit Card 1', balance: 5000, interestRate: 18.5, minimumPayment: 150 },
    { id: '2', name: 'Credit Card 2', balance: 3500, interestRate: 21.0, minimumPayment: 105 },
    { id: '3', name: 'Auto Loan', balance: 15000, interestRate: 6.5, minimumPayment: 350 },
  ]);

  const [extraPayment, setExtraPayment] = useState(200);
  const [selectedStrategy, setSelectedStrategy] = useState<'avalanche' | 'snowball'>('avalanche');
  const [avalancheResult, setAvalancheResult] = useState<PayoffStrategy | null>(null);
  const [snowballResult, setSnowballResult] = useState<PayoffStrategy | null>(null);

  const calculatePayoff = (debts: Debt[], method: 'avalanche' | 'snowball', extraPayment: number): PayoffStrategy => {
    let debtsCopy = debts.map(d => ({ ...d, currentBalance: d.balance }));

    // Sort debts based on method
    if (method === 'avalanche') {
      debtsCopy.sort((a, b) => b.interestRate - a.interestRate); // Highest interest first
    } else {
      debtsCopy.sort((a, b) => a.balance - b.balance); // Smallest balance first
    }

    let totalInterestPaid = 0;
    let monthsPassed = 0;
    const maxMonths = 600; // 50 years max

    while (debtsCopy.some(d => d.currentBalance > 0) && monthsPassed < maxMonths) {
      monthsPassed++;
      let remainingExtra = extraPayment;

      // Apply minimum payments and interest to all debts
      for (const debt of debtsCopy) {
        if (debt.currentBalance > 0) {
          const monthlyInterest = (debt.currentBalance * (debt.interestRate / 100)) / 12;
          totalInterestPaid += monthlyInterest;
          debt.currentBalance += monthlyInterest;

          const payment = Math.min(debt.minimumPayment, debt.currentBalance);
          debt.currentBalance -= payment;
        }
      }

      // Apply extra payment to the prioritized debt
      for (const debt of debtsCopy) {
        if (debt.currentBalance > 0 && remainingExtra > 0) {
          const extraForThisDebt = Math.min(remainingExtra, debt.currentBalance);
          debt.currentBalance -= extraForThisDebt;
          remainingExtra -= extraForThisDebt;

          if (debt.currentBalance <= 0) {
            debt.currentBalance = 0;
          }
        }
      }
    }

    const totalMinimumPayments = debts.reduce((sum, d) => sum + d.minimumPayment, 0);
    const totalPaid = debts.reduce((sum, d) => sum + d.balance, 0) + totalInterestPaid;

    const payoffDate = new Date();
    payoffDate.setMonth(payoffDate.getMonth() + monthsPassed);

    return {
      method,
      monthsToPayoff: monthsPassed,
      totalInterest: totalInterestPaid,
      totalPaid,
      payoffDate,
    };
  };

  useEffect(() => {
    if (debts.length > 0) {
      const avalanche = calculatePayoff(debts, 'avalanche', extraPayment);
      const snowball = calculatePayoff(debts, 'snowball', extraPayment);

      if (avalanche.totalInterest < snowball.totalInterest) {
        avalanche.monthlySavings = (snowball.totalInterest - avalanche.totalInterest) / avalanche.monthsToPayoff;
      } else {
        snowball.monthlySavings = (avalanche.totalInterest - snowball.totalInterest) / snowball.monthsToPayoff;
      }

      setAvalancheResult(avalanche);
      setSnowballResult(snowball);
    }
  }, [debts, extraPayment]);

  const addDebt = () => {
    const newDebt: Debt = {
      id: Date.now().toString(),
      name: `Debt ${debts.length + 1}`,
      balance: 1000,
      interestRate: 15,
      minimumPayment: 50,
    };
    setDebts([...debts, newDebt]);
  };

  const removeDebt = (id: string) => {
    setDebts(debts.filter(d => d.id !== id));
  };

  const updateDebt = (id: string, field: keyof Debt, value: string | number) => {
    setDebts(debts.map(d => d.id === id ? { ...d, [field]: value } : d));
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  };

  const totalDebt = debts.reduce((sum, d) => sum + d.balance, 0);
  const totalMinimum = debts.reduce((sum, d) => sum + d.minimumPayment, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-100 dark:from-gray-900 dark:to-gray-800 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/dashboard/calculators"
            className="inline-flex items-center gap-2 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Calculators
          </Link>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            💳 Debt Payoff Calculator
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Create a strategic debt elimination plan using snowball or avalanche methods
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Debts Input Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Summary Card */}
            <Card>
              <div className="p-6">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Debt</p>
                    <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                      {formatCurrency(totalDebt)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Minimum</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {formatCurrency(totalMinimum)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Extra Payment</p>
                    <div className="relative">
                      <DollarSign className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        type="number"
                        value={extraPayment}
                        onChange={(e) => setExtraPayment(parseFloat(e.target.value) || 0)}
                        className="w-full pl-7 pr-2 py-1 text-xl font-bold border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Individual Debts */}
            {debts.map((debt, index) => (
              <Card key={debt.id}>
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <input
                      type="text"
                      value={debt.name}
                      onChange={(e) => updateDebt(debt.id, 'name', e.target.value)}
                      className="text-xl font-semibold bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 text-gray-900 dark:text-white"
                    />
                    <button
                      onClick={() => removeDebt(debt.id)}
                      className="p-2 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Balance
                      </label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                          type="number"
                          value={debt.balance}
                          onChange={(e) => updateDebt(debt.id, 'balance', parseFloat(e.target.value) || 0)}
                          className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Interest Rate (%)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={debt.interestRate}
                        onChange={(e) => updateDebt(debt.id, 'interestRate', parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Minimum Payment
                      </label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                          type="number"
                          value={debt.minimumPayment}
                          onChange={(e) => updateDebt(debt.id, 'minimumPayment', parseFloat(e.target.value) || 0)}
                          className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            ))}

            {/* Add Debt Button */}
            <button
              onClick={addDebt}
              className="w-full py-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors flex items-center justify-center gap-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
            >
              <Plus className="h-5 w-5" />
              Add Another Debt
            </button>
          </div>

          {/* Results Column */}
          <div className="space-y-6">
            {/* Strategy Selector */}
            <Card>
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Payoff Strategy
                </h3>
                <div className="space-y-3">
                  <button
                    onClick={() => setSelectedStrategy('avalanche')}
                    className={`w-full p-4 rounded-lg text-left transition-all ${
                      selectedStrategy === 'avalanche'
                        ? 'bg-blue-600 text-white shadow-lg'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    <div className="font-bold mb-1">⚡ Avalanche Method</div>
                    <div className={`text-sm ${selectedStrategy === 'avalanche' ? 'text-blue-100' : 'text-gray-600 dark:text-gray-400'}`}>
                      Pay highest interest rate first. Saves the most money.
                    </div>
                  </button>

                  <button
                    onClick={() => setSelectedStrategy('snowball')}
                    className={`w-full p-4 rounded-lg text-left transition-all ${
                      selectedStrategy === 'snowball'
                        ? 'bg-purple-600 text-white shadow-lg'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    <div className="font-bold mb-1">❄️ Snowball Method</div>
                    <div className={`text-sm ${selectedStrategy === 'snowball' ? 'text-purple-100' : 'text-gray-600 dark:text-gray-400'}`}>
                      Pay smallest balance first. Builds momentum.
                    </div>
                  </button>
                </div>
              </div>
            </Card>

            {/* Selected Strategy Results */}
            {(selectedStrategy === 'avalanche' ? avalancheResult : snowballResult) && (
              <>
                <Card className={`${selectedStrategy === 'avalanche' ? 'bg-gradient-to-br from-blue-500 to-indigo-600' : 'bg-gradient-to-br from-purple-500 to-pink-600'}`}>
                  <div className="p-6 text-white">
                    <div className="flex items-center gap-2 mb-4">
                      <Calendar className="h-6 w-6" />
                      <h2 className="text-2xl font-bold">
                        Debt-Free Date
                      </h2>
                    </div>
                    <div className="text-4xl font-bold mb-2">
                      {formatDate((selectedStrategy === 'avalanche' ? avalancheResult : snowballResult)!.payoffDate)}
                    </div>
                    <p className={`text-sm ${selectedStrategy === 'avalanche' ? 'text-blue-100' : 'text-purple-100'}`}>
                      In {(selectedStrategy === 'avalanche' ? avalancheResult : snowballResult)!.monthsToPayoff} months
                      ({((selectedStrategy === 'avalanche' ? avalancheResult : snowballResult)!.monthsToPayoff / 12).toFixed(1)} years)
                    </p>
                  </div>
                </Card>

                <Card>
                  <div className="p-6">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                      Cost Breakdown
                    </h3>

                    <div className="space-y-4">
                      <div className="flex justify-between items-center pb-3 border-b border-gray-200 dark:border-gray-700">
                        <span className="text-gray-600 dark:text-gray-400">
                          Total Debt
                        </span>
                        <span className="text-lg font-semibold text-gray-900 dark:text-white">
                          {formatCurrency(totalDebt)}
                        </span>
                      </div>

                      <div className="flex justify-between items-center pb-3 border-b border-gray-200 dark:border-gray-700">
                        <span className="text-gray-600 dark:text-gray-400">
                          Total Interest
                        </span>
                        <span className="text-lg font-semibold text-red-600 dark:text-red-400">
                          {formatCurrency((selectedStrategy === 'avalanche' ? avalancheResult : snowballResult)!.totalInterest)}
                        </span>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-gray-600 dark:text-gray-400 font-semibold">
                          Total Amount Paid
                        </span>
                        <span className="text-xl font-bold text-gray-900 dark:text-white">
                          {formatCurrency((selectedStrategy === 'avalanche' ? avalancheResult : snowballResult)!.totalPaid)}
                        </span>
                      </div>
                    </div>
                  </div>
                </Card>

                {/* Comparison */}
                {avalancheResult && snowballResult && (
                  <Card>
                    <div className="p-6">
                      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                        Strategy Comparison
                      </h3>

                      <div className="space-y-3">
                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                          <div className="flex justify-between mb-1">
                            <span className="font-medium text-blue-900 dark:text-blue-300">⚡ Avalanche</span>
                            <span className="font-bold text-blue-900 dark:text-blue-300">
                              {formatCurrency(avalancheResult.totalInterest)}
                            </span>
                          </div>
                          <div className="text-xs text-blue-700 dark:text-blue-400">
                            {avalancheResult.monthsToPayoff} months
                          </div>
                        </div>

                        <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                          <div className="flex justify-between mb-1">
                            <span className="font-medium text-purple-900 dark:text-purple-300">❄️ Snowball</span>
                            <span className="font-bold text-purple-900 dark:text-purple-300">
                              {formatCurrency(snowballResult.totalInterest)}
                            </span>
                          </div>
                          <div className="text-xs text-purple-700 dark:text-purple-400">
                            {snowballResult.monthsToPayoff} months
                          </div>
                        </div>

                        {avalancheResult.totalInterest < snowballResult.totalInterest ? (
                          <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-center">
                            <p className="text-sm font-medium text-green-900 dark:text-green-300">
                              Avalanche saves you {formatCurrency(snowballResult.totalInterest - avalancheResult.totalInterest)} in interest!
                            </p>
                          </div>
                        ) : (
                          <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-center">
                            <p className="text-sm font-medium text-green-900 dark:text-green-300">
                              Snowball gets you debt-free {avalancheResult.monthsToPayoff - snowballResult.monthsToPayoff} months faster!
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                )}

                {/* Tips */}
                <Card>
                  <div className="p-6">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                      💡 Debt Payoff Tips
                    </h3>

                    <ul className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
                      <li className="flex items-start gap-2">
                        <span className="text-red-600 dark:text-red-400 font-bold">•</span>
                        <span>
                          <strong>Stop adding new debt:</strong> Cut up credit cards or freeze them to avoid temptation.
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-red-600 dark:text-red-400 font-bold">•</span>
                        <span>
                          <strong>Build an emergency fund:</strong> Even $1,000 can prevent you from going back into debt.
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-red-600 dark:text-red-400 font-bold">•</span>
                        <span>
                          <strong>Consider debt consolidation:</strong> A lower interest rate can save thousands.
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-red-600 dark:text-red-400 font-bold">•</span>
                        <span>
                          <strong>Increase income:</strong> Side hustles or selling items can accelerate payoff.
                        </span>
                      </li>
                    </ul>
                  </div>
                </Card>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
