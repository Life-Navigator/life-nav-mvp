'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/cards/Card';
import { Button } from '@/components/ui/buttons/Button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/forms/Select';
import { Input } from '@/components/ui/forms/Input';
import { SliderInput } from '@/components/ui/forms/SliderInput';
import { LoadingSpinner } from '@/components/ui/loaders/LoadingSpinner';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
  BarChart,
  Bar,
  ReferenceLine,
} from 'recharts';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/components/ui/toaster';
import { useRetirementCalculator } from '@/hooks/useRetirementCalculator';

// Enum types from backend 
enum ContributionFrequency {
  WEEKLY = "weekly",
  BI_WEEKLY = "bi_weekly",
  MONTHLY = "monthly",
  QUARTERLY = "quarterly",
  ANNUALLY = "annually"
}

enum IncreaseType {
  FLAT = "flat",
  PERCENTAGE = "percentage",
  NONE = "none"
}

// Interface for contribution strategy
interface ContributionStrategy {
  name: string;
  initialAmount: number;
  frequency: ContributionFrequency;
  increaseType: IncreaseType;
  annualIncreaseAmount: number;
  annualIncreasePercentage: number;
  maxContributionLimit?: number;
  startAge?: number;
  endAge?: number;
}

// Interface for calculator configuration
interface CalculatorConfig {
  currentAge: number;
  retirementAge: number;
  lifeExpectancy: number;
  currentSavings: number;
  currentAnnualIncome: number;
  expectedIncomeGrowthRate: number;
  expectedInflationRate: number;
  desiredIncomeReplacementRate: number;
  safeWithdrawalRate: number;
  socialSecurityBenefit?: number;
  socialSecurityStartAge?: number;
  pensionBenefit?: number;
  pensionStartAge?: number;
}

