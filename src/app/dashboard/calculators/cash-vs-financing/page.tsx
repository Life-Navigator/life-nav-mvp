'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/cards/Card';
import { ArrowLeft, Wallet, TrendingUp, AlertTriangle, DollarSign, BarChart3, Calendar, TrendingDown, Download, CheckCircle, XCircle } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';

interface CalculatorInputs {
  assetPrice: number;
  assetType: 'car' | 'home' | 'other';
  assetAppreciationRate: number; // For homes, negative for cars

  // Available accounts
  checkingSavings: number; // Always use first, no penalties
  taxableAccount: number;
  traditionalIRA: number;
  rothIRA: number;
  account401k: number;
  annuity: number;

  // Personal info
  age: number;
  taxBracket: number;
  stateTaxRate: number;
  monthlyIncome: number;
  monthlyExpenses: number;

  // Investment & loan
  expectedReturn: number;
  loanInterestRate: number;
  loanTerm: number;

  // Payment strategy
  paymentStrategy: 'monthly' | 'bi-weekly' | 'weekly';
  startEarly: boolean;
  extraPrincipalAmount: number;
  extraPrincipalFrequency: 'none' | 'monthly' | 'quarterly' | 'annually';

  analysisPeriod: number;
}

interface AccountWithdrawal {
  accountType: string;
  amountWithdrawn: number;
  penalties: number;
  taxes: number;
  netAmount: number;
}

interface NetWorthTimeline {
  year: number;

  // Cash scenario
  cashRemainingInvestments: number;
  cashAssetValue: number;
  cashNetWorth: number;

  // Financing scenario
  financingRemainingInvestments: number;
  financingAssetValue: number;
  financingLoanBalance: number;
  financingNetWorth: number;

  advantage: number; // financing - cash
}

interface FinancingDetails {
  monthlyPayment: number;
  totalInterest: number;
  monthsToPayoff: number;
  schedule: any[];
}

interface ComprehensiveResult {
  recommendedDownPayment: number;
  downPaymentSource: AccountWithdrawal[];

  hasSufficientFunds: boolean;
  isAffordable: boolean;
  affordabilityMessage: string;

  cashOption: {
    totalWithdrawn: number;
    totalPenalties: number;
    totalTaxes: number;
    netCost: number;
    finalNetWorth: number;
    isPossible: boolean;
  };

  financingOption: {
    downPayment: number;
    loanAmount: number;
    totalInterest: number;
    monthlyPayment: number;
    totalCost: number;
    finalNetWorth: number;
    isPossible: boolean;
  };

  recommendation: 'cash' | 'financing' | 'neither';
  netDifference: number;
  timeline: NetWorthTimeline[];
  breakevenYear: number | null;
}

