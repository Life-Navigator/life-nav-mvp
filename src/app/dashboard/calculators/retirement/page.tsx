'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/cards/Card';
import { ArrowLeft, TrendingUp, DollarSign, Calendar, Percent, PiggyBank } from 'lucide-react';

interface RetirementInputs {
  currentAge: number;
  retirementAge: number;
  currentSavings: number;
  monthlyContribution: number;
  annualReturn: number;
  inflationRate: number;
  yearsInRetirement: number;
  desiredMonthlyIncome: number;
}

interface RetirementResults {
  totalSavingsAtRetirement: number;
  inflationAdjustedSavings: number;
  monthlyIncomeAvailable: number;
  yearsMoneyWillLast: number;
  shortfall: number;
  needsMoreSavings: boolean;
}

export default function RetirementCalculator() {
  const [inputs, setInputs] = useState<RetirementInputs>({
    currentAge: 30,
    retirementAge: 65,
    currentSavings: 50000,
    monthlyContribution: 1000,
    annualReturn: 7,
    inflationRate: 3,
    yearsInRetirement: 30,
    desiredMonthlyIncome: 5000,
  });

  const [results, setResults] = useState<RetirementResults | null>(null);

  const calculateRetirement = () => {
    const yearsToRetirement = inputs.retirementAge - inputs.currentAge;
    const monthsToRetirement = yearsToRetirement * 12;
    const monthlyRate = inputs.annualReturn / 100 / 12;

    // Future value of current savings
    const futureValueOfSavings = inputs.currentSavings * Math.pow(1 + monthlyRate, monthsToRetirement);

    // Future value of monthly contributions (annuity)
    const futureValueOfContributions =
      inputs.monthlyContribution *
      ((Math.pow(1 + monthlyRate, monthsToRetirement) - 1) / monthlyRate);

    const totalSavingsAtRetirement = futureValueOfSavings + futureValueOfContributions;

    // Adjust for inflation
    const inflationMultiplier = Math.pow(1 + inputs.inflationRate / 100, yearsToRetirement);
    const inflationAdjustedSavings = totalSavingsAtRetirement / inflationMultiplier;

    // Calculate how much monthly income this provides
    const monthlyRetirementRate = inputs.annualReturn / 100 / 12;
    const monthsInRetirement = inputs.yearsInRetirement * 12;

    // Using present value of annuity formula to find monthly payment
    const monthlyIncomeAvailable =
      (totalSavingsAtRetirement * monthlyRetirementRate) /
      (1 - Math.pow(1 + monthlyRetirementRate, -monthsInRetirement));

    // Calculate how long money will last with desired income
    let yearsMoneyWillLast = 0;
    if (inputs.desiredMonthlyIncome > 0) {
      let balance = totalSavingsAtRetirement;
      let months = 0;

      while (balance > 0 && months < 1200) { // Cap at 100 years
        balance = balance * (1 + monthlyRetirementRate) - inputs.desiredMonthlyIncome;
        months++;
      }

      yearsMoneyWillLast = months / 12;
    }

    const shortfall = Math.max(0, inputs.desiredMonthlyIncome - monthlyIncomeAvailable);
    const needsMoreSavings = shortfall > 0;

    setResults({
      totalSavingsAtRetirement,
      inflationAdjustedSavings,
      monthlyIncomeAvailable,
      yearsMoneyWillLast,
      shortfall,
      needsMoreSavings,
    });
  };

  useEffect(() => {
    calculateRetirement();
  }, [inputs]);

  const updateInput = (key: keyof RetirementInputs, value: number) => {
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

  const formatNumber = (value: number, decimals: number = 1) => {
    return value.toFixed(decimals);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/dashboard/calculators"
            className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Calculators
          </Link>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            🏖️ Retirement Calculator
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Plan your retirement savings and see if you're on track to meet your goals
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input Section */}
          <div className="space-y-6">
            {/* Age Inputs */}
            <Card>
              <div className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Calendar className="h-5 w-5 text-blue-600" />
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    Age Details
                  </h2>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Current Age: {inputs.currentAge}
                    </label>
                    <input
                      type="range"
                      min="18"
                      max="80"
                      value={inputs.currentAge}
                      onChange={(e) => updateInput('currentAge', parseInt(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Retirement Age: {inputs.retirementAge}
                    </label>
                    <input
                      type="range"
                      min={inputs.currentAge + 1}
                      max="80"
                      value={inputs.retirementAge}
                      onChange={(e) => updateInput('retirementAge', parseInt(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Years in Retirement: {inputs.yearsInRetirement}
                    </label>
                    <input
                      type="range"
                      min="10"
                      max="50"
                      value={inputs.yearsInRetirement}
                      onChange={(e) => updateInput('yearsInRetirement', parseInt(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                    />
                  </div>
                </div>
              </div>
            </Card>

            {/* Savings Inputs */}
            <Card>
              <div className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <PiggyBank className="h-5 w-5 text-green-600" />
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    Savings Details
                  </h2>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Current Savings
                    </label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        type="number"
                        value={inputs.currentSavings}
                        onChange={(e) => updateInput('currentSavings', parseFloat(e.target.value) || 0)}
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

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Desired Monthly Income in Retirement
                    </label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        type="number"
                        value={inputs.desiredMonthlyIncome}
                        onChange={(e) => updateInput('desiredMonthlyIncome', parseFloat(e.target.value) || 0)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Investment Assumptions */}
            <Card>
              <div className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Percent className="h-5 w-5 text-purple-600" />
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    Investment Assumptions
                  </h2>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Expected Annual Return: {inputs.annualReturn}%
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="15"
                      step="0.5"
                      value={inputs.annualReturn}
                      onChange={(e) => updateInput('annualReturn', parseFloat(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Historical S&P 500 average: ~10%
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Expected Inflation Rate: {inputs.inflationRate}%
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="10"
                      step="0.5"
                      value={inputs.inflationRate}
                      onChange={(e) => updateInput('inflationRate', parseFloat(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Historical US average: ~3%
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Results Section */}
          <div className="space-y-6">
            {results && (
              <>
                {/* Main Result Card */}
                <Card className="bg-gradient-to-br from-blue-500 to-indigo-600">
                  <div className="p-6 text-white">
                    <div className="flex items-center gap-2 mb-4">
                      <TrendingUp className="h-6 w-6" />
                      <h2 className="text-2xl font-bold">
                        Projected Retirement Savings
                      </h2>
                    </div>
                    <div className="text-5xl font-bold mb-2">
                      {formatCurrency(results.totalSavingsAtRetirement)}
                    </div>
                    <p className="text-blue-100 text-sm">
                      At age {inputs.retirementAge} ({inputs.retirementAge - inputs.currentAge} years from now)
                    </p>
                  </div>
                </Card>

                {/* Status Card */}
                <Card className={`${results.needsMoreSavings ? 'bg-gradient-to-br from-red-500 to-red-600' : 'bg-gradient-to-br from-green-500 to-green-600'}`}>
                  <div className="p-6 text-white">
                    <h3 className="text-xl font-bold mb-2">
                      {results.needsMoreSavings ? '⚠️ Savings Shortfall' : '✅ On Track!'}
                    </h3>
                    {results.needsMoreSavings ? (
                      <>
                        <p className="text-lg mb-2">
                          You need an additional <span className="font-bold">{formatCurrency(results.shortfall)}/month</span>
                        </p>
                        <p className="text-sm opacity-90">
                          To reach your desired retirement income of {formatCurrency(inputs.desiredMonthlyIncome)}/month
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-lg mb-2">
                          Your retirement plan looks solid!
                        </p>
                        <p className="text-sm opacity-90">
                          You're projected to have enough for your desired lifestyle
                        </p>
                      </>
                    )}
                  </div>
                </Card>

                {/* Detailed Results */}
                <Card>
                  <div className="p-6">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                      Detailed Breakdown
                    </h3>

                    <div className="space-y-4">
                      <div className="flex justify-between items-center pb-3 border-b border-gray-200 dark:border-gray-700">
                        <span className="text-gray-600 dark:text-gray-400">
                          Inflation-Adjusted Savings
                        </span>
                        <span className="text-lg font-semibold text-gray-900 dark:text-white">
                          {formatCurrency(results.inflationAdjustedSavings)}
                        </span>
                      </div>

                      <div className="flex justify-between items-center pb-3 border-b border-gray-200 dark:border-gray-700">
                        <span className="text-gray-600 dark:text-gray-400">
                          Sustainable Monthly Income
                        </span>
                        <span className="text-lg font-semibold text-gray-900 dark:text-white">
                          {formatCurrency(results.monthlyIncomeAvailable)}
                        </span>
                      </div>

                      <div className="flex justify-between items-center pb-3 border-b border-gray-200 dark:border-gray-700">
                        <span className="text-gray-600 dark:text-gray-400">
                          Years Money Will Last
                        </span>
                        <span className="text-lg font-semibold text-gray-900 dark:text-white">
                          {formatNumber(results.yearsMoneyWillLast)} years
                        </span>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-gray-600 dark:text-gray-400">
                          Total Contributions
                        </span>
                        <span className="text-lg font-semibold text-gray-900 dark:text-white">
                          {formatCurrency(inputs.currentSavings + (inputs.monthlyContribution * 12 * (inputs.retirementAge - inputs.currentAge)))}
                        </span>
                      </div>
                    </div>
                  </div>
                </Card>

                {/* Tips and Insights */}
                <Card>
                  <div className="p-6">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                      💡 Tips to Improve Your Retirement Plan
                    </h3>

                    <ul className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
                      <li className="flex items-start gap-2">
                        <span className="text-green-600 dark:text-green-400 font-bold">•</span>
                        <span>
                          <strong>Maximize employer match:</strong> If your employer offers a 401(k) match, contribute at least enough to get the full match.
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-green-600 dark:text-green-400 font-bold">•</span>
                        <span>
                          <strong>Start early:</strong> The earlier you start saving, the more time your money has to grow through compound interest.
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-green-600 dark:text-green-400 font-bold">•</span>
                        <span>
                          <strong>Increase contributions:</strong> Try to increase your contributions by 1% each year, or whenever you get a raise.
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-green-600 dark:text-green-400 font-bold">•</span>
                        <span>
                          <strong>Diversify investments:</strong> A well-diversified portfolio can help manage risk while pursuing growth.
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-green-600 dark:text-green-400 font-bold">•</span>
                        <span>
                          <strong>Consider inflation:</strong> Plan for 3-4% annual inflation to maintain your purchasing power in retirement.
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
