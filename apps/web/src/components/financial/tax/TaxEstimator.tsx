'use client';

import React, { useState } from 'react';
import { useTaxEstimate } from '@/hooks/useTax';
import { 
  FilingStatus, 
  PayFrequency, 
  IncomeDetails, 
  DeductionDetails, 
  CreditDetails,
  TaxEstimate
} from '@/types/tax';

export function TaxEstimator() {
  const currentYear = new Date().getFullYear();
  
  // Form state
  const [filingStatus, setFilingStatus] = useState<FilingStatus>('single');
  const [taxYear, setTaxYear] = useState<number>(currentYear);
  
  const [incomeDetails, setIncomeDetails] = useState<IncomeDetails>({
    salary: 75000,
    payFrequency: 'annually',
    selfEmploymentIncome: 0,
    investmentIncome: 0,
    otherIncome: 0,
    preTaxDeductions: 5000,
    retirement401k: 5000,
    traditionalIRA: 0,
    roth401k: 0,
    rothIRA: 0,
    hsa: 0,
    fsa: 0
  });
  
  const [deductionDetails, setDeductionDetails] = useState<DeductionDetails>({
    useStandardDeduction: true,
    mortgageInterest: 0,
    propertyTaxes: 0,
    charitableDonations: 0,
    medicalExpenses: 0,
    studentLoanInterest: 0,
    otherDeductions: 0
  });
  
  const [creditDetails, setCreditDetails] = useState<CreditDetails>({
    childTaxCredit: 0,
    childAndDependentCare: 0,
    educationCredits: 0,
    energyCredits: 0,
    otherCredits: 0
  });
  
  const [withholdingToDate, setWithholdingToDate] = useState<number>(0);
  
  // Use custom hook for calculations
  const { estimate, isCalculating, error, calculateEstimate } = useTaxEstimate();
  
  // Handle form submission
  const handleCalculate = (e: React.FormEvent) => {
    e.preventDefault();
    calculateEstimate({
      income: incomeDetails,
      deductions: deductionDetails,
      credits: creditDetails,
      filingStatus,
      taxYear,
      withholdingToDate
    });
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
  
  // Handle changes to income details
  const handleIncomeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setIncomeDetails(prev => ({
      ...prev,
      [name]: parseFloat(value) || 0
    }));
  };
  
  // Handle changes to deduction details
  const handleDeductionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    
    if (name === 'useStandardDeduction') {
      setDeductionDetails(prev => ({
        ...prev,
        useStandardDeduction: checked
      }));
    } else {
      setDeductionDetails(prev => ({
        ...prev,
        [name]: parseFloat(value) || 0
      }));
    }
  };
  
  // Handle changes to credit details
  const handleCreditChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCreditDetails(prev => ({
      ...prev,
      [name]: parseFloat(value) || 0
    }));
  };
  
  return (
    <div className="bg-white rounded-lg shadow dark:bg-slate-800 p-6">
      <h2 className="text-xl font-semibold mb-6">Annual Tax Estimator</h2>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <form onSubmit={handleCalculate}>
            <div className="mb-6">
              <h3 className="text-lg font-medium mb-4">Filing Information</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Tax Year
                  </label>
                  <select
                    value={taxYear}
                    onChange={(e) => setTaxYear(parseInt(e.target.value))}
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-700 dark:bg-gray-800 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                  >
                    <option value={currentYear}>{currentYear}</option>
                    <option value={currentYear - 1}>{currentYear - 1}</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Filing Status
                  </label>
                  <select
                    value={filingStatus}
                    onChange={(e) => setFilingStatus(e.target.value as FilingStatus)}
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-700 dark:bg-gray-800 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                  >
                    <option value="single">Single</option>
                    <option value="married_jointly">Married Filing Jointly</option>
                    <option value="married_separately">Married Filing Separately</option>
                    <option value="head_of_household">Head of Household</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Federal Tax Withholding to Date
                  </label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-gray-500 sm:text-sm">$</span>
                    </div>
                    <input
                      type="number"
                      value={withholdingToDate}
                      onChange={(e) => setWithholdingToDate(parseFloat(e.target.value) || 0)}
                      className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-7 pr-12 sm:text-sm border-gray-300 dark:border-gray-700 dark:bg-gray-800 rounded-md"
                      placeholder="0.00"
                      min={0}
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Total federal income tax already withheld from your paychecks this year
                  </p>
                </div>
              </div>
            </div>
            
            <div className="mb-6">
              <h3 className="text-lg font-medium mb-4">Income</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Annual Salary
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
                      min={0}
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Self-Employment Income
                  </label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-gray-500 sm:text-sm">$</span>
                    </div>
                    <input
                      type="number"
                      name="selfEmploymentIncome"
                      value={incomeDetails.selfEmploymentIncome}
                      onChange={handleIncomeChange}
                      className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-7 pr-12 sm:text-sm border-gray-300 dark:border-gray-700 dark:bg-gray-800 rounded-md"
                      placeholder="0.00"
                      min={0}
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Investment Income
                  </label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-gray-500 sm:text-sm">$</span>
                    </div>
                    <input
                      type="number"
                      name="investmentIncome"
                      value={incomeDetails.investmentIncome}
                      onChange={handleIncomeChange}
                      className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-7 pr-12 sm:text-sm border-gray-300 dark:border-gray-700 dark:bg-gray-800 rounded-md"
                      placeholder="0.00"
                      min={0}
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Dividends, interest, capital gains, etc.
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Other Income
                  </label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-gray-500 sm:text-sm">$</span>
                    </div>
                    <input
                      type="number"
                      name="otherIncome"
                      value={incomeDetails.otherIncome}
                      onChange={handleIncomeChange}
                      className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-7 pr-12 sm:text-sm border-gray-300 dark:border-gray-700 dark:bg-gray-800 rounded-md"
                      placeholder="0.00"
                      min={0}
                    />
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mb-6">
              <h3 className="text-lg font-medium mb-4">Adjustments & Deductions</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    401(k) Contributions
                  </label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-gray-500 sm:text-sm">$</span>
                    </div>
                    <input
                      type="number"
                      name="retirement401k"
                      value={incomeDetails.retirement401k}
                      onChange={handleIncomeChange}
                      className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-7 pr-12 sm:text-sm border-gray-300 dark:border-gray-700 dark:bg-gray-800 rounded-md"
                      placeholder="0.00"
                      min={0}
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Traditional IRA Contributions
                  </label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-gray-500 sm:text-sm">$</span>
                    </div>
                    <input
                      type="number"
                      name="traditionalIRA"
                      value={incomeDetails.traditionalIRA}
                      onChange={handleIncomeChange}
                      className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-7 pr-12 sm:text-sm border-gray-300 dark:border-gray-700 dark:bg-gray-800 rounded-md"
                      placeholder="0.00"
                      min={0}
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    HSA Contributions
                  </label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-gray-500 sm:text-sm">$</span>
                    </div>
                    <input
                      type="number"
                      name="hsa"
                      value={incomeDetails.hsa}
                      onChange={handleIncomeChange}
                      className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-7 pr-12 sm:text-sm border-gray-300 dark:border-gray-700 dark:bg-gray-800 rounded-md"
                      placeholder="0.00"
                      min={0}
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Other Pre-tax Deductions
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
                    Health insurance premiums, FSA contributions, etc.
                  </p>
                </div>
                
                <div className="flex items-start">
                  <div className="flex items-center h-5">
                    <input
                      id="useStandardDeduction"
                      name="useStandardDeduction"
                      type="checkbox"
                      checked={deductionDetails.useStandardDeduction}
                      onChange={handleDeductionChange}
                      className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded"
                    />
                  </div>
                  <div className="ml-3 text-sm">
                    <label htmlFor="useStandardDeduction" className="font-medium text-gray-700 dark:text-gray-300">
                      Use Standard Deduction
                    </label>
                    <p className="text-gray-500 dark:text-gray-400">
                      Unchecking will allow you to enter itemized deductions.
                    </p>
                  </div>
                </div>
                
                {!deductionDetails.useStandardDeduction && (
                  <div className="pl-4 border-l-2 border-blue-200 dark:border-blue-800 space-y-4 mt-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Mortgage Interest
                      </label>
                      <div className="mt-1 relative rounded-md shadow-sm">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <span className="text-gray-500 sm:text-sm">$</span>
                        </div>
                        <input
                          type="number"
                          name="mortgageInterest"
                          value={deductionDetails.mortgageInterest}
                          onChange={handleDeductionChange}
                          className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-7 pr-12 sm:text-sm border-gray-300 dark:border-gray-700 dark:bg-gray-800 rounded-md"
                          placeholder="0.00"
                          min={0}
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Property Taxes
                      </label>
                      <div className="mt-1 relative rounded-md shadow-sm">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <span className="text-gray-500 sm:text-sm">$</span>
                        </div>
                        <input
                          type="number"
                          name="propertyTaxes"
                          value={deductionDetails.propertyTaxes}
                          onChange={handleDeductionChange}
                          className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-7 pr-12 sm:text-sm border-gray-300 dark:border-gray-700 dark:bg-gray-800 rounded-md"
                          placeholder="0.00"
                          min={0}
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Charitable Donations
                      </label>
                      <div className="mt-1 relative rounded-md shadow-sm">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <span className="text-gray-500 sm:text-sm">$</span>
                        </div>
                        <input
                          type="number"
                          name="charitableDonations"
                          value={deductionDetails.charitableDonations}
                          onChange={handleDeductionChange}
                          className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-7 pr-12 sm:text-sm border-gray-300 dark:border-gray-700 dark:bg-gray-800 rounded-md"
                          placeholder="0.00"
                          min={0}
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Medical Expenses
                      </label>
                      <div className="mt-1 relative rounded-md shadow-sm">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <span className="text-gray-500 sm:text-sm">$</span>
                        </div>
                        <input
                          type="number"
                          name="medicalExpenses"
                          value={deductionDetails.medicalExpenses}
                          onChange={handleDeductionChange}
                          className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-7 pr-12 sm:text-sm border-gray-300 dark:border-gray-700 dark:bg-gray-800 rounded-md"
                          placeholder="0.00"
                          min={0}
                        />
                      </div>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Only expenses exceeding 7.5% of AGI are deductible
                      </p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Student Loan Interest
                      </label>
                      <div className="mt-1 relative rounded-md shadow-sm">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <span className="text-gray-500 sm:text-sm">$</span>
                        </div>
                        <input
                          type="number"
                          name="studentLoanInterest"
                          value={deductionDetails.studentLoanInterest}
                          onChange={handleDeductionChange}
                          className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-7 pr-12 sm:text-sm border-gray-300 dark:border-gray-700 dark:bg-gray-800 rounded-md"
                          placeholder="0.00"
                          min={0}
                          max={2500}
                        />
                      </div>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Maximum $2,500 deduction
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div className="mb-6">
              <h3 className="text-lg font-medium mb-4">Tax Credits</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Child Tax Credit
                  </label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-gray-500 sm:text-sm">$</span>
                    </div>
                    <input
                      type="number"
                      name="childTaxCredit"
                      value={creditDetails.childTaxCredit}
                      onChange={handleCreditChange}
                      className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-7 pr-12 sm:text-sm border-gray-300 dark:border-gray-700 dark:bg-gray-800 rounded-md"
                      placeholder="0.00"
                      min={0}
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Child and Dependent Care Credit
                  </label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-gray-500 sm:text-sm">$</span>
                    </div>
                    <input
                      type="number"
                      name="childAndDependentCare"
                      value={creditDetails.childAndDependentCare}
                      onChange={handleCreditChange}
                      className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-7 pr-12 sm:text-sm border-gray-300 dark:border-gray-700 dark:bg-gray-800 rounded-md"
                      placeholder="0.00"
                      min={0}
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Education Credits
                  </label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-gray-500 sm:text-sm">$</span>
                    </div>
                    <input
                      type="number"
                      name="educationCredits"
                      value={creditDetails.educationCredits}
                      onChange={handleCreditChange}
                      className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-7 pr-12 sm:text-sm border-gray-300 dark:border-gray-700 dark:bg-gray-800 rounded-md"
                      placeholder="0.00"
                      min={0}
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    American Opportunity or Lifetime Learning Credit
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Other Credits
                  </label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-gray-500 sm:text-sm">$</span>
                    </div>
                    <input
                      type="number"
                      name="otherCredits"
                      value={creditDetails.otherCredits}
                      onChange={handleCreditChange}
                      className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-7 pr-12 sm:text-sm border-gray-300 dark:border-gray-700 dark:bg-gray-800 rounded-md"
                      placeholder="0.00"
                      min={0}
                    />
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-6">
              <button
                type="submit"
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                disabled={isCalculating}
              >
                {isCalculating ? 'Calculating...' : 'Calculate Tax Estimate'}
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
                    Error calculating tax estimate
                  </h3>
                  <div className="mt-2 text-sm text-red-700 dark:text-red-300">
                    <p>{error.message}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {estimate && (
            <div>
              <h3 className="text-lg font-medium mb-6">Your {taxYear} Tax Estimate</h3>
              
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg mb-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-blue-700 dark:text-blue-300">Total Tax:</p>
                    <p className="text-xl font-semibold text-blue-900 dark:text-white">{formatCurrency(estimate.totalTaxLiability)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-blue-700 dark:text-blue-300">Refund/Balance Due:</p>
                    <p className={`text-xl font-semibold ${estimate.estimatedRefundOrOwed >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                      {estimate.estimatedRefundOrOwed >= 0 
                        ? `${formatCurrency(estimate.estimatedRefundOrOwed)} Refund` 
                        : `${formatCurrency(Math.abs(estimate.estimatedRefundOrOwed))} Owed`
                      }
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="mb-6">
                <h4 className="font-medium mb-3">Income & Deductions</h4>
                <div className="bg-white dark:bg-gray-900 overflow-hidden shadow rounded-lg divide-y divide-gray-200 dark:divide-gray-700">
                  <div className="px-4 py-3 flex justify-between">
                    <span className="text-sm text-gray-500 dark:text-gray-400">Total Income</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{formatCurrency(estimate.totalIncome)}</span>
                  </div>
                  <div className="px-4 py-3 flex justify-between">
                    <span className="text-sm text-gray-500 dark:text-gray-400">Adjustments to Income</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">-{formatCurrency(estimate.totalIncome - estimate.adjustedGrossIncome)}</span>
                  </div>
                  <div className="px-4 py-3 flex justify-between">
                    <span className="text-sm text-gray-500 dark:text-gray-400">Adjusted Gross Income (AGI)</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{formatCurrency(estimate.adjustedGrossIncome)}</span>
                  </div>
                  <div className="px-4 py-3 flex justify-between">
                    <span className="text-sm text-gray-500 dark:text-gray-400">Standard/Itemized Deductions</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">-{formatCurrency(estimate.totalDeductions)}</span>
                  </div>
                  <div className="px-4 py-3 flex justify-between">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">Taxable Income</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{formatCurrency(estimate.taxableIncome)}</span>
                  </div>
                </div>
              </div>
              
              <div className="mb-6">
                <h4 className="font-medium mb-3">Tax Calculation</h4>
                <div className="bg-white dark:bg-gray-900 overflow-hidden shadow rounded-lg divide-y divide-gray-200 dark:divide-gray-700">
                  <div className="px-4 py-3 flex justify-between">
                    <span className="text-sm text-gray-500 dark:text-gray-400">Federal Income Tax</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{formatCurrency(estimate.incomeTax)}</span>
                  </div>
                  {estimate.selfEmploymentTax > 0 && (
                    <div className="px-4 py-3 flex justify-between">
                      <span className="text-sm text-gray-500 dark:text-gray-400">Self-Employment Tax</span>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{formatCurrency(estimate.selfEmploymentTax)}</span>
                    </div>
                  )}
                  <div className="px-4 py-3 flex justify-between">
                    <span className="text-sm text-gray-500 dark:text-gray-400">Tax Credits</span>
                    <span className="text-sm font-medium text-green-600 dark:text-green-400">-{formatCurrency(estimate.totalCredits)}</span>
                  </div>
                  <div className="px-4 py-3 flex justify-between">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">Total Tax Liability</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{formatCurrency(estimate.totalTaxLiability)}</span>
                  </div>
                  <div className="px-4 py-3 flex justify-between">
                    <span className="text-sm text-gray-500 dark:text-gray-400">Tax Withholding to Date</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{formatCurrency(estimate.withholdingToDate)}</span>
                  </div>
                  <div className="px-4 py-3 flex justify-between">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {estimate.estimatedRefundOrOwed >= 0 ? "Estimated Refund" : "Estimated Amount Owed"}
                    </span>
                    <span className={`text-sm font-medium ${estimate.estimatedRefundOrOwed >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                      {estimate.estimatedRefundOrOwed >= 0 
                        ? formatCurrency(estimate.estimatedRefundOrOwed)
                        : formatCurrency(Math.abs(estimate.estimatedRefundOrOwed))
                      }
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="p-4 bg-slate-50 dark:bg-slate-700 rounded-lg">
                  <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Marginal Tax Rate</h4>
                  <p className="text-xl font-medium">{formatPercent(estimate.marginalTaxRate)}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Rate on last dollar earned</p>
                </div>
                <div className="p-4 bg-slate-50 dark:bg-slate-700 rounded-lg">
                  <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Effective Tax Rate</h4>
                  <p className="text-xl font-medium">{formatPercent(estimate.effectiveTaxRate)}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Average rate on all income</p>
                </div>
              </div>
              
              <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <h4 className="font-medium text-yellow-800 dark:text-yellow-300 mb-2">Important Disclaimer</h4>
                <p className="text-sm text-yellow-700 dark:text-yellow-400">
                  This is only an estimate based on the information provided. Your actual tax liability may differ. 
                  For precise tax calculations, consult a tax professional or use official IRS tools.
                </p>
              </div>
            </div>
          )}
          
          {!estimate && !error && !isCalculating && (
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6 flex flex-col items-center justify-center h-full">
              <svg className="w-16 h-16 text-gray-400 dark:text-gray-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Estimate Your Taxes</h3>
              <p className="text-gray-500 dark:text-gray-400 text-center">
                Enter your income, deductions, and credits, then click 'Calculate' to see your estimated tax liability or refund.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}