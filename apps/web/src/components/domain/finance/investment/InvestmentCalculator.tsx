// FILE: src/components/finance/investment/InvestmentCalculator.tsx
'use client';

import React, { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from "recharts";

interface MarketAssumptions {
  riskFreeRate: number;
  equityRiskPremium: number;
  inflationRate: number;
  bondYield: number;
}

interface InvestmentScenario {
  name: string;
  returnRate: number;
  color: string;
}

export function InvestmentCalculator() {
  // Initial portfolio value
  const [initialValue, setInitialValue] = useState(100000);
  
  // Monthly contribution
  const [monthlyContribution, setMonthlyContribution] = useState(500);
  
  // Investment timeline in years
  const [timeHorizon, setTimeHorizon] = useState(20);
  
  // Market assumptions
  const [marketAssumptions, setMarketAssumptions] = useState<MarketAssumptions>({
    riskFreeRate: 4.5,
    equityRiskPremium: 5.0,
    inflationRate: 2.5,
    bondYield: 5.2,
  });
  
  // Investment scenarios (conservative, moderate, aggressive)
  const [scenarios, setScenarios] = useState<InvestmentScenario[]>([
    { name: "Conservative", returnRate: 5.0, color: "#4299E1" }, // blue
    { name: "Moderate", returnRate: 7.0, color: "#48BB78" },     // green
    { name: "Aggressive", returnRate: 9.0, color: "#ED8936" },   // orange
  ]);
  
  // Chart data
  const [projectionData, setProjectionData] = useState<any[]>([]);
  
  // Selected scenario for detailed view
  const [selectedScenario, setSelectedScenario] = useState("Moderate");
  
  // Calculate growth scenarios based on inputs
  useEffect(() => {
    // Update scenario return rates based on market assumptions
    const updatedScenarios = [
      { 
        name: "Conservative", 
        returnRate: marketAssumptions.riskFreeRate + (marketAssumptions.equityRiskPremium * 0.3), 
        color: "#4299E1" 
      },
      { 
        name: "Moderate", 
        returnRate: marketAssumptions.riskFreeRate + (marketAssumptions.equityRiskPremium * 0.6), 
        color: "#48BB78" 
      },
      { 
        name: "Aggressive", 
        returnRate: marketAssumptions.riskFreeRate + marketAssumptions.equityRiskPremium, 
        color: "#ED8936" 
      },
    ];
    
    setScenarios(updatedScenarios);
    
    // Generate projection data for the chart
    const data = [];
    
    for (let year = 0; year <= timeHorizon; year++) {
      const yearData: any = { year };
      
      // Calculate value for each scenario
      updatedScenarios.forEach(scenario => {
        const annualRate = scenario.returnRate / 100;
        const monthlyRate = annualRate / 12;
        
        // Future value calculation with monthly contributions
        // FV = P(1+r)^n + PMT*[((1+r)^n - 1)/r]
        // where P = principal, r = rate, n = time periods, PMT = periodic payment
        let futureValue = initialValue * Math.pow(1 + annualRate, year);
        
        // Add monthly contributions if any
        if (monthlyContribution > 0 && annualRate > 0) {
          const monthsTotal = year * 12;
          const contributionGrowth = monthlyContribution * ((Math.pow(1 + monthlyRate, monthsTotal) - 1) / monthlyRate);
          futureValue += contributionGrowth;
        } else if (monthlyContribution > 0) {
          // If rate is 0, just add the total contributions
          futureValue += monthlyContribution * year * 12;
        }
        
        yearData[scenario.name] = Math.round(futureValue);
        
        // Calculate inflation-adjusted value
        const inflationFactor = Math.pow(1 + (marketAssumptions.inflationRate / 100), year);
        yearData[`${scenario.name} (Infl. Adj.)`] = Math.round(futureValue / inflationFactor);
      });
      
      data.push(yearData);
    }
    
    setProjectionData(data);
  }, [initialValue, monthlyContribution, timeHorizon, marketAssumptions]);
  
  // Format currency values
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(value);
  };
  
  // Handle market assumption changes
  const handleAssumptionChange = (field: keyof MarketAssumptions, value: string) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue)) {
      setMarketAssumptions({
        ...marketAssumptions,
        [field]: numValue,
      });
    }
  };
  
  return (
    <div className="bg-white rounded-lg shadow dark:bg-slate-800 p-6">
      <h2 className="text-xl font-semibold mb-6">Investment Growth Calculator</h2>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <div>
          <h3 className="text-lg font-medium mb-4">Portfolio Inputs</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Initial Investment
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500 dark:text-slate-400">
                  $
                </span>
                <input
                  title="Enter initial investment amount"
                  placeholder="Enter initial investment"
                  aria-label="Initial Investment"
                  type="number"
                  value={initialValue}
                  onChange={e => setInitialValue(Number(e.target.value))}
                  min="0"
                  className="w-full pl-8 pr-4 py-2 rounded-md border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Monthly Contribution
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500 dark:text-slate-400">
                  $
                </span>
                <input
                  title="Enter monthly contribution amount"
                  placeholder="Enter monthly contribution"
                  aria-label="Monthly Contribution"
                  type="number"
                  value={monthlyContribution}
                  onChange={e => setMonthlyContribution(Number(e.target.value))}
                  min="0"
                  className="w-full pl-8 pr-4 py-2 rounded-md border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Time Horizon (Years)
              </label>
              <input
                title="Select investment time horizon in years"
                placeholder="Select time horizon"
                aria-label="Time Horizon"
                type="range"
                min="1"
                max="40"
                value={timeHorizon}
                onChange={e => setTimeHorizon(Number(e.target.value))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer dark:bg-slate-700"
              />
              <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mt-1">
                <span>1</span>
                <span>{timeHorizon} years</span>
                <span>40</span>
              </div>
            </div>
          </div>
        </div>
        
        <div>
          <h3 className="text-lg font-medium mb-4">Market Assumptions</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Risk-Free Rate (%)
              </label>
              <div className="relative">
                <input
                  aria-label="Risk-Free Rate"
                  title="Enter risk-free rate percentage"
                  placeholder="Enter risk-free rate"
                  type="number"
                  value={marketAssumptions.riskFreeRate}
                  onChange={e => handleAssumptionChange('riskFreeRate', e.target.value)}
                  step="0.1"
                  min="0"
                  max="10"
                  className="w-full pl-4 pr-8 py-2 rounded-md border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-500 dark:text-slate-400">
                  %
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Current Treasury yield for risk-free investments
              </p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Equity Risk Premium (%)
              </label>
              <div className="relative">
                <input
                  aria-label="Equity Risk Premium"
                  title="Enter expected equity risk premium"
                  placeholder="Enter equity risk premium"
                  type="number"
                  value={marketAssumptions.equityRiskPremium}
                  onChange={e => handleAssumptionChange('equityRiskPremium', e.target.value)}
                  step="0.1"
                  min="0"
                  max="15"
                  className="w-full pl-4 pr-8 py-2 rounded-md border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-500 dark:text-slate-400">
                  %
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Additional return expected from equity investments
              </p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Inflation Rate (%)
              </label>
              <div className="relative">
                <input
                  aria-label="Inflation Rate"
                  title="Enter expected long-term inflation rate"
                  placeholder="Enter inflation rate"
                  type="number"
                  value={marketAssumptions.inflationRate}
                  onChange={e => handleAssumptionChange('inflationRate', e.target.value)}
                  step="0.1"
                  min="0"
                  max="10"
                  className="w-full pl-4 pr-8 py-2 rounded-md border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-500 dark:text-slate-400">
                  %
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Expected long-term inflation rate
              </p>
            </div>
          </div>
        </div>
      </div>
      
      <div className="mb-6">
        <h3 className="text-lg font-medium mb-2">Investment Scenario Returns</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {scenarios.map((scenario) => (
            <div 
              key={scenario.name} 
              className={`p-4 rounded-lg border cursor-pointer transition-all ${
                selectedScenario === scenario.name 
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                  : 'border-slate-200 hover:border-blue-300 dark:border-slate-700 dark:hover:border-blue-700'
              }`}
              onClick={() => setSelectedScenario(scenario.name)}
            >
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium">{scenario.name}</h4>
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: scenario.color }}
                />
              </div>
              <p className="text-2xl font-bold">{scenario.returnRate.toFixed(1)}%</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Expected annual return
              </p>
            </div>
          ))}
        </div>
      </div>
      
      <div className="mb-8">
        <h3 className="text-lg font-medium mb-4">Growth Projection</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={projectionData}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="year" 
                label={{ value: 'Years', position: 'insideBottomRight', offset: -10 }} 
              />
              <YAxis 
                tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                label={{ value: 'Portfolio Value', angle: -90, position: 'insideLeft' }} 
              />
              <Tooltip 
                formatter={(value) => formatCurrency(Number(value))} 
                labelFormatter={(label) => `Year ${label}`}
              />
              <Legend />
              {scenarios.map((scenario) => (
                <Line
                  key={scenario.name}
                  type="monotone"
                  dataKey={scenario.name}
                  stroke={scenario.color}
                  strokeWidth={selectedScenario === scenario.name ? 3 : 1.5}
                  dot={false}
                  activeDot={{ r: 8 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      
      <div>
        <h3 className="text-lg font-medium mb-4">
          {selectedScenario} Scenario Results (in {timeHorizon} years)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-slate-50 dark:bg-slate-700 rounded-lg">
            <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Future Value
            </h4>
            <p className="text-2xl font-bold">
              {formatCurrency(projectionData[timeHorizon]?.[selectedScenario] || 0)}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Not adjusted for inflation
            </p>
          </div>
          
          <div className="p-4 bg-slate-50 dark:bg-slate-700 rounded-lg">
            <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Inflation-Adjusted Value
            </h4>
            <p className="text-2xl font-bold">
              {formatCurrency(projectionData[timeHorizon]?.[`${selectedScenario} (Infl. Adj.)`] || 0)}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              In today's dollars
            </p>
          </div>
          
          <div className="p-4 bg-slate-50 dark:bg-slate-700 rounded-lg">
            <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Total Contributions
            </h4>
            <p className="text-2xl font-bold">
              {formatCurrency(initialValue + (monthlyContribution * 12 * timeHorizon))}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Initial + {timeHorizon * 12} monthly deposits
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}