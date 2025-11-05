'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/cards/Card';
import { ArrowLeft, DollarSign, Calendar, Percent, TrendingUp, BarChart3 } from 'lucide-react';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface LoanInputs {
  loanAmount: number;
  interestRate: number;
  loanTerm: number;
  loanType: 'months' | 'years';
}

interface LoanResults {
  monthlyPayment: number;
  totalPayments: number;
  totalInterest: number;
  totalCost: number;
  payoffDate: Date;
}

interface AmortizationEntry {
  month: number;
  payment: number;
  principal: number;
  interest: number;
  balance: number;
}

export default function LoanCalculator() {
  const [inputs, setInputs] = useState<LoanInputs>({
    loanAmount: 25000,
    interestRate: 5.5,
    loanTerm: 5,
    loanType: 'years',
  });

  const [results, setResults] = useState<LoanResults | null>(null);
  const [amortization, setAmortization] = useState<AmortizationEntry[]>([]);
  const [activeTab, setActiveTab] = useState<'summary' | 'visualization' | 'details'>('summary');

  const calculateLoan = () => {
    const principal = inputs.loanAmount;
    const annualRate = inputs.interestRate / 100;
    const monthlyRate = annualRate / 12;
    const numberOfPayments = inputs.loanType === 'years' ? inputs.loanTerm * 12 : inputs.loanTerm;

    // Monthly payment using formula: M = P[r(1+r)^n]/[(1+r)^n-1]
    const monthlyPayment =
      principal *
      (monthlyRate * Math.pow(1 + monthlyRate, numberOfPayments)) /
      (Math.pow(1 + monthlyRate, numberOfPayments) - 1);

    const totalPayments = monthlyPayment * numberOfPayments;
    const totalInterest = totalPayments - principal;
    const totalCost = totalPayments;

    // Calculate payoff date
    const payoffDate = new Date();
    payoffDate.setMonth(payoffDate.getMonth() + numberOfPayments);

    setResults({
      monthlyPayment,
      totalPayments: numberOfPayments,
      totalInterest,
      totalCost,
      payoffDate,
    });

    // Generate amortization schedule
    const schedule: AmortizationEntry[] = [];
    let balance = principal;

    for (let month = 1; month <= numberOfPayments; month++) {
      const interestPayment = balance * monthlyRate;
      const principalPayment = monthlyPayment - interestPayment;
      balance -= principalPayment;

      schedule.push({
        month,
        payment: monthlyPayment,
        principal: principalPayment,
        interest: interestPayment,
        balance: Math.max(0, balance),
      });
    }

    setAmortization(schedule);
  };

  useEffect(() => {
    calculateLoan();
  }, [inputs]);

  const updateInput = (key: keyof LoanInputs, value: number | string) => {
    setInputs(prev => ({ ...prev, [key]: value }));
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-amber-100 dark:from-gray-900 dark:to-gray-800 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/dashboard/calculators"
            className="inline-flex items-center gap-2 text-yellow-600 dark:text-yellow-400 hover:text-yellow-800 dark:hover:text-yellow-300 mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Calculators
          </Link>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            💰 Loan Payment Calculator
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Calculate monthly payments for auto loans, personal loans, student loans, and more
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input Section */}
          <div className="space-y-6">
            {/* Loan Amount */}
            <Card>
              <div className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <DollarSign className="h-5 w-5 text-yellow-600" />
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    Loan Details
                  </h2>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Loan Amount
                    </label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        type="number"
                        value={inputs.loanAmount}
                        onChange={(e) => updateInput('loanAmount', parseFloat(e.target.value) || 0)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Interest Rate: {inputs.interestRate.toFixed(2)}%
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="20"
                      step="0.25"
                      value={inputs.interestRate}
                      onChange={(e) => updateInput('interestRate', parseFloat(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                    />
                    <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                      <span>0%</span>
                      <span>20%</span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Loan Term */}
            <Card>
              <div className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Calendar className="h-5 w-5 text-blue-600" />
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    Loan Term
                  </h2>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Term Type
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => updateInput('loanType', 'months')}
                        className={`py-2 px-4 rounded-lg font-medium transition-all ${
                          inputs.loanType === 'months'
                            ? 'bg-blue-600 text-white shadow-lg'
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                        }`}
                      >
                        Months
                      </button>
                      <button
                        onClick={() => updateInput('loanType', 'years')}
                        className={`py-2 px-4 rounded-lg font-medium transition-all ${
                          inputs.loanType === 'years'
                            ? 'bg-blue-600 text-white shadow-lg'
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                        }`}
                      >
                        Years
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Loan Term: {inputs.loanTerm} {inputs.loanType}
                    </label>
                    <input
                      type="range"
                      min={inputs.loanType === 'years' ? 1 : 12}
                      max={inputs.loanType === 'years' ? 30 : 360}
                      step={inputs.loanType === 'years' ? 1 : 6}
                      value={inputs.loanTerm}
                      onChange={(e) => updateInput('loanTerm', parseInt(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                    />
                    <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                      <span>{inputs.loanType === 'years' ? '1 year' : '12 months'}</span>
                      <span>{inputs.loanType === 'years' ? '30 years' : '360 months'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Quick Presets */}
            <Card>
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Quick Presets
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setInputs({ loanAmount: 35000, interestRate: 6.5, loanTerm: 6, loanType: 'years' })}
                    className="p-3 bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900 dark:to-blue-800 rounded-lg hover:scale-105 transition-transform"
                  >
                    <div className="text-2xl mb-1">🚗</div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white">Auto Loan</div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">$35k @ 6.5%</div>
                  </button>
                  <button
                    onClick={() => setInputs({ loanAmount: 15000, interestRate: 9.5, loanTerm: 5, loanType: 'years' })}
                    className="p-3 bg-gradient-to-br from-purple-100 to-purple-200 dark:from-purple-900 dark:to-purple-800 rounded-lg hover:scale-105 transition-transform"
                  >
                    <div className="text-2xl mb-1">💳</div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white">Personal Loan</div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">$15k @ 9.5%</div>
                  </button>
                  <button
                    onClick={() => setInputs({ loanAmount: 45000, interestRate: 4.5, loanTerm: 10, loanType: 'years' })}
                    className="p-3 bg-gradient-to-br from-green-100 to-green-200 dark:from-green-900 dark:to-green-800 rounded-lg hover:scale-105 transition-transform"
                  >
                    <div className="text-2xl mb-1">🎓</div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white">Student Loan</div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">$45k @ 4.5%</div>
                  </button>
                  <button
                    onClick={() => setInputs({ loanAmount: 20000, interestRate: 7.0, loanTerm: 4, loanType: 'years' })}
                    className="p-3 bg-gradient-to-br from-orange-100 to-orange-200 dark:from-orange-900 dark:to-orange-800 rounded-lg hover:scale-105 transition-transform"
                  >
                    <div className="text-2xl mb-1">🏠</div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white">Home Equity</div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">$20k @ 7%</div>
                  </button>
                </div>
              </div>
            </Card>
          </div>

          {/* Results Section */}
          <div className="space-y-6">
            {results && (
              <>
                {/* Main Result Card */}
                <Card className="bg-gradient-to-br from-yellow-500 to-amber-600">
                  <div className="p-6 text-white">
                    <div className="flex items-center gap-2 mb-4">
                      <DollarSign className="h-6 w-6" />
                      <h2 className="text-2xl font-bold">
                        Monthly Payment
                      </h2>
                    </div>
                    <div className="text-5xl font-bold mb-2">
                      {formatCurrency(results.monthlyPayment)}
                    </div>
                    <p className="text-yellow-100 text-sm">
                      For {results.totalPayments} months ({inputs.loanTerm} {inputs.loanType})
                    </p>
                  </div>
                </Card>

                {/* Cost Breakdown */}
                <Card>
                  <div className="p-6">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                      Cost Breakdown
                    </h3>

                    <div className="space-y-4">
                      <div className="flex justify-between items-center pb-3 border-b border-gray-200 dark:border-gray-700">
                        <span className="text-gray-600 dark:text-gray-400">
                          Principal (Loan Amount)
                        </span>
                        <span className="text-lg font-semibold text-gray-900 dark:text-white">
                          {formatCurrency(inputs.loanAmount)}
                        </span>
                      </div>

                      <div className="flex justify-between items-center pb-3 border-b border-gray-200 dark:border-gray-700">
                        <span className="text-gray-600 dark:text-gray-400">
                          Total Interest Paid
                        </span>
                        <span className="text-lg font-semibold text-red-600 dark:text-red-400">
                          {formatCurrency(results.totalInterest)}
                        </span>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-gray-600 dark:text-gray-400 font-semibold">
                          Total Cost
                        </span>
                        <span className="text-xl font-bold text-gray-900 dark:text-white">
                          {formatCurrency(results.totalCost)}
                        </span>
                      </div>
                    </div>

                    <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        <span className="font-semibold text-gray-900 dark:text-white">Payoff Date</span>
                      </div>
                      <p className="text-lg text-blue-600 dark:text-blue-400">
                        {formatDate(results.payoffDate)}
                      </p>
                    </div>
                  </div>
                </Card>

                {/* Interest vs Principal Chart */}
                <Card>
                  <div className="p-6">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                      Payment Composition
                    </h3>

                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-600 dark:text-gray-400">Principal</span>
                          <span className="text-gray-900 dark:text-white font-medium">
                            {((inputs.loanAmount / results.totalCost) * 100).toFixed(1)}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                          <div
                            className="bg-green-500 h-3 rounded-full"
                            style={{ width: `${(inputs.loanAmount / results.totalCost) * 100}%` }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-600 dark:text-gray-400">Interest</span>
                          <span className="text-gray-900 dark:text-white font-medium">
                            {((results.totalInterest / results.totalCost) * 100).toFixed(1)}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                          <div
                            className="bg-red-500 h-3 rounded-full"
                            style={{ width: `${(results.totalInterest / results.totalCost) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>

                {/* Tab Navigation */}
                <Card>
                  <div className="p-6">
                    <div className="flex gap-2 mb-6">
                      <button
                        onClick={() => setActiveTab('summary')}
                        className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
                          activeTab === 'summary'
                            ? 'bg-yellow-600 text-white shadow-lg'
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                        }`}
                      >
                        Summary
                      </button>
                      <button
                        onClick={() => setActiveTab('visualization')}
                        className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
                          activeTab === 'visualization'
                            ? 'bg-yellow-600 text-white shadow-lg'
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                        }`}
                      >
                        <BarChart3 className="h-4 w-4" />
                        Visualization
                      </button>
                      <button
                        onClick={() => setActiveTab('details')}
                        className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
                          activeTab === 'details'
                            ? 'bg-yellow-600 text-white shadow-lg'
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                        }`}
                      >
                        Details
                      </button>
                    </div>

                    {/* Summary Tab */}
                    {activeTab === 'summary' && (
                      <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                          Loan Summary
                        </h3>
                        <div className="space-y-3 text-sm">
                          <div className="flex justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <span className="text-gray-600 dark:text-gray-400">Loan Amount</span>
                            <span className="font-semibold text-gray-900 dark:text-white">{formatCurrency(inputs.loanAmount)}</span>
                          </div>
                          <div className="flex justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <span className="text-gray-600 dark:text-gray-400">Interest Rate</span>
                            <span className="font-semibold text-gray-900 dark:text-white">{inputs.interestRate}%</span>
                          </div>
                          <div className="flex justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <span className="text-gray-600 dark:text-gray-400">Loan Term</span>
                            <span className="font-semibold text-gray-900 dark:text-white">{inputs.loanTerm} {inputs.loanType}</span>
                          </div>
                          <div className="flex justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <span className="text-gray-600 dark:text-gray-400">Number of Payments</span>
                            <span className="font-semibold text-gray-900 dark:text-white">{results.totalPayments} months</span>
                          </div>
                          <div className="flex justify-between p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border-2 border-yellow-200 dark:border-yellow-800">
                            <span className="text-gray-900 dark:text-white font-semibold">Monthly Payment</span>
                            <span className="font-bold text-yellow-600 dark:text-yellow-400">{formatCurrency(results.monthlyPayment)}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Visualization Tab */}
                    {activeTab === 'visualization' && (
                      <div className="space-y-6">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                            Payment Breakdown Over Time
                          </h3>
                          <ResponsiveContainer width="100%" height={300}>
                            <AreaChart data={amortization.filter((_, i) => i % Math.ceil(amortization.length / 50) === 0)}>
                              <defs>
                                <linearGradient id="colorPrincipal" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.1}/>
                                </linearGradient>
                                <linearGradient id="colorLoanInterest" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/>
                                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0.1}/>
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" className="stroke-gray-300 dark:stroke-gray-600" />
                              <XAxis
                                dataKey="month"
                                className="text-gray-600 dark:text-gray-400"
                                label={{ value: 'Month', position: 'insideBottom', offset: -5 }}
                              />
                              <YAxis
                                className="text-gray-600 dark:text-gray-400"
                                tickFormatter={(value) => `$${(value / 1000).toFixed(1)}k`}
                              />
                              <Tooltip
                                formatter={(value: number) => formatCurrency(value)}
                                contentStyle={{
                                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                                  borderRadius: '8px',
                                  border: '1px solid #e5e7eb'
                                }}
                              />
                              <Legend />
                              <Area
                                type="monotone"
                                dataKey="principal"
                                stackId="1"
                                stroke="#10b981"
                                fill="url(#colorPrincipal)"
                                name="Principal"
                              />
                              <Area
                                type="monotone"
                                dataKey="interest"
                                stackId="1"
                                stroke="#ef4444"
                                fill="url(#colorLoanInterest)"
                                name="Interest"
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>

                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                            Remaining Balance Over Time
                          </h3>
                          <ResponsiveContainer width="100%" height={250}>
                            <LineChart data={amortization.filter((_, i) => i % Math.ceil(amortization.length / 50) === 0)}>
                              <CartesianGrid strokeDasharray="3 3" className="stroke-gray-300 dark:stroke-gray-600" />
                              <XAxis
                                dataKey="month"
                                className="text-gray-600 dark:text-gray-400"
                                label={{ value: 'Month', position: 'insideBottom', offset: -5 }}
                              />
                              <YAxis
                                className="text-gray-600 dark:text-gray-400"
                                tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                              />
                              <Tooltip
                                formatter={(value: number) => formatCurrency(value)}
                                contentStyle={{
                                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                                  borderRadius: '8px',
                                  border: '1px solid #e5e7eb'
                                }}
                              />
                              <Legend />
                              <Line
                                type="monotone"
                                dataKey="balance"
                                stroke="#f59e0b"
                                strokeWidth={3}
                                dot={false}
                                name="Remaining Balance"
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}

                    {/* Details Tab */}
                    {activeTab === 'details' && (
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                          Amortization Schedule
                        </h3>
                        <div className="max-h-96 overflow-y-auto">
                          <table className="w-full text-sm">
                            <thead className="sticky top-0 bg-gray-100 dark:bg-gray-800">
                              <tr>
                                <th className="text-left py-2 px-2">Month</th>
                                <th className="text-right py-2 px-2">Payment</th>
                                <th className="text-right py-2 px-2">Principal</th>
                                <th className="text-right py-2 px-2">Interest</th>
                                <th className="text-right py-2 px-2">Balance</th>
                              </tr>
                            </thead>
                            <tbody className="text-gray-600 dark:text-gray-400">
                              {amortization.map((entry, index) => (
                                <tr key={index} className="border-b border-gray-200 dark:border-gray-700">
                                  <td className="py-2 px-2">{entry.month}</td>
                                  <td className="text-right py-2 px-2">{formatCurrency(entry.payment)}</td>
                                  <td className="text-right py-2 px-2 text-green-600 dark:text-green-400">{formatCurrency(entry.principal)}</td>
                                  <td className="text-right py-2 px-2 text-red-600 dark:text-red-400">{formatCurrency(entry.interest)}</td>
                                  <td className="text-right py-2 px-2 font-medium">{formatCurrency(entry.balance)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                </Card>

                {/* Tips */}
                <Card>
                  <div className="p-6">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                      💡 Tips to Reduce Loan Costs
                    </h3>

                    <ul className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
                      <li className="flex items-start gap-2">
                        <span className="text-yellow-600 dark:text-yellow-400 font-bold">•</span>
                        <span>
                          <strong>Make extra payments:</strong> Even small additional payments toward principal can significantly reduce total interest.
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-yellow-600 dark:text-yellow-400 font-bold">•</span>
                        <span>
                          <strong>Bi-weekly payments:</strong> Making half-payments every two weeks results in one extra full payment per year.
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-yellow-600 dark:text-yellow-400 font-bold">•</span>
                        <span>
                          <strong>Refinance if rates drop:</strong> Lower interest rates can save thousands over the life of the loan.
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-yellow-600 dark:text-yellow-400 font-bold">•</span>
                        <span>
                          <strong>Shorter term:</strong> While monthly payments are higher, shorter terms save significantly on interest.
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