// Main component
const RetirementCalculator: React.FC = () => {
  // State for calculator configuration
  const [config, setConfig] = useState<CalculatorConfig>({
    currentAge: 35,
    retirementAge: 65,
    lifeExpectancy: 90,
    currentSavings: 100000,
    currentAnnualIncome: 75000,
    expectedIncomeGrowthRate: 2.0,
    expectedInflationRate: 2.5,
    desiredIncomeReplacementRate: 80.0,
    safeWithdrawalRate: 4.0,
    socialSecurityStartAge: 67,
    pensionStartAge: 65,
  });

  // State for contribution strategies
  const [strategies, setStrategies] = useState<ContributionStrategy[]>([
    {
      name: "Primary Retirement",
      initialAmount: 500,
      frequency: ContributionFrequency.MONTHLY,
      increaseType: IncreaseType.PERCENTAGE,
      annualIncreaseAmount: 0,
      annualIncreasePercentage: 2.0,
    }
  ]);

  // State for active tab
  const [activeTab, setActiveTab] = useState("input");

  // Use the retirement calculator hook
  const { 
    calculateRetirement, 
    isLoading, 
    results, 
    calculateQuickRetirement
  } = useRetirementCalculator();

  // Function to handle config changes
  const handleConfigChange = (field: keyof CalculatorConfig, value: any) => {
    setConfig(prevConfig => ({
      ...prevConfig,
      [field]: value
    }));
  };

  // Function to handle strategy changes
  const handleStrategyChange = (index: number, field: keyof ContributionStrategy, value: any) => {
    setStrategies(prevStrategies => {
      const newStrategies = [...prevStrategies];
      newStrategies[index] = {
        ...newStrategies[index],
        [field]: value
      };
      return newStrategies;
    });
  };

  // Function to add a new strategy
  const addStrategy = () => {
    setStrategies(prevStrategies => [
      ...prevStrategies,
      {
        name: `Strategy ${prevStrategies.length + 1}`,
        initialAmount: 200,
        frequency: ContributionFrequency.MONTHLY,
        increaseType: IncreaseType.NONE,
        annualIncreaseAmount: 0,
        annualIncreasePercentage: 0,
      }
    ]);
  };

  // Function to remove a strategy
  const removeStrategy = (index: number) => {
    if (strategies.length > 1) {
      setStrategies(prevStrategies => prevStrategies.filter((_, i) => i !== index));
    } else {
      toast({
        title: "Error",
        description: "You must have at least one contribution strategy",
        variant: "destructive"
      });
    }
  };

  // Function to handle quick calculation
  const handleQuickCalculation = () => {
    calculateQuickRetirement({
      current_age: config.currentAge,
      retirement_age: config.retirementAge,
      current_savings: config.currentSavings,
      monthly_contribution: strategies[0].initialAmount,
      current_annual_income: config.currentAnnualIncome
    });
    setActiveTab("results");
  };

  // Function to handle detailed calculation
  const handleDetailedCalculation = () => {
    // Transform data to match API expectations
    const formattedStrategies = strategies.map(strategy => ({
      name: strategy.name,
      initial_amount: strategy.initialAmount,
      frequency: strategy.frequency,
      increase_type: strategy.increaseType,
      annual_increase_amount: strategy.annualIncreaseAmount,
      annual_increase_percentage: strategy.annualIncreasePercentage,
      max_contribution_limit: strategy.maxContributionLimit,
      start_age: strategy.startAge,
      end_age: strategy.endAge,
    }));

    calculateRetirement({
      current_age: config.currentAge,
      retirement_age: config.retirementAge,
      life_expectancy: config.lifeExpectancy,
      current_savings: config.currentSavings,
      current_annual_income: config.currentAnnualIncome,
      expected_income_growth_rate: config.expectedIncomeGrowthRate,
      expected_inflation_rate: config.expectedInflationRate,
      desired_income_replacement_rate: config.desiredIncomeReplacementRate,
      safe_withdrawal_rate: config.safeWithdrawalRate,
      social_security_benefit: config.socialSecurityBenefit,
      social_security_start_age: config.socialSecurityStartAge,
      pension_benefit: config.pensionBenefit,
      pension_start_age: config.pensionStartAge,
      contribution_strategies: formattedStrategies,
      include_monte_carlo: true,
    });
    setActiveTab("results");
  };

  // Format currency for display
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Format percent for display
  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Retirement Calculator</h1>
      
      {/* Tabs for Input and Results */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full mb-6">
          <TabsTrigger value="input" className="flex-1">Input Parameters</TabsTrigger>
          <TabsTrigger value="results" className="flex-1" disabled={!results}>Results</TabsTrigger>
        </TabsList>
        
        {/* Input Tab */}
        <TabsContent value="input" className="space-y-8">
          {/* Basic Parameters */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Parameters</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="font-medium">Current Age</label>
                <Input 
                  type="number"
                  value={config.currentAge}
                  onChange={(e) => handleConfigChange('currentAge', parseInt(e.target.value))}
                  min={18}
                  max={85}
                />
              </div>
              
              <div className="space-y-2">
                <label className="font-medium">Retirement Age</label>
                <Input 
                  type="number"
                  value={config.retirementAge}
                  onChange={(e) => handleConfigChange('retirementAge', parseInt(e.target.value))}
                  min={config.currentAge + 1}
                  max={90}
                />
              </div>
              
              <div className="space-y-2">
                <label className="font-medium">Life Expectancy</label>
                <Input 
                  type="number"
                  value={config.lifeExpectancy}
                  onChange={(e) => handleConfigChange('lifeExpectancy', parseInt(e.target.value))}
                  min={config.retirementAge + 1}
                  max={110}
                />
              </div>
              
              <div className="space-y-2">
                <label className="font-medium">Current Retirement Savings</label>
                <Input 
                  type="number"
                  value={config.currentSavings}
                  onChange={(e) => handleConfigChange('currentSavings', parseFloat(e.target.value))}
                  min={0}
                  step={1000}
                />
              </div>
              
              <div className="space-y-2">
                <label className="font-medium">Current Annual Income</label>
                <Input 
                  type="number"
                  value={config.currentAnnualIncome}
                  onChange={(e) => handleConfigChange('currentAnnualIncome', parseFloat(e.target.value))}
                  min={0}
                  step={1000}
                />
              </div>
              
              <div className="space-y-2">
                <label className="font-medium">Desired Income Replacement (%)</label>
                <SliderInput 
                  value={config.desiredIncomeReplacementRate}
                  onChange={(value) => handleConfigChange('desiredIncomeReplacementRate', value)}
                  min={30}
                  max={100}
                  step={5}
                />
              </div>
            </CardContent>
          </Card>
          
          {/* Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button onClick={handleQuickCalculation} className="w-full sm:w-auto">
              Quick Calculate
            </Button>
            <Button onClick={handleDetailedCalculation} className="w-full sm:w-auto" variant="default">
              Run Detailed Calculation
            </Button>
          </div>
        </TabsContent>
        
        {/* Results Tab */}
        <TabsContent value="results" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Coming Soon</CardTitle>
            </CardHeader>
            <CardContent>
              <p>The detailed calculation feature is coming soon.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default RetirementCalculator;