'use client';

import React, { useState } from 'react';
import { useTaxWithholding } from '@/hooks/useTax';
import { FilingStatus, PayFrequency, W4FormData, IncomeDetails, WithholdingResult } from '@/types/tax';

export function TaxWithholdingCalculator() {
  // Form state
  const [w4Data, setW4Data] = useState<W4FormData>({
    filingStatus: 'single',
    multipleJobs: false,
    claimDependents: 0,
    otherIncome: 0,
    deductions: 0,
    extraWithholding: 0
  });
  
  const [incomeDetails, setIncomeDetails] = useState<IncomeDetails>({
    salary: 75000,
    payFrequency: 'biweekly',
    preTaxDeductions: 250
  });
  
  // Use custom hook for calculations
  const { result, isCalculating, error, calculateWithholding } = useTaxWithholding();
  
  // Handle form submission
  const handleCalculate = (e: React.FormEvent) => {
    e.preventDefault();
    calculateWithholding(w4Data, incomeDetails);
  };
  
  // Handle W-4 form changes
  const handleW4Change = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const newValue = type === 'checkbox' 
      ? (e.target as HTMLInputElement).checked
      : type === 'number' ? parseFloat(value) : value;
    
    setW4Data(prev => ({
      ...prev,
      [name]: newValue
    }));
  };
  
  // Handle income details changes
  const handleIncomeChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const newValue = type === 'number' ? parseFloat(value) : value;
    
    setIncomeDetails(prev => ({
      ...prev,
      [name]: newValue
    }));
  };
  
  // Format currency display
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };
  
  // Format percentage display
  const formatPercent = (value: number) => {
    return `${value.toFixed(2)}%`;
  };
  
  return (
    <div className="bg-white rounded-lg shadow dark:bg-slate-800 p-6">
      <h2 className="text-xl font-semibold mb-6">Paycheck Tax Calculator</h2>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <form onSubmit={handleCalculate}>
            <div className="mb-6">
              <h3 className="text-lg font-medium mb-4">Income Details</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Salary Amount
                  </label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-gray-500 sm:text-sm">$</span>
                    </div>
                    <input
                      type="number"
                      name="salary"
                      value={incomeDetails.salary}
                      onChange={handleIncomeChange}
                      className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-7 pr-12 sm:text-sm border-gray-300 dark:border-gray-700 dark:bg-gray-800 rounded-md"
                      placeholder="0.00"
                      aria-describedby="salary-currency"
                      min={0}
                      step={1000}
                      required
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Pay Frequency
                  </label>
                  <select
                    name="payFrequency"
                    value={incomeDetails.payFrequency}
                    onChange={handleIncomeChange}
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-700 dark:bg-gray-800 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                    required
                  >
                    <option value="weekly">Weekly</option>
                    <option value="biweekly">Biweekly (Every 2 weeks)</option>
                    <option value="semimonthly">Twice a month</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Pre-tax Deductions (per paycheck)
                  </label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-gray-500 sm:text-sm">$</span>
                    </div>
                    <input
                      type="number"
                      name="preTaxDeductions"
                      value={incomeDetails.preTaxDeductions}
                      onChange={handleIncomeChange}
                      className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-7 pr-12 sm:text-sm border-gray-300 dark:border-gray-700 dark:bg-gray-800 rounded-md"
                      placeholder="0.00"
                      min={0}
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Include 401(k), health insurance, HSA, etc.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="mb-6">
              <h3 className="text-lg font-medium mb-4">W-4 Information</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Filing Status
                  </label>
                  <select
                    name="filingStatus"
                    value={w4Data.filingStatus}
                    onChange={handleW4Change}
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-700 dark:bg-gray-800 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                    required
                  >
                    <option value="single">Single</option>
                    <option value="married_jointly">Married Filing Jointly</option>
                    <option value="married_separately">Married Filing Separately</option>
                    <option value="head_of_household">Head of Household</option>
                  </select>
                </div>
                
                <div className="flex items-start">
                  <div className="flex items-center h-5">
                    <input
                      id="multipleJobs"
                      name="multipleJobs"
                      type="checkbox"
                      checked={w4Data.multipleJobs}
                      onChange={handleW4Change}
                      className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded"
                    />
                  </div>
                  <div className="ml-3 text-sm">
                    <label htmlFor="multipleJobs" className="font-medium text-gray-700 dark:text-gray-300">
                      Multiple Jobs or Spouse Works
                    </label>
                    <p className="text-gray-500 dark:text-gray-400">
                      Check if you have more than one job or a spouse who works.
                    </p>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Claim Dependents
                  </label>
                  <input
                    type="number"
                    name="claimDependents"
                    value={w4Data.claimDependents}
                    onChange={handleW4Change}
                    className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 dark:border-gray-700 dark:bg-gray-800 rounded-md"
                    min={0}
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Enter the total amount you're claiming for dependents.
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Other Income (annual)
                  </label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-gray-500 sm:text-sm">$</span>
                    </div>
                    <input
                      type="number"
                      name="otherIncome"
                      value={w4Data.otherIncome}
                      onChange={handleW4Change}
                      className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-7 pr-12 sm:text-sm border-gray-300 dark:border-gray-700 dark:bg-gray-800 rounded-md"
                      placeholder="0.00"
                      min={0}
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Other income not subject to withholding (interest, dividends, etc.)
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Deductions (annual)
                  </label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-gray-500 sm:text-sm">$</span>
                    </div>
                    <input
                      type="number"
                      name="deductions"
                      value={w4Data.deductions}
                      onChange={handleW4Change}
                      className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-7 pr-12 sm:text-sm border-gray-300 dark:border-gray-700 dark:bg-gray-800 rounded-md"
                      placeholder="0.00"
                      min={0}
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Deductions other than the standard deduction
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Extra Withholding (per paycheck)
                  </label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-gray-500 sm:text-sm">$</span>
                    </div>
                    <input
                      type="number"
                      name="extraWithholding"
                      value={w4Data.extraWithholding}
                      onChange={handleW4Change}
                      className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-7 pr-12 sm:text-sm border-gray-300 dark:border-gray-700 dark:bg-gray-800 rounded-md"
                      placeholder="0.00"
                      min={0}
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Any extra amount you want withheld from each paycheck
                  </p>
                </div>
              </div>
            </div>
            
            <div className="mt-6">
              <button
                type="submit"
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                disabled={isCalculating}
              >
                {isCalculating ? 'Calculating...' : 'Calculate Take-Home Pay'}
              </button>
            </div>
          </form>
        </div>
        
        <div>
          {error && (
            <div className="rounded-md bg-red-50 dark:bg-red-900/30 p-4 mb-6">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                    Error calculating withholding
                  </h3>
                  <div className="mt-2 text-sm text-red-700 dark:text-red-300">
                    <p>{error.message}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {result && (
            <div>
              <h3 className="text-lg font-medium mb-4">Your Results</h3>
              
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg mb-6">
                <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">Pay Summary (Per Paycheck)</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-blue-700 dark:text-blue-300">Gross Pay:</p>
                    <p className="text-xl font-semibold text-blue-900 dark:text-white">{formatCurrency(result.payPeriodGrossIncome)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-blue-700 dark:text-blue-300">Net Pay:</p>
                    <p className="text-xl font-semibold text-blue-900 dark:text-white">{formatCurrency(result.netIncome)}</p>
                  </div>
                </div>
              </div>
              
              <div className="mb-6">
                <h4 className="font-medium mb-3">Paycheck Breakdown</h4>
                <div className="bg-white dark:bg-gray-900 overflow-hidden shadow rounded-lg divide-y divide-gray-200 dark:divide-gray-700">
                  <div className="px-4 py-3 flex justify-between">
                    <span className="text-sm text-gray-500 dark:text-gray-400">Gross Pay</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{formatCurrency(result.payPeriodGrossIncome)}</span>
                  </div>
                  <div className="px-4 py-3 flex justify-between">
                    <span className="text-sm text-gray-500 dark:text-gray-400">Federal Income Tax</span>
                    <span className="text-sm font-medium text-red-600 dark:text-red-400">-{formatCurrency(result.federalWithholding)}</span>
                  </div>
                  <div className="px-4 py-3 flex justify-between">
                    <span className="text-sm text-gray-500 dark:text-gray-400">Social Security Tax</span>
                    <span className="text-sm font-medium text-red-600 dark:text-red-400">-{formatCurrency(result.socialSecurityTax)}</span>
                  </div>
                  <div className="px-4 py-3 flex justify-between">
                    <span className="text-sm text-gray-500 dark:text-gray-400">Medicare Tax</span>
                    <span className="text-sm font-medium text-red-600 dark:text-red-400">-{formatCurrency(result.medicareTax)}</span>
                  </div>
                  <div className="px-4 py-3 flex justify-between">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">Net Pay</span>
                    <span className="text-sm font-medium text-green-600 dark:text-green-400">{formatCurrency(result.netIncome)}</span>
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="font-medium mb-3">Annual Projection</h4>
                <div className="bg-white dark:bg-gray-900 overflow-hidden shadow rounded-lg divide-y divide-gray-200 dark:divide-gray-700">
                  <div className="px-4 py-3 flex justify-between">
                    <span className="text-sm text-gray-500 dark:text-gray-400">Annual Gross Income</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{formatCurrency(result.annualProjection.annualGrossIncome)}</span>
                  </div>
                  <div className="px-4 py-3 flex justify-between">
                    <span className="text-sm text-gray-500 dark:text-gray-400">Annual Taxes</span>
                    <span className="text-sm font-medium text-red-600 dark:text-red-400">-{formatCurrency(result.annualProjection.annualTaxes)}</span>
                  </div>
                  <div className="px-4 py-3 flex justify-between">
                    <span className="text-sm text-gray-500 dark:text-gray-400">Effective Tax Rate</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{formatPercent(result.annualProjection.effectiveTaxRate)}</span>
                  </div>
                  <div className="px-4 py-3 flex justify-between">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">Annual Net Income</span>
                    <span className="text-sm font-medium text-green-600 dark:text-green-400">{formatCurrency(result.annualProjection.annualNetIncome)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {!result && !error && !isCalculating && (
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6 flex flex-col items-center justify-center h-full">
              <svg className="w-16 h-16 text-gray-400 dark:text-gray-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Calculate Your Take-Home Pay</h3>
              <p className="text-gray-500 dark:text-gray-400 text-center">
                Enter your income details and W-4 information, then click 'Calculate' to see your estimated take-home pay.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}