'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/cards/Card';
import { ArrowLeft, Home, Car, TrendingUp, DollarSign, BarChart3 } from 'lucide-react';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface HouseInputs {
  homePrice: number;
  downPaymentPercent: number;
  interestRate: number;
  loanTerm: number;
  propertyTaxRate: number;
  homeInsurance: number;
  hoaFees: number;
  maintenancePercent: number;
  homeAppreciationRate: number;
  rentAmount: number;
  rentIncreaseRate: number;
  investmentReturnRate: number;
  timeHorizon: number;
}

interface AutoInputs {
  carPrice: number;
  downPayment: number;
  loanRate: number;
  loanTerm: number;
  leasePayment: number;
  leaseTerm: number;
  leaseDownPayment: number;
  residualValue: number;
  annualMiles: number;
  maintenanceCostPerYear: number;
  insurancePerYear: number;
  depreciationRate: number;
}

interface ComparisonResult {
  years: number;
  buyingCost: number;
  rentingCost: number;
  buyingEquity: number;
  netDifference: number;
}

interface AutoComparisonResult {
  years: number;
  buyingCost: number;
  leasingCost: number;
  buyingEquity: number;
  netDifference: number;
}

export default function RentVsBuyCalculator() {
  const [activeTab, setActiveTab] = useState<'house' | 'auto'>('house');
  const [viewTab, setViewTab] = useState<'summary' | 'visualization' | 'details'>('summary');

  // House inputs
  const [houseInputs, setHouseInputs] = useState<HouseInputs>({
    homePrice: 400000,
    downPaymentPercent: 20,
    interestRate: 6.5,
    loanTerm: 30,
    propertyTaxRate: 1.2,
    homeInsurance: 1200,
    hoaFees: 200,
    maintenancePercent: 1,
    homeAppreciationRate: 3,
    rentAmount: 2000,
    rentIncreaseRate: 3,
    investmentReturnRate: 7,
    timeHorizon: 10,
  });

  // Auto inputs
  const [autoInputs, setAutoInputs] = useState<AutoInputs>({
    carPrice: 35000,
    downPayment: 3000,
    loanRate: 6.5,
    loanTerm: 6,
    leasePayment: 450,
    leaseTerm: 3,
    leaseDownPayment: 2000,
    residualValue: 18000,
    annualMiles: 12000,
    maintenanceCostPerYear: 800,
    insurancePerYear: 1500,
    depreciationRate: 15,
  });

  const [houseResults, setHouseResults] = useState<ComparisonResult[]>([]);
  const [autoResults, setAutoResults] = useState<AutoComparisonResult[]>([]);

  const calculateHouseComparison = () => {
    const results: ComparisonResult[] = [];
    const loanAmount = houseInputs.homePrice * (1 - houseInputs.downPaymentPercent / 100);
    const monthlyRate = houseInputs.interestRate / 100 / 12;
    const numPayments = houseInputs.loanTerm * 12;

    // Monthly mortgage payment (P&I)
    const monthlyPayment = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1);

    let homeValue = houseInputs.homePrice;
    let remainingBalance = loanAmount;
    let totalBuyingCost = houseInputs.homePrice * (houseInputs.downPaymentPercent / 100); // Initial down payment
    let totalRentingCost = 0;
    let rentSavingsInvested = houseInputs.homePrice * (houseInputs.downPaymentPercent / 100); // Initial investment from down payment

    for (let year = 1; year <= houseInputs.timeHorizon; year++) {
      // Calculate buying costs for this year
      let yearlyPrincipal = 0;
      for (let month = 1; month <= 12; month++) {
        const interestPayment = remainingBalance * monthlyRate;
        const principalPayment = monthlyPayment - interestPayment;
        remainingBalance = Math.max(0, remainingBalance - principalPayment);
        yearlyPrincipal += principalPayment;
      }

      const propertyTax = homeValue * (houseInputs.propertyTaxRate / 100);
      const maintenance = homeValue * (houseInputs.maintenancePercent / 100);
      const yearlyOwningCost = (monthlyPayment * 12) + propertyTax + houseInputs.homeInsurance + (houseInputs.hoaFees * 12) + maintenance;

      totalBuyingCost += yearlyOwningCost;

      // Home appreciation
      homeValue *= (1 + houseInputs.homeAppreciationRate / 100);

      // Calculate renting costs for this year
      const currentRent = houseInputs.rentAmount * Math.pow(1 + houseInputs.rentIncreaseRate / 100, year - 1);
      const yearlyRentCost = currentRent * 12;
      totalRentingCost += yearlyRentCost;

      // Calculate investment growth of the difference
      const monthlySavings = (yearlyOwningCost / 12) - currentRent;
      if (monthlySavings < 0) {
        // If renting costs less, invest the difference
        for (let month = 1; month <= 12; month++) {
          rentSavingsInvested *= (1 + houseInputs.investmentReturnRate / 100 / 12);
          rentSavingsInvested += Math.abs(monthlySavings);
        }
      } else {
        // If buying costs less, still grow existing investments
        rentSavingsInvested *= Math.pow(1 + houseInputs.investmentReturnRate / 100, 1);
      }

      const buyingEquity = homeValue - remainingBalance;
      const rentingNetWorth = rentSavingsInvested;

      results.push({
        years: year,
        buyingCost: totalBuyingCost,
        rentingCost: totalRentingCost,
        buyingEquity: buyingEquity,
        netDifference: buyingEquity - rentingNetWorth,
      });
    }

    setHouseResults(results);
  };

  const calculateAutoComparison = () => {
    const results: AutoComparisonResult[] = [];
    const loanAmount = autoInputs.carPrice - autoInputs.downPayment;
    const monthlyRate = autoInputs.loanRate / 100 / 12;
    const numPayments = autoInputs.loanTerm * 12;

    // Monthly loan payment
    const monthlyPayment = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1);

    let carValue = autoInputs.carPrice;
    let remainingBalance = loanAmount;
    let totalBuyingCost = autoInputs.downPayment;
    let totalLeasingCost = autoInputs.leaseDownPayment;

    const yearsToCalculate = Math.max(autoInputs.loanTerm, autoInputs.leaseTerm * 2);

    for (let year = 1; year <= yearsToCalculate; year++) {
      // Buying costs
      if (year <= autoInputs.loanTerm) {
        totalBuyingCost += (monthlyPayment * 12);
        for (let month = 1; month <= 12; month++) {
          const interestPayment = remainingBalance * monthlyRate;
          const principalPayment = monthlyPayment - interestPayment;
          remainingBalance = Math.max(0, remainingBalance - principalPayment);
        }
      }
      totalBuyingCost += autoInputs.maintenanceCostPerYear + autoInputs.insurancePerYear;

      // Car depreciation
      carValue *= (1 - autoInputs.depreciationRate / 100);

      // Leasing costs
      const leasesCyclesCompleted = Math.floor((year - 0.5) / autoInputs.leaseTerm);
      const isInLeasePeriod = (year - 1) % autoInputs.leaseTerm < autoInputs.leaseTerm;

      if (isInLeasePeriod) {
        totalLeasingCost += (autoInputs.leasePayment * 12) + autoInputs.insurancePerYear;
      }

      // Add new lease down payment at start of each new lease
      if (year > 1 && (year - 1) % autoInputs.leaseTerm === 0) {
        totalLeasingCost += autoInputs.leaseDownPayment;
      }

      const buyingEquity = Math.max(0, carValue - remainingBalance);

      results.push({
        years: year,
        buyingCost: totalBuyingCost,
        leasingCost: totalLeasingCost,
        buyingEquity: buyingEquity,
        netDifference: buyingEquity,
      });
    }

    setAutoResults(results);
  };

  useEffect(() => {
    if (activeTab === 'house') {
      calculateHouseComparison();
    } else {
      calculateAutoComparison();
    }
  }, [houseInputs, autoInputs, activeTab]);

  const updateHouseInput = (key: keyof HouseInputs, value: number) => {
    setHouseInputs(prev => ({ ...prev, [key]: value }));
  };

  const updateAutoInput = (key: keyof AutoInputs, value: number) => {
    setAutoInputs(prev => ({ ...prev, [key]: value }));
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const finalResult = activeTab === 'house'
    ? houseResults[houseResults.length - 1]
    : autoResults[autoResults.length - 1];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-100 dark:from-gray-900 dark:to-gray-800 p-6">
      <div className="max-w-7xl mx-auto">
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
            🏘️ Rent vs Buy / Lease vs Buy Calculator
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Make informed decisions about major life purchases
          </p>
        </div>

        {/* Main Tabs */}
        <div className="mb-6">
          <div className="flex gap-3">
            <button
              onClick={() => setActiveTab('house')}
              className={`flex-1 py-4 px-6 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${
                activeTab === 'house'
                  ? 'bg-blue-600 text-white shadow-lg scale-105'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <Home className="h-5 w-5" />
              House (Rent vs Buy)
            </button>
            <button
              onClick={() => setActiveTab('auto')}
              className={`flex-1 py-4 px-6 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${
                activeTab === 'auto'
                  ? 'bg-blue-600 text-white shadow-lg scale-105'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <Car className="h-5 w-5" />
              Automobile (Lease vs Buy)
            </button>
          </div>
        </div>

        {/* House Tab Content */}
        {activeTab === 'house' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Inputs */}
            <div className="space-y-6">
              {/* Home Purchase Details */}
              <Card>
                <div className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <Home className="h-5 w-5 text-blue-600" />
                    Home Purchase Details
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Home Price
                      </label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <input
                          type="number"
                          value={houseInputs.homePrice}
                          onChange={(e) => updateHouseInput('homePrice', parseFloat(e.target.value) || 0)}
                          className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Down Payment: {houseInputs.downPaymentPercent}% ({formatCurrency(houseInputs.homePrice * houseInputs.downPaymentPercent / 100)})
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="50"
                        step="5"
                        value={houseInputs.downPaymentPercent}
                        onChange={(e) => updateHouseInput('downPaymentPercent', parseFloat(e.target.value))}
                        className="w-full"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Interest Rate: {houseInputs.interestRate}%
                      </label>
                      <input
                        type="range"
                        min="2"
                        max="10"
                        step="0.25"
                        value={houseInputs.interestRate}
                        onChange={(e) => updateHouseInput('interestRate', parseFloat(e.target.value))}
                        className="w-full"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Loan Term: {houseInputs.loanTerm} years
                      </label>
                      <input
                        type="range"
                        min="15"
                        max="30"
                        step="5"
                        value={houseInputs.loanTerm}
                        onChange={(e) => updateHouseInput('loanTerm', parseInt(e.target.value))}
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>
              </Card>

              {/* Additional Costs */}
              <Card>
                <div className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Additional Costs
                  </h3>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Property Tax Rate: {houseInputs.propertyTaxRate}%
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="3"
                          step="0.1"
                          value={houseInputs.propertyTaxRate}
                          onChange={(e) => updateHouseInput('propertyTaxRate', parseFloat(e.target.value))}
                          className="w-full"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Home Insurance: ${houseInputs.homeInsurance}/yr
                        </label>
                        <input
                          type="number"
                          value={houseInputs.homeInsurance}
                          onChange={(e) => updateHouseInput('homeInsurance', parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          HOA Fees: ${houseInputs.hoaFees}/mo
                        </label>
                        <input
                          type="number"
                          value={houseInputs.hoaFees}
                          onChange={(e) => updateHouseInput('hoaFees', parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Maintenance: {houseInputs.maintenancePercent}%/yr
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="3"
                          step="0.5"
                          value={houseInputs.maintenancePercent}
                          onChange={(e) => updateHouseInput('maintenancePercent', parseFloat(e.target.value))}
                          className="w-full"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Renting & Investment */}
              <Card>
                <div className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Renting & Investment Assumptions
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Monthly Rent: ${houseInputs.rentAmount}
                      </label>
                      <input
                        type="number"
                        value={houseInputs.rentAmount}
                        onChange={(e) => updateHouseInput('rentAmount', parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Rent Increase: {houseInputs.rentIncreaseRate}%/yr
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="10"
                          step="0.5"
                          value={houseInputs.rentIncreaseRate}
                          onChange={(e) => updateHouseInput('rentIncreaseRate', parseFloat(e.target.value))}
                          className="w-full"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Home Appreciation: {houseInputs.homeAppreciationRate}%/yr
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="10"
                          step="0.5"
                          value={houseInputs.homeAppreciationRate}
                          onChange={(e) => updateHouseInput('homeAppreciationRate', parseFloat(e.target.value))}
                          className="w-full"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Investment Return: {houseInputs.investmentReturnRate}%/yr
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="15"
                          step="0.5"
                          value={houseInputs.investmentReturnRate}
                          onChange={(e) => updateHouseInput('investmentReturnRate', parseFloat(e.target.value))}
                          className="w-full"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Time Horizon: {houseInputs.timeHorizon} years
                        </label>
                        <input
                          type="range"
                          min="5"
                          max="30"
                          step="5"
                          value={houseInputs.timeHorizon}
                          onChange={(e) => updateHouseInput('timeHorizon', parseInt(e.target.value))}
                          className="w-full"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </div>

            {/* Results */}
            <div className="space-y-6">
              {finalResult && (
                <>
                  {/* Summary Card */}
                  <Card className={`${finalResult.netDifference > 0 ? 'bg-gradient-to-br from-green-500 to-emerald-600' : 'bg-gradient-to-br from-blue-500 to-cyan-600'}`}>
                    <div className="p-6 text-white">
                      <h2 className="text-2xl font-bold mb-4">
                        {finalResult.netDifference > 0 ? '🏠 Buying is Better' : '🏘️ Renting is Better'}
                      </h2>
                      <div className="text-4xl font-bold mb-2">
                        {formatCurrency(Math.abs(finalResult.netDifference))}
                      </div>
                      <p className="text-sm opacity-90">
                        Net advantage after {houseInputs.timeHorizon} years
                      </p>
                    </div>
                  </Card>

                  {/* View Tabs */}
                  <Card>
                    <div className="p-6">
                      <div className="flex gap-2 mb-6">
                        <button
                          onClick={() => setViewTab('summary')}
                          className={`flex-1 py-2 px-3 rounded-lg font-medium transition-all text-sm ${
                            viewTab === 'summary'
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          Summary
                        </button>
                        <button
                          onClick={() => setViewTab('visualization')}
                          className={`flex-1 py-2 px-3 rounded-lg font-medium transition-all text-sm flex items-center justify-center gap-1 ${
                            viewTab === 'visualization'
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          <BarChart3 className="h-4 w-4" />
                          Charts
                        </button>
                        <button
                          onClick={() => setViewTab('details')}
                          className={`flex-1 py-2 px-3 rounded-lg font-medium transition-all text-sm ${
                            viewTab === 'details'
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          Details
                        </button>
                      </div>

                      {/* Summary Tab */}
                      {viewTab === 'summary' && (
                        <div className="space-y-3">
                          <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
                            After {houseInputs.timeHorizon} Years
                          </h3>
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                              <div className="text-gray-600 dark:text-gray-400 mb-1">Total Buying Cost</div>
                              <div className="font-bold text-gray-900 dark:text-white">{formatCurrency(finalResult.buyingCost)}</div>
                            </div>
                            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                              <div className="text-gray-600 dark:text-gray-400 mb-1">Total Renting Cost</div>
                              <div className="font-bold text-gray-900 dark:text-white">{formatCurrency(finalResult.rentingCost)}</div>
                            </div>
                            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                              <div className="text-gray-600 dark:text-gray-400 mb-1">Home Equity (Buying)</div>
                              <div className="font-bold text-green-600 dark:text-green-400">{formatCurrency(finalResult.buyingEquity)}</div>
                            </div>
                            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                              <div className="text-gray-600 dark:text-gray-400 mb-1">Net Difference</div>
                              <div className="font-bold text-blue-600 dark:text-blue-400">{formatCurrency(Math.abs(finalResult.netDifference))}</div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Visualization Tab */}
                      {viewTab === 'visualization' && (
                        <div className="space-y-6">
                          <div>
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                              Cumulative Costs Over Time
                            </h3>
                            <ResponsiveContainer width="100%" height={250}>
                              <LineChart data={houseResults}>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-300 dark:stroke-gray-600" />
                                <XAxis dataKey="years" label={{ value: 'Years', position: 'insideBottom', offset: -5 }} />
                                <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
                                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                                <Legend />
                                <Line type="monotone" dataKey="buyingCost" stroke="#10b981" strokeWidth={2} name="Buying Cost" />
                                <Line type="monotone" dataKey="rentingCost" stroke="#3b82f6" strokeWidth={2} name="Renting Cost" />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>

                          <div>
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                              Net Worth Comparison
                            </h3>
                            <ResponsiveContainer width="100%" height={250}>
                              <AreaChart data={houseResults}>
                                <defs>
                                  <linearGradient id="colorEquity" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.1}/>
                                  </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="years" label={{ value: 'Years', position: 'insideBottom', offset: -5 }} />
                                <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
                                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                                <Legend />
                                <Area type="monotone" dataKey="buyingEquity" stroke="#10b981" fill="url(#colorEquity)" name="Home Equity" />
                              </AreaChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      )}

                      {/* Details Tab */}
                      {viewTab === 'details' && (
                        <div className="max-h-96 overflow-y-auto">
                          <table className="w-full text-sm">
                            <thead className="sticky top-0 bg-gray-100 dark:bg-gray-800">
                              <tr>
                                <th className="text-left py-2 px-2">Year</th>
                                <th className="text-right py-2 px-2">Buy Cost</th>
                                <th className="text-right py-2 px-2">Rent Cost</th>
                                <th className="text-right py-2 px-2">Equity</th>
                                <th className="text-right py-2 px-2">Net Diff</th>
                              </tr>
                            </thead>
                            <tbody className="text-gray-600 dark:text-gray-400">
                              {houseResults.map((result) => (
                                <tr key={result.years} className="border-b border-gray-200 dark:border-gray-700">
                                  <td className="py-2 px-2 font-medium">{result.years}</td>
                                  <td className="text-right py-2 px-2">{formatCurrency(result.buyingCost)}</td>
                                  <td className="text-right py-2 px-2">{formatCurrency(result.rentingCost)}</td>
                                  <td className="text-right py-2 px-2 text-green-600 dark:text-green-400">{formatCurrency(result.buyingEquity)}</td>
                                  <td className="text-right py-2 px-2 font-semibold">
                                    {formatCurrency(Math.abs(result.netDifference))}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </Card>
                </>
              )}
            </div>
          </div>
        )}

        {/* Auto Tab Content */}
        {activeTab === 'auto' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Inputs */}
            <div className="space-y-6">
              {/* Buying Details */}
              <Card>
                <div className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <Car className="h-5 w-5 text-blue-600" />
                    Buying Details
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Car Price: {formatCurrency(autoInputs.carPrice)}
                      </label>
                      <input
                        type="number"
                        value={autoInputs.carPrice}
                        onChange={(e) => updateAutoInput('carPrice', parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Down Payment: {formatCurrency(autoInputs.downPayment)}
                      </label>
                      <input
                        type="number"
                        value={autoInputs.downPayment}
                        onChange={(e) => updateAutoInput('downPayment', parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Loan Rate: {autoInputs.loanRate}%
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="15"
                        step="0.5"
                        value={autoInputs.loanRate}
                        onChange={(e) => updateAutoInput('loanRate', parseFloat(e.target.value))}
                        className="w-full"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Loan Term: {autoInputs.loanTerm} years
                      </label>
                      <input
                        type="range"
                        min="3"
                        max="7"
                        step="1"
                        value={autoInputs.loanTerm}
                        onChange={(e) => updateAutoInput('loanTerm', parseInt(e.target.value))}
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>
              </Card>

              {/* Leasing Details */}
              <Card>
                <div className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Leasing Details
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Monthly Lease Payment: {formatCurrency(autoInputs.leasePayment)}
                      </label>
                      <input
                        type="number"
                        value={autoInputs.leasePayment}
                        onChange={(e) => updateAutoInput('leasePayment', parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Lease Down Payment: {formatCurrency(autoInputs.leaseDownPayment)}
                      </label>
                      <input
                        type="number"
                        value={autoInputs.leaseDownPayment}
                        onChange={(e) => updateAutoInput('leaseDownPayment', parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Lease Term: {autoInputs.leaseTerm} years
                      </label>
                      <input
                        type="range"
                        min="2"
                        max="4"
                        step="1"
                        value={autoInputs.leaseTerm}
                        onChange={(e) => updateAutoInput('leaseTerm', parseInt(e.target.value))}
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>
              </Card>

              {/* Other Costs */}
              <Card>
                <div className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Other Costs
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Maintenance: {formatCurrency(autoInputs.maintenanceCostPerYear)}/year
                      </label>
                      <input
                        type="number"
                        value={autoInputs.maintenanceCostPerYear}
                        onChange={(e) => updateAutoInput('maintenanceCostPerYear', parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Insurance: {formatCurrency(autoInputs.insurancePerYear)}/year
                      </label>
                      <input
                        type="number"
                        value={autoInputs.insurancePerYear}
                        onChange={(e) => updateAutoInput('insurancePerYear', parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Depreciation Rate: {autoInputs.depreciationRate}%/year
                      </label>
                      <input
                        type="range"
                        min="10"
                        max="25"
                        step="1"
                        value={autoInputs.depreciationRate}
                        onChange={(e) => updateAutoInput('depreciationRate', parseFloat(e.target.value))}
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>
              </Card>
            </div>

            {/* Results */}
            <div className="space-y-6">
              {autoResults.length > 0 && (
                <>
                  {/* Summary Card */}
                  <Card className={`${autoResults[autoResults.length - 1].buyingCost < autoResults[autoResults.length - 1].leasingCost ? 'bg-gradient-to-br from-green-500 to-emerald-600' : 'bg-gradient-to-br from-blue-500 to-cyan-600'}`}>
                    <div className="p-6 text-white">
                      <h2 className="text-2xl font-bold mb-4">
                        {autoResults[autoResults.length - 1].buyingCost < autoResults[autoResults.length - 1].leasingCost ? '🚗 Buying is Better' : '🔑 Leasing is Better'}
                      </h2>
                      <div className="text-4xl font-bold mb-2">
                        {formatCurrency(Math.abs(autoResults[autoResults.length - 1].buyingCost - autoResults[autoResults.length - 1].leasingCost))}
                      </div>
                      <p className="text-sm opacity-90">
                        Total cost difference after {autoResults.length} years
                      </p>
                    </div>
                  </Card>

                  {/* View Tabs */}
                  <Card>
                    <div className="p-6">
                      <div className="flex gap-2 mb-6">
                        <button
                          onClick={() => setViewTab('summary')}
                          className={`flex-1 py-2 px-3 rounded-lg font-medium transition-all text-sm ${
                            viewTab === 'summary'
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          Summary
                        </button>
                        <button
                          onClick={() => setViewTab('visualization')}
                          className={`flex-1 py-2 px-3 rounded-lg font-medium transition-all text-sm flex items-center justify-center gap-1 ${
                            viewTab === 'visualization'
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          <BarChart3 className="h-4 w-4" />
                          Charts
                        </button>
                        <button
                          onClick={() => setViewTab('details')}
                          className={`flex-1 py-2 px-3 rounded-lg font-medium transition-all text-sm ${
                            viewTab === 'details'
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          Details
                        </button>
                      </div>

                      {/* Summary Tab */}
                      {viewTab === 'summary' && (
                        <div className="space-y-3">
                          <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
                            Cost Comparison
                          </h3>
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                              <div className="text-gray-600 dark:text-gray-400 mb-1">Total Buying Cost</div>
                              <div className="font-bold text-gray-900 dark:text-white">{formatCurrency(autoResults[autoResults.length - 1].buyingCost)}</div>
                            </div>
                            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                              <div className="text-gray-600 dark:text-gray-400 mb-1">Total Leasing Cost</div>
                              <div className="font-bold text-gray-900 dark:text-white">{formatCurrency(autoResults[autoResults.length - 1].leasingCost)}</div>
                            </div>
                            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg col-span-2">
                              <div className="text-gray-600 dark:text-gray-400 mb-1">Car Equity (if buying)</div>
                              <div className="font-bold text-green-600 dark:text-green-400">{formatCurrency(autoResults[autoResults.length - 1].buyingEquity)}</div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Visualization Tab */}
                      {viewTab === 'visualization' && (
                        <div className="space-y-6">
                          <div>
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                              Cumulative Costs Over Time
                            </h3>
                            <ResponsiveContainer width="100%" height={300}>
                              <LineChart data={autoResults}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="years" label={{ value: 'Years', position: 'insideBottom', offset: -5 }} />
                                <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
                                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                                <Legend />
                                <Line type="monotone" dataKey="buyingCost" stroke="#10b981" strokeWidth={2} name="Buying" />
                                <Line type="monotone" dataKey="leasingCost" stroke="#3b82f6" strokeWidth={2} name="Leasing" />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      )}

                      {/* Details Tab */}
                      {viewTab === 'details' && (
                        <div className="max-h-96 overflow-y-auto">
                          <table className="w-full text-sm">
                            <thead className="sticky top-0 bg-gray-100 dark:bg-gray-800">
                              <tr>
                                <th className="text-left py-2 px-2">Year</th>
                                <th className="text-right py-2 px-2">Buy Cost</th>
                                <th className="text-right py-2 px-2">Lease Cost</th>
                                <th className="text-right py-2 px-2">Equity</th>
                              </tr>
                            </thead>
                            <tbody className="text-gray-600 dark:text-gray-400">
                              {autoResults.map((result) => (
                                <tr key={result.years} className="border-b border-gray-200 dark:border-gray-700">
                                  <td className="py-2 px-2 font-medium">{result.years}</td>
                                  <td className="text-right py-2 px-2">{formatCurrency(result.buyingCost)}</td>
                                  <td className="text-right py-2 px-2">{formatCurrency(result.leasingCost)}</td>
                                  <td className="text-right py-2 px-2 text-green-600 dark:text-green-400">{formatCurrency(result.buyingEquity)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </Card>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
