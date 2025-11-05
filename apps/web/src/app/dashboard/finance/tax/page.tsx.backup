'use client';

import React, { useState } from "react";
import { TaxWithholdingCalculator } from "@/components/financial/tax/TaxWithholdingCalculator";
import { TaxEstimator } from "@/components/financial/tax/TaxEstimator";
import { TaxForms } from "@/components/financial/tax/TaxForms";
import { TaxCalendar } from "@/components/financial/tax/TaxCalendar";

export default function TaxPage() {
  const [activeTab, setActiveTab] = useState('withholding');
  
  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Tax Dashboard</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Manage your tax information, estimate your tax liability, and get access to tax resources.
        </p>
      </div>
      
      <div className="bg-white dark:bg-slate-800 shadow-sm rounded-lg overflow-hidden mb-8">
        <nav className="flex border-b border-gray-200 dark:border-gray-700" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('withholding')}
            className={`${
              activeTab === 'withholding'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:border-gray-600'
            } flex-1 py-4 px-1 text-center border-b-2 font-medium text-sm sm:text-base`}
          >
            Paycheck Calculator
          </button>
          <button
            onClick={() => setActiveTab('estimator')}
            className={`${
              activeTab === 'estimator'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:border-gray-600'
            } flex-1 py-4 px-1 text-center border-b-2 font-medium text-sm sm:text-base`}
          >
            Tax Estimator
          </button>
          <button
            onClick={() => setActiveTab('forms')}
            className={`${
              activeTab === 'forms'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:border-gray-600'
            } flex-1 py-4 px-1 text-center border-b-2 font-medium text-sm sm:text-base`}
          >
            Tax Forms
          </button>
          <button
            onClick={() => setActiveTab('calendar')}
            className={`${
              activeTab === 'calendar'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:border-gray-600'
            } flex-1 py-4 px-1 text-center border-b-2 font-medium text-sm sm:text-base`}
          >
            Tax Calendar
          </button>
        </nav>
      </div>
      
      <div>
        {activeTab === 'withholding' && <TaxWithholdingCalculator />}
        {activeTab === 'estimator' && <TaxEstimator />}
        {activeTab === 'forms' && <TaxForms />}
        {activeTab === 'calendar' && <TaxCalendar />}
      </div>
      
      <div className="mt-8 bg-gray-50 dark:bg-slate-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-medium mb-4">Tax Planning Tips</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div>
            <h3 className="text-md font-medium mb-2">Maximize Retirement Contributions</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Contributing to tax-advantaged retirement accounts like 401(k)s and IRAs can lower your taxable income and help you save for the future.
            </p>
          </div>
          <div>
            <h3 className="text-md font-medium mb-2">Consider Tax-Loss Harvesting</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Offset capital gains by selling investments at a loss, which can help reduce your tax liability while rebalancing your portfolio.
            </p>
          </div>
          <div>
            <h3 className="text-md font-medium mb-2">Review Withholding Regularly</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Check your tax withholding periodically, especially after major life changes, to avoid owing a large sum or getting too large a refund.
            </p>
          </div>
          <div>
            <h3 className="text-md font-medium mb-2">Bundle Itemized Deductions</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              If you itemize, consider "bunching" deductions like charitable contributions in alternating years to exceed the standard deduction threshold.
            </p>
          </div>
          <div>
            <h3 className="text-md font-medium mb-2">Use HSA for Triple Tax Advantage</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Health Savings Accounts offer tax-deductible contributions, tax-free growth, and tax-free withdrawals for qualified medical expenses.
            </p>
          </div>
          <div>
            <h3 className="text-md font-medium mb-2">Keep Good Records</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Maintain organized records of tax-related documents and receipts throughout the year to make filing easier and ensure you claim all eligible deductions.
            </p>
          </div>
        </div>
      </div>
      
      <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-100 dark:border-yellow-800 rounded-lg">
        <h3 className="font-medium text-yellow-800 dark:text-yellow-300 mb-2">Disclaimer</h3>
        <p className="text-sm text-yellow-700 dark:text-yellow-400">
          The tax information provided is for informational purposes only and should not be considered tax or legal advice. 
          Always consult with a qualified tax professional regarding your specific circumstances.
        </p>
      </div>
    </div>
  );
}