export default function CashVsFinancingCalculator() {
  const [inputs, setInputs] = useState<CalculatorInputs>({
    assetPrice: 50000,
    assetType: 'car',
    assetAppreciationRate: -15, // Car depreciation

    checkingSavings: 10000,
    taxableAccount: 30000,
    traditionalIRA: 75000,
    rothIRA: 25000,
    account401k: 100000,
    annuity: 0,

    age: 45,
    taxBracket: 24,
    stateTaxRate: 5,
    monthlyIncome: 8000,
    monthlyExpenses: 4000,

    expectedReturn: 7,
    loanInterestRate: 7.5,
    loanTerm: 5,

    paymentStrategy: 'monthly',
    startEarly: false,
    extraPrincipalAmount: 0,
    extraPrincipalFrequency: 'none',

    analysisPeriod: 10,
  });

  const [result, setResult] = useState<ComprehensiveResult | null>(null);
  const [activeTab, setActiveTab] = useState<'summary' | 'accounts' | 'networth' | 'strategies'>('summary');
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState(false);

  // Calculate optimal down payment (20% for homes, 10-20% for cars)
  const calculateOptimalDownPayment = (): number => {
    if (inputs.assetType === 'home') {
      return inputs.assetPrice * 0.20; // 20% down
    } else if (inputs.assetType === 'car') {
      return inputs.assetPrice * 0.15; // 15% down
    }
    return inputs.assetPrice * 0.20;
  };

  // Calculate withdrawal strategy from accounts
  const calculateWithdrawalStrategy = (amountNeeded: number): AccountWithdrawal[] => {
    const withdrawals: AccountWithdrawal[] = [];
    let remaining = amountNeeded;

    // Priority order: Checking/Savings (no penalties) -> Taxable -> Roth -> Traditional IRA -> 401k -> Annuity

    // 1. Checking/Savings (no penalties or taxes)
    if (remaining > 0 && inputs.checkingSavings > 0) {
      const amount = Math.min(inputs.checkingSavings, remaining);
      withdrawals.push({
        accountType: 'Checking/Savings',
        amountWithdrawn: amount,
        penalties: 0,
        taxes: 0,
        netAmount: amount,
      });
      remaining -= amount;
    }

    // 2. Taxable Account (15% capital gains)
    if (remaining > 0 && inputs.taxableAccount > 0) {
      const grossNeeded = remaining / 0.825; // Account for 15% federal + state
      const amount = Math.min(inputs.taxableAccount, grossNeeded);
      const capitalGainsTax = amount * 0.15;
      const stateTax = amount * (inputs.stateTaxRate / 100) * 0.5;
      const netAmount = amount - capitalGainsTax - stateTax;

      withdrawals.push({
        accountType: 'Taxable Account',
        amountWithdrawn: amount,
        penalties: 0,
        taxes: capitalGainsTax + stateTax,
        netAmount: netAmount,
      });
      remaining -= netAmount;
    }

    // 3. Roth IRA (contributions tax-free, earnings have penalties if under 59.5)
    if (remaining > 0 && inputs.rothIRA > 0) {
      const hasEarlyPenalty = inputs.age < 59.5;
      const contributions = inputs.rothIRA * 0.6; // Assume 60% contributions
      const earnings = inputs.rothIRA * 0.4;

      const grossNeeded = remaining / (1 - (hasEarlyPenalty ? 0.1 + inputs.taxBracket/100 : 0) * 0.4);
      const amount = Math.min(inputs.rothIRA, grossNeeded);

      const earningsPortion = amount * 0.4;
      const penalty = hasEarlyPenalty ? earningsPortion * 0.10 : 0;
      const taxes = hasEarlyPenalty ? earningsPortion * (inputs.taxBracket / 100) : 0;
      const netAmount = amount - penalty - taxes;

      withdrawals.push({
        accountType: 'Roth IRA',
        amountWithdrawn: amount,
        penalties: penalty,
        taxes: taxes,
        netAmount: netAmount,
      });
      remaining -= netAmount;
    }

    // 4. Traditional IRA (full amount taxed + 10% penalty if under 59.5)
    if (remaining > 0 && inputs.traditionalIRA > 0) {
      const hasEarlyPenalty = inputs.age < 59.5;
      const totalTaxRate = (hasEarlyPenalty ? 0.10 : 0) + (inputs.taxBracket / 100) + (inputs.stateTaxRate / 100);
      const grossNeeded = remaining / (1 - totalTaxRate);
      const amount = Math.min(inputs.traditionalIRA, grossNeeded);

      const penalty = hasEarlyPenalty ? amount * 0.10 : 0;
      const taxes = amount * ((inputs.taxBracket / 100) + (inputs.stateTaxRate / 100));
      const netAmount = amount - penalty - taxes;

      withdrawals.push({
        accountType: 'Traditional IRA',
        amountWithdrawn: amount,
        penalties: penalty,
        taxes: taxes,
        netAmount: netAmount,
      });
      remaining -= netAmount;
    }

    // 5. 401(k) (same as Traditional IRA)
    if (remaining > 0 && inputs.account401k > 0) {
      const hasEarlyPenalty = inputs.age < 59.5;
      const totalTaxRate = (hasEarlyPenalty ? 0.10 : 0) + (inputs.taxBracket / 100) + (inputs.stateTaxRate / 100);
      const grossNeeded = remaining / (1 - totalTaxRate);
      const amount = Math.min(inputs.account401k, grossNeeded);

      const penalty = hasEarlyPenalty ? amount * 0.10 : 0;
      const taxes = amount * ((inputs.taxBracket / 100) + (inputs.stateTaxRate / 100));
      const netAmount = amount - penalty - taxes;

      withdrawals.push({
        accountType: '401(k)',
        amountWithdrawn: amount,
        penalties: penalty,
        taxes: taxes,
        netAmount: netAmount,
      });
      remaining -= netAmount;
    }

    // 6. Annuity (surrender charges + taxes on gains + penalty)
    if (remaining > 0 && inputs.annuity > 0) {
      const surrenderCharge = 0.08;
      const gainsPortion = 0.5;
      const hasEarlyPenalty = inputs.age < 59.5;

      const totalRate = surrenderCharge + (gainsPortion * ((hasEarlyPenalty ? 0.10 : 0) + (inputs.taxBracket / 100) + (inputs.stateTaxRate / 100)));
      const grossNeeded = remaining / (1 - totalRate);
      const amount = Math.min(inputs.annuity, grossNeeded);

      const surrender = amount * surrenderCharge;
      const taxableGains = amount * gainsPortion;
      const penalty = hasEarlyPenalty ? taxableGains * 0.10 : 0;
      const taxes = taxableGains * ((inputs.taxBracket / 100) + (inputs.stateTaxRate / 100));
      const netAmount = amount - surrender - penalty - taxes;

      withdrawals.push({
        accountType: 'Annuity',
        amountWithdrawn: amount,
        penalties: penalty + surrender,
        taxes: taxes,
        netAmount: netAmount,
      });
      remaining -= netAmount;
    }

    return withdrawals;
  };

  // Calculate financing details with payment strategy
  const calculateFinancing = (loanAmount: number): FinancingDetails => {
    let paymentsPerYear: number;
    let ratePerPeriod: number;
    let paymentAmount: number;

    if (inputs.paymentStrategy === 'monthly') {
      paymentsPerYear = 12;
      ratePerPeriod = inputs.loanInterestRate / 100 / 12;
      const numPayments = inputs.loanTerm * 12;
      paymentAmount = loanAmount * (ratePerPeriod * Math.pow(1 + ratePerPeriod, numPayments)) / (Math.pow(1 + ratePerPeriod, numPayments) - 1);
    } else if (inputs.paymentStrategy === 'bi-weekly') {
      paymentsPerYear = 26;
      ratePerPeriod = inputs.loanInterestRate / 100 / 26;
      const monthlyRate = inputs.loanInterestRate / 100 / 12;
      const monthlyPayment = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, inputs.loanTerm * 12)) / (Math.pow(1 + monthlyRate, inputs.loanTerm * 12) - 1);
      paymentAmount = monthlyPayment / 2;
    } else {
      paymentsPerYear = 52;
      ratePerPeriod = inputs.loanInterestRate / 100 / 52;
      const monthlyRate = inputs.loanInterestRate / 100 / 12;
      const monthlyPayment = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, inputs.loanTerm * 12)) / (Math.pow(1 + monthlyRate, inputs.loanTerm * 12) - 1);
      paymentAmount = monthlyPayment / 4;
    }

    const schedule: any[] = [];
    let balance = loanAmount;
    let period = 0;
    let totalInterest = 0;
    const maxPeriods = inputs.loanTerm * paymentsPerYear * 1.5;

    while (balance > 0.01 && period < maxPeriods) {
      period++;
      const interestPayment = balance * ratePerPeriod;
      let principalPayment = Math.min(paymentAmount - interestPayment, balance);

      let extraPrincipal = 0;
      if (inputs.extraPrincipalFrequency !== 'none' && inputs.extraPrincipalAmount > 0) {
        if (inputs.extraPrincipalFrequency === 'monthly' && period % Math.round(paymentsPerYear / 12) === 0) {
          extraPrincipal = Math.min(inputs.extraPrincipalAmount, balance - principalPayment);
        } else if (inputs.extraPrincipalFrequency === 'quarterly' && period % Math.round(paymentsPerYear / 4) === 0) {
          extraPrincipal = Math.min(inputs.extraPrincipalAmount, balance - principalPayment);
        } else if (inputs.extraPrincipalFrequency === 'annually' && period % paymentsPerYear === 0) {
          extraPrincipal = Math.min(inputs.extraPrincipalAmount, balance - principalPayment);
        }
      }

      const totalPrincipalPayment = principalPayment + extraPrincipal;
      balance = Math.max(0, balance - totalPrincipalPayment);
      totalInterest += interestPayment;

      schedule.push({
        period,
        year: period / paymentsPerYear,
        payment: paymentAmount,
        principal: principalPayment,
        interest: interestPayment,
        extraPrincipal,
        balance,
      });

      if (balance === 0) break;
    }

    return {
      monthlyPayment: inputs.paymentStrategy === 'monthly' ? paymentAmount : paymentAmount * (paymentsPerYear / 12),
      totalInterest,
      monthsToPayoff: period / (paymentsPerYear / 12),
      schedule,
    };
  };

  // Calculate net worth over time with proper monthly compounding
  const calculateNetWorthTimeline = (
    downPayment: number,
    fullWithdrawals: AccountWithdrawal[],
    downPaymentWithdrawals: AccountWithdrawal[],
    financing: FinancingDetails
  ): NetWorthTimeline[] => {
    const timeline: NetWorthTimeline[] = [];
    const totalAvailableFunds = inputs.checkingSavings + inputs.taxableAccount + inputs.traditionalIRA +
                                 inputs.rothIRA + inputs.account401k + inputs.annuity;

    // Cash scenario: withdraw full amount upfront (with penalties/taxes)
    const totalWithdrawn = fullWithdrawals.reduce((sum, w) => sum + w.amountWithdrawn, 0);
    let cashInvestments = totalAvailableFunds - totalWithdrawn;

    // Financing scenario: withdraw down payment, then make monthly payments
    const downPaymentGross = downPaymentWithdrawals.reduce((sum, w) => sum + w.amountWithdrawn, 0);
    let financingInvestments = totalAvailableFunds - downPaymentGross;

    const monthlyRate = inputs.expectedReturn / 100 / 12;
    const monthlyPayment = financing.monthlyPayment;

    for (let year = 0; year <= inputs.analysisPeriod; year++) {
      // Asset value (appreciation or depreciation)
      const assetValue = inputs.assetPrice * Math.pow(1 + inputs.assetAppreciationRate / 100, year);

      // For year 0, no growth yet
      if (year > 0) {
        // Cash scenario: simple annual compounding (no monthly cash flows)
        cashInvestments *= (1 + inputs.expectedReturn / 100);

        // Financing scenario: monthly compounding with monthly payment outflows
        // Model the differential equation: dI/dt = r*I - P
        // Where I = investment balance, r = monthly rate, P = monthly payment
        const monthsInYear = 12;
        const loanMonthsRemaining = Math.max(0, (inputs.loanTerm * 12) - ((year - 1) * 12));
        const monthsWithPayments = Math.min(monthsInYear, loanMonthsRemaining);

        for (let month = 0; month < monthsInYear; month++) {
          // Grow investments for this month
          financingInvestments *= (1 + monthlyRate);

          // Subtract monthly payment if loan is still active
          if (month < monthsWithPayments) {
            financingInvestments -= monthlyPayment;
          }
        }
      }

      // Loan balance for financing scenario
      let loanBalance = 0;
      const monthsElapsed = year * 12;

      if (monthsElapsed < financing.schedule.length) {
        const scheduleEntry = financing.schedule.find(entry => Math.floor(entry.period) === monthsElapsed);
        loanBalance = scheduleEntry?.balance || 0;
      }

      // Net worth calculations
      const cashNetWorth = cashInvestments + assetValue;
      const financingNetWorth = financingInvestments + assetValue - loanBalance;
      const advantage = financingNetWorth - cashNetWorth;

      timeline.push({
        year,
        cashRemainingInvestments: Math.max(0, cashInvestments),
        cashAssetValue: assetValue,
        cashNetWorth,
        financingRemainingInvestments: Math.max(0, financingInvestments),
        financingAssetValue: assetValue,
        financingLoanBalance: loanBalance,
        financingNetWorth,
        advantage,
      });
    }

    return timeline;
  };

  useEffect(() => {
    const totalAvailableFunds = inputs.checkingSavings + inputs.taxableAccount + inputs.traditionalIRA +
                                 inputs.rothIRA + inputs.account401k + inputs.annuity;

    const optimalDownPayment = calculateOptimalDownPayment();
    const downPaymentWithdrawals = calculateWithdrawalStrategy(optimalDownPayment);
    const loanAmount = inputs.assetPrice - optimalDownPayment;
    const financing = calculateFinancing(loanAmount);

    // Check if we have enough funds for cash purchase
    const fullWithdrawals = calculateWithdrawalStrategy(inputs.assetPrice);
    const totalNetFromWithdrawals = fullWithdrawals.reduce((sum, w) => sum + w.netAmount, 0);
    const hasSufficientFunds = totalNetFromWithdrawals >= inputs.assetPrice;

    // Check if we have enough funds for down payment
    const downPaymentNet = downPaymentWithdrawals.reduce((sum, w) => sum + w.netAmount, 0);
    const canAffordDownPayment = downPaymentNet >= optimalDownPayment;

    // Check if monthly payment is affordable
    const availableForPayment = inputs.monthlyIncome - inputs.monthlyExpenses;
    const isAffordable = availableForPayment >= financing.monthlyPayment;

    let affordabilityMessage = '';
    if (!isAffordable && !canAffordDownPayment) {
      affordabilityMessage = 'Neither option is possible: insufficient funds for down payment and monthly payment exceeds available income.';
    } else if (!canAffordDownPayment) {
      affordabilityMessage = 'Financing not possible: insufficient funds for down payment.';
    } else if (!isAffordable) {
      affordabilityMessage = `Financing not affordable: monthly payment of ${formatCurrency(financing.monthlyPayment)} exceeds available income of ${formatCurrency(availableForPayment)}.`;
    } else if (!hasSufficientFunds) {
      affordabilityMessage = 'Cash purchase not possible: insufficient funds even with early withdrawal penalties. Financing recommended.';
    } else {
      affordabilityMessage = 'Both options are financially feasible.';
    }

    const totalPenalties = fullWithdrawals.reduce((sum, w) => sum + w.penalties, 0);
    const totalTaxes = fullWithdrawals.reduce((sum, w) => sum + w.taxes, 0);
    const totalWithdrawn = fullWithdrawals.reduce((sum, w) => sum + w.amountWithdrawn, 0);

    // Calculate timeline
    const timeline = calculateNetWorthTimeline(optimalDownPayment, fullWithdrawals, downPaymentWithdrawals, financing);

    const finalTimeline = timeline[timeline.length - 1];
    const breakevenYear = timeline.findIndex((t, i) => i > 0 && t.advantage > 0);

    // Determine recommendation based on multiple factors
    let recommendation: 'cash' | 'financing' | 'neither' = 'neither';

    if (!hasSufficientFunds && !isAffordable) {
      recommendation = 'neither';
    } else if (!hasSufficientFunds) {
      recommendation = 'financing';
    } else if (!isAffordable || !canAffordDownPayment) {
      recommendation = 'cash';
    } else {
      // Both are possible, compare net worth outcomes
      // But heavily penalize cash if there are significant early withdrawal penalties
      const penaltyRatio = (totalPenalties + totalTaxes) / inputs.assetPrice;

      if (penaltyRatio > 0.15) {
        // If penalties+taxes exceed 15% of asset price, strongly favor financing
        recommendation = 'financing';
      } else if (finalTimeline.advantage > 0) {
        recommendation = 'financing';
      } else if (finalTimeline.advantage < 0) {
        recommendation = 'cash';
      } else {
        // If equal, prefer whichever has lower immediate cost
        recommendation = totalPenalties + totalTaxes > financing.totalInterest ? 'financing' : 'cash';
      }
    }

    const comprehensiveResult: ComprehensiveResult = {
      recommendedDownPayment: optimalDownPayment,
      downPaymentSource: downPaymentWithdrawals,
      hasSufficientFunds,
      isAffordable,
      affordabilityMessage,

      cashOption: {
        totalWithdrawn,
        totalPenalties,
        totalTaxes,
        netCost: totalPenalties + totalTaxes,
        finalNetWorth: finalTimeline.cashNetWorth,
        isPossible: hasSufficientFunds,
      },

      financingOption: {
        downPayment: optimalDownPayment,
        loanAmount,
        totalInterest: financing.totalInterest,
        monthlyPayment: financing.monthlyPayment,
        totalCost: financing.totalInterest,
        finalNetWorth: finalTimeline.financingNetWorth,
        isPossible: isAffordable && canAffordDownPayment,
      },

      recommendation,
      netDifference: Math.abs(finalTimeline.advantage),
      timeline,
      breakevenYear: breakevenYear >= 0 ? breakevenYear : null,
    };

    setResult(comprehensiveResult);
  }, [inputs]);

  const updateInput = (key: keyof CalculatorInputs, value: any) => {
    setInputs(prev => ({ ...prev, [key]: value }));
  };

  const importAccounts = async () => {
    setIsImporting(true);
    setImportError(null);
    setImportSuccess(false);

    try {
      const response = await fetch('/api/financial/accounts');

      if (!response.ok) {
        throw new Error('Failed to fetch accounts');
      }

      const data = await response.json();

      // Map the categorized accounts to calculator inputs
      setInputs(prev => ({
        ...prev,
        checkingSavings: data.categorized.checking + data.categorized.savings,
        taxableAccount: data.categorized.taxable,
        traditionalIRA: data.categorized.traditionalIRA,
        rothIRA: data.categorized.rothIRA,
        account401k: data.categorized.account401k,
        annuity: data.categorized.annuity,
      }));

      setImportSuccess(true);
      setTimeout(() => setImportSuccess(false), 3000);

    } catch (error) {
      console.error('Import error:', error);
      setImportError('Failed to import accounts. Please try again.');
      setTimeout(() => setImportError(null), 5000);
    } finally {
      setIsImporting(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const totalAvailable = inputs.checkingSavings + inputs.taxableAccount + inputs.traditionalIRA +
                         inputs.rothIRA + inputs.account401k + inputs.annuity;

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-100 dark:from-gray-900 dark:to-gray-800 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <Link
            href="/dashboard/calculators"
            className="inline-flex items-center gap-2 text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Calculators
          </Link>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            💰 Smart Purchase Funding Calculator
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Optimize your funding strategy with retirement account analysis and net worth projections
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Inputs */}
          <div className="space-y-6">
            {/* Asset Details */}
            <Card>
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-emerald-600" />
                  Asset Details
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Asset Type
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => {
                          updateInput('assetType', 'car');
                          updateInput('assetAppreciationRate', -15);
                        }}
                        className={`py-2 px-3 rounded-lg font-medium transition-all text-sm ${
                          inputs.assetType === 'car'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        🚗 Car
                      </button>
                      <button
                        onClick={() => {
                          updateInput('assetType', 'home');
                          updateInput('assetAppreciationRate', 3);
                        }}
                        className={`py-2 px-3 rounded-lg font-medium transition-all text-sm ${
                          inputs.assetType === 'home'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        🏠 Home
                      </button>
                      <button
                        onClick={() => {
                          updateInput('assetType', 'other');
                          updateInput('assetAppreciationRate', 0);
                        }}
                        className={`py-2 px-3 rounded-lg font-medium transition-all text-sm ${
                          inputs.assetType === 'other'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        Other
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Asset Price: {formatCurrency(inputs.assetPrice)}
                    </label>
                    <input
                      type="number"
                      value={inputs.assetPrice}
                      onChange={(e) => updateInput('assetPrice', parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {inputs.assetType === 'home' ? 'Appreciation' : inputs.assetType === 'car' ? 'Depreciation' : 'Growth'} Rate: {inputs.assetAppreciationRate}%/year
                    </label>
                    <input
                      type="range"
                      min={inputs.assetType === 'car' ? -25 : -10}
                      max={inputs.assetType === 'home' ? 10 : 5}
                      step="0.5"
                      value={inputs.assetAppreciationRate}
                      onChange={(e) => updateInput('assetAppreciationRate', parseFloat(e.target.value))}
                      className="w-full"
                    />
                  </div>
                </div>
              </div>
            </Card>

            {/* Available Accounts */}
            <Card>
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <Wallet className="h-5 w-5 text-blue-600" />
                    Available Funds
                  </h3>
                  <button
                    onClick={importAccounts}
                    disabled={isImporting}
                    className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                  >
                    <Download className={`h-3.5 w-3.5 ${isImporting ? 'animate-bounce' : ''}`} />
                    {isImporting ? 'Importing...' : 'Import Accounts'}
                  </button>
                </div>

                {/* Success/Error Messages */}
                {importSuccess && (
                  <div className="mb-3 p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-2 text-sm text-green-800 dark:text-green-200">
                    <CheckCircle className="h-4 w-4" />
                    <span>Accounts imported successfully!</span>
                  </div>
                )}
                {importError && (
                  <div className="mb-3 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2 text-sm text-red-800 dark:text-red-200">
                    <XCircle className="h-4 w-4" />
                    <span>{importError}</span>
                  </div>
                )}

                <div className="space-y-3">
                  {[
                    { key: 'checkingSavings' as keyof CalculatorInputs, label: 'Checking/Savings', info: 'No penalties' },
                    { key: 'taxableAccount' as keyof CalculatorInputs, label: 'Taxable Account', info: '15% capital gains' },
                    { key: 'rothIRA' as keyof CalculatorInputs, label: 'Roth IRA', info: inputs.age < 59.5 ? 'Penalties on earnings' : 'No penalties' },
                    { key: 'traditionalIRA' as keyof CalculatorInputs, label: 'Traditional IRA', info: inputs.age < 59.5 ? '10% penalty + taxes' : 'Taxes only' },
                    { key: 'account401k' as keyof CalculatorInputs, label: '401(k)', info: inputs.age < 59.5 ? '10% penalty + taxes' : 'Taxes only' },
                    { key: 'annuity' as keyof CalculatorInputs, label: 'Annuity', info: 'Surrender charges + penalties' },
                  ].map((account) => (
                    <div key={account.key}>
                      <div className="flex justify-between items-center mb-1">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                          {account.label}
                        </label>
                        <span className="text-xs text-gray-500 dark:text-gray-400">{account.info}</span>
                      </div>
                      <input
                        type="number"
                        value={inputs[account.key] as number}
                        onChange={(e) => updateInput(account.key, parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                      />
                    </div>
                  ))}
                  <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex justify-between">
                      <span className="text-sm font-semibold">Total:</span>
                      <span className="font-bold text-gray-900 dark:text-white">{formatCurrency(totalAvailable)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Personal Info */}
            <Card>
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Personal & Tax Info
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Your Age: {inputs.age}
                    </label>
                    <input
                      type="range"
                      min="18"
                      max="80"
                      value={inputs.age}
                      onChange={(e) => updateInput('age', parseInt(e.target.value))}
                      className="w-full"
                    />
                    {inputs.age < 59.5 && (
                      <p className="text-xs text-orange-600 mt-1 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Early withdrawal penalties apply
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Tax Bracket: {inputs.taxBracket}%
                      </label>
                      <select
                        value={inputs.taxBracket}
                        onChange={(e) => updateInput('taxBracket', parseInt(e.target.value))}
                        className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-sm"
                      >
                        {[10, 12, 22, 24, 32, 35, 37].map(rate => (
                          <option key={rate} value={rate}>{rate}%</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        State Tax: {inputs.stateTaxRate}%
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="13"
                        step="0.5"
                        value={inputs.stateTaxRate}
                        onChange={(e) => updateInput('stateTaxRate', parseFloat(e.target.value))}
                        className="w-full"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Monthly Income
                      </label>
                      <input
                        type="number"
                        value={inputs.monthlyIncome}
                        onChange={(e) => updateInput('monthlyIncome', parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 border rounded-lg text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Monthly Expenses
                      </label>
                      <input
                        type="number"
                        value={inputs.monthlyExpenses}
                        onChange={(e) => updateInput('monthlyExpenses', parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 border rounded-lg text-sm"
                      />
                    </div>
                  </div>
                  <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Available for Payment:</span>
                      <span className={`font-semibold ${(inputs.monthlyIncome - inputs.monthlyExpenses) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(inputs.monthlyIncome - inputs.monthlyExpenses)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Loan & Investment */}
            <Card>
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Loan & Investment Terms
                </h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Loan Rate: {inputs.loanInterestRate}%
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="15"
                        step="0.25"
                        value={inputs.loanInterestRate}
                        onChange={(e) => updateInput('loanInterestRate', parseFloat(e.target.value))}
                        className="w-full"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Term: {inputs.loanTerm} years
                      </label>
                      <input
                        type="range"
                        min="1"
                        max="10"
                        value={inputs.loanTerm}
                        onChange={(e) => updateInput('loanTerm', parseInt(e.target.value))}
                        className="w-full"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Investment Return: {inputs.expectedReturn}%
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="15"
                      step="0.5"
                      value={inputs.expectedReturn}
                      onChange={(e) => updateInput('expectedReturn', parseFloat(e.target.value))}
                      className="w-full"
                    />
                  </div>
                </div>
              </div>
            </Card>

            {/* Payment Strategy */}
            <Card>
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Payment Strategy
                </h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-2">
                    {['monthly', 'bi-weekly', 'weekly'].map((strategy) => (
                      <button
                        key={strategy}
                        onClick={() => updateInput('paymentStrategy', strategy)}
                        className={`py-2 px-2 rounded-lg font-medium transition-all text-xs ${
                          inputs.paymentStrategy === strategy
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {strategy.charAt(0).toUpperCase() + strategy.slice(1)}
                      </button>
                    ))}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Extra Payment: {formatCurrency(inputs.extraPrincipalAmount)}
                    </label>
                    <input
                      type="number"
                      value={inputs.extraPrincipalAmount}
                      onChange={(e) => updateInput('extraPrincipalAmount', parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 border rounded-lg text-sm mb-2"
                    />
                    <select
                      value={inputs.extraPrincipalFrequency}
                      onChange={(e) => updateInput('extraPrincipalFrequency', e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                    >
                      <option value="none">No extra</option>
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly</option>
                      <option value="annually">Annually</option>
                    </select>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Results */}
          <div className="space-y-6">
            {result && (
              <>
                {/* Affordability Warning */}
                {result.recommendation === 'neither' ? (
                  <Card className="bg-gradient-to-br from-red-500 to-red-600">
                    <div className="p-6 text-white">
                      <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                        <AlertTriangle className="h-6 w-6" />
                        ⚠️ Purchase Not Recommended
                      </h2>
                      <p className="text-sm opacity-90 mb-4">
                        {result.affordabilityMessage}
                      </p>
                      <div className="bg-white/20 rounded-lg p-4">
                        <p className="text-xs">
                          Consider: increasing income, reducing expenses, choosing a less expensive asset, or saving more before purchase.
                        </p>
                      </div>
                    </div>
                  </Card>
                ) : (
                  <Card className={`${result.recommendation === 'financing' ? 'bg-gradient-to-br from-green-500 to-emerald-600' : 'bg-gradient-to-br from-blue-500 to-cyan-600'}`}>
                    <div className="p-6 text-white">
                      <h2 className="text-2xl font-bold mb-4">
                        {result.recommendation === 'financing' ? '🏦 Financing Recommended' : '💵 Pay Cash Recommended'}
                      </h2>
                      <div className="text-4xl font-bold mb-2">
                        {formatCurrency(result.netDifference)}
                      </div>
                      <p className="text-sm opacity-90 mb-4">
                        Net worth advantage after {inputs.analysisPeriod} years
                      </p>
                      {result.affordabilityMessage && (
                        <div className="bg-white/20 rounded-lg p-3 mb-4">
                          <p className="text-xs">{result.affordabilityMessage}</p>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <div className="opacity-75">Recommended Down</div>
                          <div className="font-bold">{formatCurrency(result.recommendedDownPayment)}</div>
                        </div>
                        <div>
                          <div className="opacity-75">Final Net Worth</div>
                          <div className="font-bold">{formatCurrency(result.recommendation === 'financing' ? result.financingOption.finalNetWorth : result.cashOption.finalNetWorth)}</div>
                        </div>
                      </div>
                    </div>
                  </Card>
                )}

                {/* Tabs */}
                <Card>
                  <div className="p-6">
                    <div className="flex gap-2 mb-6 flex-wrap">
                      {['summary', 'accounts', 'networth', 'strategies'].map((tab) => (
                        <button
                          key={tab}
                          onClick={() => setActiveTab(tab as any)}
                          className={`flex-1 min-w-[80px] py-2 px-2 rounded-lg font-medium transition-all text-xs ${
                            activeTab === tab
                              ? 'bg-emerald-600 text-white'
                              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          {tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </button>
                      ))}
                    </div>

                    {/* Summary Tab */}
                    {activeTab === 'summary' && (
                      <div className="space-y-4">
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="font-semibold text-gray-900 dark:text-white">Pay Cash</h3>
                            {result.cashOption.isPossible ? (
                              <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                Possible
                              </span>
                            ) : (
                              <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                                Not Possible
                              </span>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                              <div className="text-gray-600 dark:text-gray-400 mb-1">Penalties</div>
                              <div className="font-bold text-red-600">{formatCurrency(result.cashOption.totalPenalties)}</div>
                            </div>
                            <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                              <div className="text-gray-600 dark:text-gray-400 mb-1">Taxes</div>
                              <div className="font-bold text-red-600">{formatCurrency(result.cashOption.totalTaxes)}</div>
                            </div>
                            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg col-span-2">
                              <div className="text-gray-600 dark:text-gray-400 mb-1">Final Net Worth</div>
                              <div className="font-bold text-gray-900 dark:text-white">{formatCurrency(result.cashOption.finalNetWorth)}</div>
                            </div>
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="font-semibold text-gray-900 dark:text-white">Financing</h3>
                            {result.financingOption.isPossible ? (
                              <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                Affordable
                              </span>
                            ) : (
                              <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                                Not Affordable
                              </span>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                              <div className="text-gray-600 dark:text-gray-400 mb-1">Down Payment</div>
                              <div className="font-bold text-gray-900 dark:text-white">{formatCurrency(result.financingOption.downPayment)}</div>
                            </div>
                            <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                              <div className="text-gray-600 dark:text-gray-400 mb-1">Interest</div>
                              <div className="font-bold text-red-600">{formatCurrency(result.financingOption.totalInterest)}</div>
                            </div>
                            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                              <div className="text-gray-600 dark:text-gray-400 mb-1">Monthly Payment</div>
                              <div className="font-bold text-gray-900 dark:text-white">{formatCurrency(result.financingOption.monthlyPayment)}</div>
                            </div>
                            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                              <div className="text-gray-600 dark:text-gray-400 mb-1">Final Net Worth</div>
                              <div className="font-bold text-green-600">{formatCurrency(result.financingOption.finalNetWorth)}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Accounts Tab */}
                    {activeTab === 'accounts' && (
                      <div className="space-y-4">
                        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                          <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Recommended Down Payment Strategy</h4>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                            {result.recommendedDownPayment > 0 ? `We recommend ${formatCurrency(result.recommendedDownPayment)} down payment (${Math.round((result.recommendedDownPayment/inputs.assetPrice)*100)}%)` : 'Minimal down payment recommended'}
                          </p>
                        </div>

                        <h3 className="font-semibold text-gray-900 dark:text-white">Withdrawal Strategy</h3>
                        <div className="space-y-2">
                          {result.downPaymentSource.map((withdrawal, idx) => (
                            <div key={idx} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                              <div className="flex justify-between items-start mb-2">
                                <span className="font-semibold text-sm">{withdrawal.accountType}</span>
                                <span className="text-sm font-medium">{formatCurrency(withdrawal.netAmount)}</span>
                              </div>
                              {(withdrawal.penalties > 0 || withdrawal.taxes > 0) && (
                                <div className="text-xs space-y-1">
                                  {withdrawal.penalties > 0 && (
                                    <div className="flex justify-between text-red-600">
                                      <span>Penalties:</span>
                                      <span>-{formatCurrency(withdrawal.penalties)}</span>
                                    </div>
                                  )}
                                  {withdrawal.taxes > 0 && (
                                    <div className="flex justify-between text-orange-600">
                                      <span>Taxes:</span>
                                      <span>-{formatCurrency(withdrawal.taxes)}</span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Net Worth Tab */}
                    {activeTab === 'networth' && (
                      <div className="space-y-6">
                        <div>
                          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                            Net Worth Comparison Over Time
                          </h3>
                          <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={result.timeline}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="year" label={{ value: 'Years', position: 'insideBottom', offset: -5 }} />
                              <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
                              <Tooltip formatter={(value: number) => formatCurrency(value)} />
                              <Legend />
                              {result.breakevenYear && (
                                <ReferenceLine x={result.breakevenYear} stroke="#f59e0b" strokeWidth={2} label="Breakeven" strokeDasharray="5 5" />
                              )}
                              <Line type="monotone" dataKey="cashNetWorth" stroke="#3b82f6" strokeWidth={2} name="Pay Cash" />
                              <Line type="monotone" dataKey="financingNetWorth" stroke="#10b981" strokeWidth={2} name="Financing" />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>

                        <div>
                          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                            Investment Balance Comparison
                          </h3>
                          <ResponsiveContainer width="100%" height={250}>
                            <AreaChart data={result.timeline}>
                              <defs>
                                <linearGradient id="cashInv" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1}/>
                                </linearGradient>
                                <linearGradient id="finInv" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.1}/>
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="year" />
                              <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
                              <Tooltip formatter={(value: number) => formatCurrency(value)} />
                              <Legend />
                              <Area type="monotone" dataKey="cashRemainingInvestments" stroke="#3b82f6" fill="url(#cashInv)" name="Cash - Investments" />
                              <Area type="monotone" dataKey="financingRemainingInvestments" stroke="#10b981" fill="url(#finInv)" name="Financing - Investments" />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>

                        <div>
                          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                            Asset Value & Loan Balance
                          </h3>
                          <ResponsiveContainer width="100%" height={250}>
                            <AreaChart data={result.timeline}>
                              <defs>
                                <linearGradient id="asset" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.1}/>
                                </linearGradient>
                                <linearGradient id="loan" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/>
                                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0.1}/>
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="year" />
                              <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
                              <Tooltip formatter={(value: number) => formatCurrency(value)} />
                              <Legend />
                              <Area type="monotone" dataKey="financingAssetValue" stroke="#8b5cf6" fill="url(#asset)" name="Asset Value" />
                              <Area type="monotone" dataKey="financingLoanBalance" stroke="#ef4444" fill="url(#loan)" name="Loan Balance" />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}

                    {/* Strategies Tab */}
                    {activeTab === 'strategies' && (
                      <div className="space-y-4">
                        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                          <h4 className="font-semibold mb-2 text-sm">Payment Strategy Benefits</h4>
                          <ul className="space-y-2 text-xs text-gray-600 dark:text-gray-400">
                            {inputs.paymentStrategy === 'bi-weekly' && (
                              <li>• Bi-weekly = 26 payments/year = 13 monthly payments</li>
                            )}
                            {inputs.paymentStrategy === 'weekly' && (
                              <li>• Weekly = 52 payments/year ≈ 13 monthly payments</li>
                            )}
                            {inputs.extraPrincipalAmount > 0 && (
                              <li>• Extra ${inputs.extraPrincipalAmount} {inputs.extraPrincipalFrequency} accelerates payoff</li>
                            )}
                            <li>• More frequent payments = less interest over loan life</li>
                          </ul>
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <div className="text-gray-600 dark:text-gray-400 mb-1">Loan Rate</div>
                            <div className="font-bold">{inputs.loanInterestRate}%</div>
                          </div>
                          <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <div className="text-gray-600 dark:text-gray-400 mb-1">Investment Return</div>
                            <div className="font-bold">{inputs.expectedReturn}%</div>
                          </div>
                          <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg col-span-2">
                            <div className="text-gray-600 dark:text-gray-400 mb-1">Return Spread</div>
                            <div className="font-bold text-gray-900 dark:text-white">
                              {inputs.expectedReturn - inputs.loanInterestRate > 0 ? '+' : ''}{(inputs.expectedReturn - inputs.loanInterestRate).toFixed(2)}%
                              {inputs.expectedReturn > inputs.loanInterestRate
                                ? ' (Favor financing)'
                                : ' (Favor paying cash)'}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </Card>

                {/* Tips */}
                <Card>
                  <div className="p-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      💡 Key Insights
                    </h3>
                    <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                      <li className="flex gap-2">
                        <span className="text-emerald-600 font-bold">•</span>
                        <span><strong>Smart withdrawals:</strong> We prioritize low-penalty accounts first to minimize tax impact.</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-emerald-600 font-bold">•</span>
                        <span><strong>Net worth focus:</strong> The best option maximizes your wealth over time, not just minimizes payments.</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-emerald-600 font-bold">•</span>
                        <span><strong>Rate arbitrage:</strong> If investment returns exceed loan rate, keep money invested.</span>
                      </li>
                      {inputs.age < 59.5 && (
                        <li className="flex gap-2">
                          <span className="text-orange-600 font-bold">•</span>
                          <span><strong>Age consideration:</strong> At {inputs.age}, early withdrawal penalties significantly favor financing.</span>
                        </li>
                      )}
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
