'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/cards/Card';
import { ArrowLeft, TrendingUp, DollarSign, Calendar, Percent, BarChart3 } from 'lucide-react';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface CompoundInputs {
  principal: number;
  monthlyContribution: number;
  annualRate: number;
  years: number;
  compoundingFrequency: 'annually' | 'semi-annually' | 'quarterly' | 'monthly' | 'daily';
}

interface CompoundResults {
  futureValue: number;
  totalContributions: number;
  totalInterest: number;
  effectiveRate: number;
  yearlyBreakdown: YearBreakdown[];
}

interface YearBreakdown {
  year: number;
  balance: number;
  totalContributions: number;
  totalInterest: number;
}

export default function CompoundInterestCalculator() {
  const [inputs, setInputs] = useState<CompoundInputs>({
    principal: 10000,
    monthlyContribution: 500,
    annualRate: 8,
    years: 20,
    compoundingFrequency: 'monthly',
  });

  const [results, setResults] = useState<CompoundResults | null>(null);
  const [activeTab, setActiveTab] = useState<'summary' | 'visualization' | 'details'>('summary');

  const getCompoundingPeriodsPerYear = (frequency: string): number => {
    switch (frequency) {
      case 'annually': return 1;
      case 'semi-annually': return 2;
      case 'quarterly': return 4;
      case 'monthly': return 12;
      case 'daily': return 365;
      default: return 12;
    }
  };

  const calculateCompoundInterest = () => {
    const P = inputs.principal;
    const PMT = inputs.monthlyContribution;
    const r = inputs.annualRate / 100;
    const n = getCompoundingPeriodsPerYear(inputs.compoundingFrequency);
    const t = inputs.years;

    // Future value of principal with compound interest
    const futureValueOfPrincipal = P * Math.pow(1 + r / n, n * t);

    // Future value of monthly contributions (annuity)
    // Convert monthly payments to match compounding frequency
    const paymentsPerYear = 12;
    const totalPayments = paymentsPerYear * t;
    const ratePerPayment = r / paymentsPerYear;

    let futureValueOfContributions = 0;
    if (PMT > 0) {
      // Using future value of annuity formula with compounding
      futureValueOfContributions = PMT * ((Math.pow(1 + ratePerPayment, totalPayments) - 1) / ratePerPayment) * (1 + ratePerPayment);
    }

    const futureValue = futureValueOfPrincipal + futureValueOfContributions;
    const totalContributions = P + (PMT * 12 * t);
    const totalInterest = futureValue - totalContributions;

    // Effective annual rate
    const effectiveRate = (Math.pow(1 + r / n, n) - 1) * 100;

    // Yearly breakdown
    const yearlyBreakdown: YearBreakdown[] = [];
    let currentBalance = P;
    let currentContributions = P;

    for (let year = 1; year <= t; year++) {
      const yearsElapsed = year;
      const principalGrowth = P * Math.pow(1 + r / n, n * yearsElapsed);

      let contributionsGrowth = 0;
      if (PMT > 0) {
        const monthsElapsed = year * 12;
        contributionsGrowth = PMT * ((Math.pow(1 + ratePerPayment, monthsElapsed) - 1) / ratePerPayment) * (1 + ratePerPayment);
      }

      currentBalance = principalGrowth + contributionsGrowth;
      currentContributions = P + (PMT * 12 * year);
      const currentInterest = currentBalance - currentContributions;

      yearlyBreakdown.push({
        year,
        balance: currentBalance,
        totalContributions: currentContributions,
        totalInterest: currentInterest,
      });
    }

    setResults({
      futureValue,
      totalContributions,
      totalInterest,
      effectiveRate,
      yearlyBreakdown,
    });
  };

  useEffect(() => {
    calculateCompoundInterest();
  }, [inputs]);

  const updateInput = (key: keyof CompoundInputs, value: number | string) => {
    setInputs(prev => ({ ...prev, [key]: value }));
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/dashboard/calculators"
            className="inline-flex items-center gap-2 text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300 mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Calculators
          </Link>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            📈 Compound Interest Calculator
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            See the power of compound interest and watch your investments grow over time
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input Section */}
          <div className="space-y-6">
            {/* Initial Investment */}
            <Card>
              <div className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <DollarSign className="h-5 w-5 text-purple-600" />
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    Investment Details
                  </h2>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Initial Investment (Principal)
                    </label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        type="number"
                        value={inputs.principal}
                        onChange={(e) => updateInput('principal', parseFloat(e.target.value) || 0)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Monthly Contribution
                    </label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        type="number"
                        value={inputs.monthlyContribution}
                        onChange={(e) => updateInput('monthlyContribution', parseFloat(e.target.value) || 0)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Rate and Time */}
            <Card>
              <div className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Percent className="h-5 w-5 text-blue-600" />
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    Rate & Time Period
                  </h2>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Annual Interest Rate: {inputs.annualRate.toFixed(1)}%
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="20"
                      step="0.5"
                      value={inputs.annualRate}
                      onChange={(e) => updateInput('annualRate', parseFloat(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                    />
                    <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                      <span>0%</span>
                      <span>20%</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Investment Period: {inputs.years} years
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="50"
                      step="1"
                      value={inputs.years}
                      onChange={(e) => updateInput('years', parseInt(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                    />
                    <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                      <span>1 year</span>
                      <span>50 years</span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Compounding Frequency */}
            <Card>
              <div className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Calendar className="h-5 w-5 text-green-600" />
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    Compounding Frequency
                  </h2>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {[
                    { value: 'annually', label: 'Annually' },
                    { value: 'semi-annually', label: 'Semi-Annually' },
                    { value: 'quarterly', label: 'Quarterly' },
                    { value: 'monthly', label: 'Monthly' },
                    { value: 'daily', label: 'Daily' },
                  ].map((freq) => (
                    <button
                      key={freq.value}
                      onClick={() => updateInput('compoundingFrequency', freq.value)}
                      className={`py-3 px-4 rounded-lg font-medium transition-all ${
                        inputs.compoundingFrequency === freq.value
                          ? 'bg-green-600 text-white shadow-lg scale-105'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                      }`}
                    >
                      {freq.label}
                    </button>
                  ))}
                </div>

                {results && (
                  <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Effective Annual Rate: <span className="font-bold text-green-600 dark:text-green-400">{results.effectiveRate.toFixed(2)}%</span>
                    </p>
                  </div>
                )}
              </div>
            </Card>

            {/* Quick Scenarios */}
            <Card>
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Quick Scenarios
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setInputs({ principal: 5000, monthlyContribution: 200, annualRate: 8, years: 30, compoundingFrequency: 'monthly' })}
                    className="p-3 bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900 dark:to-blue-800 rounded-lg hover:scale-105 transition-transform text-left"
                  >
                    <div className="text-2xl mb-1">🎯</div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white">Conservative</div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">$5k + $200/mo @ 8%</div>
                  </button>
                  <button
                    onClick={() => setInputs({ principal: 10000, monthlyContribution: 500, annualRate: 10, years: 30, compoundingFrequency: 'monthly' })}
                    className="p-3 bg-gradient-to-br from-green-100 to-green-200 dark:from-green-900 dark:to-green-800 rounded-lg hover:scale-105 transition-transform text-left"
                  >
                    <div className="text-2xl mb-1">📊</div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white">Moderate</div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">$10k + $500/mo @ 10%</div>
                  </button>
                  <button
                    onClick={() => setInputs({ principal: 25000, monthlyContribution: 1000, annualRate: 12, years: 30, compoundingFrequency: 'monthly' })}
                    className="p-3 bg-gradient-to-br from-orange-100 to-orange-200 dark:from-orange-900 dark:to-orange-800 rounded-lg hover:scale-105 transition-transform text-left"
                  >
                    <div className="text-2xl mb-1">🚀</div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white">Aggressive</div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">$25k + $1k/mo @ 12%</div>
                  </button>
                  <button
                    onClick={() => setInputs({ principal: 1000, monthlyContribution: 100, annualRate: 7, years: 40, compoundingFrequency: 'monthly' })}
                    className="p-3 bg-gradient-to-br from-purple-100 to-purple-200 dark:from-purple-900 dark:to-purple-800 rounded-lg hover:scale-105 transition-transform text-left"
                  >
                    <div className="text-2xl mb-1">⏰</div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white">Long Term</div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">$1k + $100/mo @ 7%</div>
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
                <Card className="bg-gradient-to-br from-purple-500 to-indigo-600">
                  <div className="p-6 text-white">
                    <div className="flex items-center gap-2 mb-4">
                      <TrendingUp className="h-6 w-6" />
                      <h2 className="text-2xl font-bold">
                        Future Value
                      </h2>
                    </div>
                    <div className="text-5xl font-bold mb-2">
                      {formatCurrency(results.futureValue)}
                    </div>
                    <p className="text-purple-100 text-sm">
                      After {inputs.years} years
                    </p>
                  </div>
                </Card>

                {/* Breakdown */}
                <Card>
                  <div className="p-6">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                      Growth Breakdown
                    </h3>

                    <div className="space-y-4">
                      <div className="flex justify-between items-center pb-3 border-b border-gray-200 dark:border-gray-700">
                        <span className="text-gray-600 dark:text-gray-400">
                          Total Contributions
                        </span>
                        <span className="text-lg font-semibold text-gray-900 dark:text-white">
                          {formatCurrency(results.totalContributions)}
                        </span>
                      </div>

                      <div className="flex justify-between items-center pb-3 border-b border-gray-200 dark:border-gray-700">
                        <span className="text-gray-600 dark:text-gray-400">
                          Interest Earned
                        </span>
                        <span className="text-lg font-semibold text-green-600 dark:text-green-400">
                          {formatCurrency(results.totalInterest)}
                        </span>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-gray-600 dark:text-gray-400 font-semibold">
                          Total Value
                        </span>
                        <span className="text-xl font-bold text-gray-900 dark:text-white">
                          {formatCurrency(results.futureValue)}
                        </span>
                      </div>
                    </div>

                    {/* Visual representation */}
                    <div className="mt-6">
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-gray-600 dark:text-gray-400">Contributions</span>
                        <span className="text-gray-900 dark:text-white font-medium">
                          {((results.totalContributions / results.futureValue) * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 mb-4">
                        <div
                          className="bg-blue-500 h-4 rounded-full"
                          style={{ width: `${(results.totalContributions / results.futureValue) * 100}%` }}
                        />
                      </div>

                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-gray-600 dark:text-gray-400">Interest</span>
                        <span className="text-gray-900 dark:text-white font-medium">
                          {((results.totalInterest / results.futureValue) * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4">
                        <div
                          className="bg-green-500 h-4 rounded-full"
                          style={{ width: `${(results.totalInterest / results.futureValue) * 100}%` }}
                        />
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
                            ? 'bg-purple-600 text-white shadow-lg'
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                        }`}
                      >
                        Summary
                      </button>
                      <button
                        onClick={() => setActiveTab('visualization')}
                        className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
                          activeTab === 'visualization'
                            ? 'bg-purple-600 text-white shadow-lg'
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
                            ? 'bg-purple-600 text-white shadow-lg'
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
                          Investment Summary
                        </h3>
                        <div className="space-y-3 text-sm">
                          <div className="flex justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <span className="text-gray-600 dark:text-gray-400">Initial Investment</span>
                            <span className="font-semibold text-gray-900 dark:text-white">{formatCurrency(inputs.principal)}</span>
                          </div>
                          <div className="flex justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <span className="text-gray-600 dark:text-gray-400">Monthly Contribution</span>
                            <span className="font-semibold text-gray-900 dark:text-white">{formatCurrency(inputs.monthlyContribution)}</span>
                          </div>
                          <div className="flex justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <span className="text-gray-600 dark:text-gray-400">Investment Period</span>
                            <span className="font-semibold text-gray-900 dark:text-white">{inputs.years} years</span>
                          </div>
                          <div className="flex justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <span className="text-gray-600 dark:text-gray-400">Interest Rate</span>
                            <span className="font-semibold text-gray-900 dark:text-white">{inputs.annualRate}%</span>
                          </div>
                          <div className="flex justify-between p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border-2 border-purple-200 dark:border-purple-800">
                            <span className="text-gray-900 dark:text-white font-semibold">Final Value</span>
                            <span className="font-bold text-purple-600 dark:text-purple-400">{formatCurrency(results.futureValue)}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Visualization Tab */}
                    {activeTab === 'visualization' && (
                      <div className="space-y-6">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                            Growth Over Time
                          </h3>
                          <ResponsiveContainer width="100%" height={300}>
                            <AreaChart data={results.yearlyBreakdown}>
                              <defs>
                                <linearGradient id="colorContributions" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1}/>
                                </linearGradient>
                                <linearGradient id="colorInterest" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.1}/>
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" className="stroke-gray-300 dark:stroke-gray-600" />
                              <XAxis
                                dataKey="year"
                                className="text-gray-600 dark:text-gray-400"
                                label={{ value: 'Year', position: 'insideBottom', offset: -5 }}
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
                              <Area
                                type="monotone"
                                dataKey="totalContributions"
                                stackId="1"
                                stroke="#3b82f6"
                                fill="url(#colorContributions)"
                                name="Contributions"
                              />
                              <Area
                                type="monotone"
                                dataKey="totalInterest"
                                stackId="1"
                                stroke="#10b981"
                                fill="url(#colorInterest)"
                                name="Interest Earned"
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>

                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                            Total Balance Projection
                          </h3>
                          <ResponsiveContainer width="100%" height={250}>
                            <LineChart data={results.yearlyBreakdown}>
                              <CartesianGrid strokeDasharray="3 3" className="stroke-gray-300 dark:stroke-gray-600" />
                              <XAxis
                                dataKey="year"
                                className="text-gray-600 dark:text-gray-400"
                                label={{ value: 'Year', position: 'insideBottom', offset: -5 }}
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
                                stroke="#8b5cf6"
                                strokeWidth={3}
                                dot={{ fill: '#8b5cf6', r: 4 }}
                                name="Total Balance"
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
                          Year-by-Year Breakdown
                        </h3>
                        <div className="max-h-96 overflow-y-auto">
                          <table className="w-full text-sm">
                            <thead className="sticky top-0 bg-gray-100 dark:bg-gray-800">
                              <tr>
                                <th className="text-left py-2 px-2">Year</th>
                                <th className="text-right py-2 px-2">Balance</th>
                                <th className="text-right py-2 px-2">Contributions</th>
                                <th className="text-right py-2 px-2">Interest</th>
                              </tr>
                            </thead>
                            <tbody className="text-gray-600 dark:text-gray-400">
                              {results.yearlyBreakdown.map((entry) => (
                                <tr key={entry.year} className="border-b border-gray-200 dark:border-gray-700">
                                  <td className="py-2 px-2 font-medium">{entry.year}</td>
                                  <td className="text-right py-2 px-2 font-bold text-gray-900 dark:text-white">
                                    {formatCurrency(entry.balance)}
                                  </td>
                                  <td className="text-right py-2 px-2 text-blue-600 dark:text-blue-400">
                                    {formatCurrency(entry.totalContributions)}
                                  </td>
                                  <td className="text-right py-2 px-2 text-green-600 dark:text-green-400">
                                    {formatCurrency(entry.totalInterest)}
                                  </td>
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
                      💡 Maximizing Compound Interest
                    </h3>

                    <ul className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
                      <li className="flex items-start gap-2">
                        <span className="text-purple-600 dark:text-purple-400 font-bold">•</span>
                        <span>
                          <strong>Start early:</strong> Time is the most powerful factor in compound interest. Starting 10 years earlier can double your results.
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-purple-600 dark:text-purple-400 font-bold">•</span>
                        <span>
                          <strong>Consistent contributions:</strong> Regular monthly investments can significantly boost your final balance.
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-purple-600 dark:text-purple-400 font-bold">•</span>
                        <span>
                          <strong>Reinvest dividends:</strong> Always reinvest earnings to maximize compound growth.
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-purple-600 dark:text-purple-400 font-bold">•</span>
                        <span>
                          <strong>Higher frequency:</strong> More frequent compounding leads to slightly higher returns.
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-purple-600 dark:text-purple-400 font-bold">•</span>
                        <span>
                          <strong>Tax-advantaged accounts:</strong> Use IRAs and 401(k)s to avoid taxes eating into your compound growth.
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
