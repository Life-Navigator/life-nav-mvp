'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/cards/Card';
import { ArrowLeft, Home, DollarSign, Calendar, Percent, TrendingDown } from 'lucide-react';

interface MortgageInputs {
  homePrice: number;
  downPayment: number;
  loanTerm: number;
  interestRate: number;
  propertyTax: number;
  homeInsurance: number;
  pmi: number;
  hoaFees: number;
}

interface MortgageResults {
  loanAmount: number;
  monthlyPrincipalAndInterest: number;
  monthlyPropertyTax: number;
  monthlyHomeInsurance: number;
  monthlyPMI: number;
  monthlyHOA: number;
  totalMonthlyPayment: number;
  totalPayments: number;
  totalInterest: number;
  totalCost: number;
  downPaymentPercent: number;
}

export default function MortgageCalculator() {
  const [inputs, setInputs] = useState<MortgageInputs>({
    homePrice: 350000,
    downPayment: 70000,
    loanTerm: 30,
    interestRate: 6.5,
    propertyTax: 3000,
    homeInsurance: 1200,
    pmi: 0,
    hoaFees: 0,
  });

  const [results, setResults] = useState<MortgageResults | null>(null);

  const calculateMortgage = () => {
    const loanAmount = inputs.homePrice - inputs.downPayment;
    const monthlyRate = inputs.interestRate / 100 / 12;
    const numberOfPayments = inputs.loanTerm * 12;

    // Monthly principal and interest payment using formula: M = P[r(1+r)^n]/[(1+r)^n-1]
    const monthlyPrincipalAndInterest =
      loanAmount *
      (monthlyRate * Math.pow(1 + monthlyRate, numberOfPayments)) /
      (Math.pow(1 + monthlyRate, numberOfPayments) - 1);

    const monthlyPropertyTax = inputs.propertyTax / 12;
    const monthlyHomeInsurance = inputs.homeInsurance / 12;
    const monthlyPMI = inputs.pmi / 12;
    const monthlyHOA = inputs.hoaFees;

    const totalMonthlyPayment =
      monthlyPrincipalAndInterest +
      monthlyPropertyTax +
      monthlyHomeInsurance +
      monthlyPMI +
      monthlyHOA;

    const totalPayments = monthlyPrincipalAndInterest * numberOfPayments;
    const totalInterest = totalPayments - loanAmount;
    const totalCost = inputs.homePrice + totalInterest + (inputs.propertyTax * inputs.loanTerm) +
                     (inputs.homeInsurance * inputs.loanTerm) + (inputs.pmi * inputs.loanTerm) +
                     (inputs.hoaFees * 12 * inputs.loanTerm);
    const downPaymentPercent = (inputs.downPayment / inputs.homePrice) * 100;

    setResults({
      loanAmount,
      monthlyPrincipalAndInterest,
      monthlyPropertyTax,
      monthlyHomeInsurance,
      monthlyPMI,
      monthlyHOA,
      totalMonthlyPayment,
      totalPayments,
      totalInterest,
      totalCost,
      downPaymentPercent,
    });
  };

  useEffect(() => {
    calculateMortgage();
  }, [inputs]);

  const updateInput = (key: keyof MortgageInputs, value: number) => {
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
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 dark:from-gray-900 dark:to-gray-800 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/dashboard/calculators"
            className="inline-flex items-center gap-2 text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Calculators
          </Link>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            🏠 Mortgage Calculator
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Calculate your monthly mortgage payments and see the total cost breakdown
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input Section */}
          <div className="space-y-6">
            {/* Home Price and Down Payment */}
            <Card>
              <div className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Home className="h-5 w-5 text-green-600" />
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    Home Details
                  </h2>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Home Price
                    </label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        type="number"
                        value={inputs.homePrice}
                        onChange={(e) => updateInput('homePrice', parseFloat(e.target.value) || 0)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Down Payment: {formatCurrency(inputs.downPayment)}
                      {results && <span className="text-green-600 dark:text-green-400"> ({formatNumber(results.downPaymentPercent)}%)</span>}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max={inputs.homePrice}
                      step="5000"
                      value={inputs.downPayment}
                      onChange={(e) => updateInput('downPayment', parseInt(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                    />
                    <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                      <span>$0</span>
                      <span>{formatCurrency(inputs.homePrice)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Loan Terms */}
            <Card>
              <div className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Calendar className="h-5 w-5 text-blue-600" />
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    Loan Terms
                  </h2>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Loan Term
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[15, 20, 30].map((term) => (
                        <button
                          key={term}
                          onClick={() => updateInput('loanTerm', term)}
                          className={`py-2 px-4 rounded-lg font-medium transition-all ${
                            inputs.loanTerm === term
                              ? 'bg-blue-600 text-white shadow-lg'
                              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                          }`}
                        >
                          {term} years
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Interest Rate: {formatNumber(inputs.interestRate, 2)}%
                    </label>
                    <input
                      type="range"
                      min="2"
                      max="12"
                      step="0.125"
                      value={inputs.interestRate}
                      onChange={(e) => updateInput('interestRate', parseFloat(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                    />
                    <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                      <span>2%</span>
                      <span>12%</span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Additional Costs */}
            <Card>
              <div className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <DollarSign className="h-5 w-5 text-purple-600" />
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    Additional Costs (Annual)
                  </h2>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Property Tax (Annual)
                    </label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        type="number"
                        value={inputs.propertyTax}
                        onChange={(e) => updateInput('propertyTax', parseFloat(e.target.value) || 0)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Home Insurance (Annual)
                    </label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        type="number"
                        value={inputs.homeInsurance}
                        onChange={(e) => updateInput('homeInsurance', parseFloat(e.target.value) || 0)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      PMI (Annual, if applicable)
                    </label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        type="number"
                        value={inputs.pmi}
                        onChange={(e) => updateInput('pmi', parseFloat(e.target.value) || 0)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      />
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Usually required if down payment is less than 20%
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      HOA Fees (Monthly)
                    </label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        type="number"
                        value={inputs.hoaFees}
                        onChange={(e) => updateInput('hoaFees', parseFloat(e.target.value) || 0)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      />
                    </div>
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
                <Card className="bg-gradient-to-br from-green-500 to-emerald-600">
                  <div className="p-6 text-white">
                    <div className="flex items-center gap-2 mb-4">
                      <Home className="h-6 w-6" />
                      <h2 className="text-2xl font-bold">
                        Monthly Payment
                      </h2>
                    </div>
                    <div className="text-5xl font-bold mb-2">
                      {formatCurrency(results.totalMonthlyPayment)}
                    </div>
                    <p className="text-green-100 text-sm">
                      Total monthly housing cost
                    </p>
                  </div>
                </Card>

                {/* Payment Breakdown */}
                <Card>
                  <div className="p-6">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                      Monthly Payment Breakdown
                    </h3>

                    <div className="space-y-3">
                      <div className="flex justify-between items-center pb-2 border-b border-gray-200 dark:border-gray-700">
                        <span className="text-gray-600 dark:text-gray-400">
                          Principal & Interest
                        </span>
                        <span className="text-lg font-semibold text-gray-900 dark:text-white">
                          {formatCurrency(results.monthlyPrincipalAndInterest)}
                        </span>
                      </div>

                      <div className="flex justify-between items-center pb-2 border-b border-gray-200 dark:border-gray-700">
                        <span className="text-gray-600 dark:text-gray-400">
                          Property Tax
                        </span>
                        <span className="text-lg font-semibold text-gray-900 dark:text-white">
                          {formatCurrency(results.monthlyPropertyTax)}
                        </span>
                      </div>

                      <div className="flex justify-between items-center pb-2 border-b border-gray-200 dark:border-gray-700">
                        <span className="text-gray-600 dark:text-gray-400">
                          Home Insurance
                        </span>
                        <span className="text-lg font-semibold text-gray-900 dark:text-white">
                          {formatCurrency(results.monthlyHomeInsurance)}
                        </span>
                      </div>

                      {results.monthlyPMI > 0 && (
                        <div className="flex justify-between items-center pb-2 border-b border-gray-200 dark:border-gray-700">
                          <span className="text-gray-600 dark:text-gray-400">
                            PMI
                          </span>
                          <span className="text-lg font-semibold text-gray-900 dark:text-white">
                            {formatCurrency(results.monthlyPMI)}
                          </span>
                        </div>
                      )}

                      {results.monthlyHOA > 0 && (
                        <div className="flex justify-between items-center pb-2 border-b border-gray-200 dark:border-gray-700">
                          <span className="text-gray-600 dark:text-gray-400">
                            HOA Fees
                          </span>
                          <span className="text-lg font-semibold text-gray-900 dark:text-white">
                            {formatCurrency(results.monthlyHOA)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>

                {/* Loan Summary */}
                <Card>
                  <div className="p-6">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                      Loan Summary
                    </h3>

                    <div className="space-y-4">
                      <div className="flex justify-between items-center pb-3 border-b border-gray-200 dark:border-gray-700">
                        <span className="text-gray-600 dark:text-gray-400">
                          Loan Amount
                        </span>
                        <span className="text-lg font-semibold text-gray-900 dark:text-white">
                          {formatCurrency(results.loanAmount)}
                        </span>
                      </div>

                      <div className="flex justify-between items-center pb-3 border-b border-gray-200 dark:border-gray-700">
                        <span className="text-gray-600 dark:text-gray-400">
                          Down Payment
                        </span>
                        <span className="text-lg font-semibold text-gray-900 dark:text-white">
                          {formatCurrency(inputs.downPayment)} ({formatNumber(results.downPaymentPercent)}%)
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

                      <div className="flex justify-between items-center pb-3 border-b border-gray-200 dark:border-gray-700">
                        <span className="text-gray-600 dark:text-gray-400">
                          Total Principal Paid
                        </span>
                        <span className="text-lg font-semibold text-gray-900 dark:text-white">
                          {formatCurrency(results.loanAmount)}
                        </span>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-gray-600 dark:text-gray-400 font-semibold">
                          Total Cost (30 years)
                        </span>
                        <span className="text-xl font-bold text-gray-900 dark:text-white">
                          {formatCurrency(results.totalCost)}
                        </span>
                      </div>
                    </div>
                  </div>
                </Card>

                {/* Tips */}
                <Card>
                  <div className="p-6">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                      💡 Tips to Save on Your Mortgage
                    </h3>

                    <ul className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
                      <li className="flex items-start gap-2">
                        <span className="text-green-600 dark:text-green-400 font-bold">•</span>
                        <span>
                          <strong>20% down payment:</strong> Putting down 20% or more can help you avoid PMI and get better interest rates.
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-green-600 dark:text-green-400 font-bold">•</span>
                        <span>
                          <strong>Shorter term:</strong> A 15-year mortgage typically has lower rates and saves thousands in interest.
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-green-600 dark:text-green-400 font-bold">•</span>
                        <span>
                          <strong>Extra payments:</strong> Making extra principal payments can significantly reduce total interest paid.
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-green-600 dark:text-green-400 font-bold">•</span>
                        <span>
                          <strong>Shop around:</strong> Compare rates from multiple lenders - even 0.25% difference can save thousands.
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-green-600 dark:text-green-400 font-bold">•</span>
                        <span>
                          <strong>Improve credit score:</strong> A higher credit score can qualify you for better interest rates.
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
