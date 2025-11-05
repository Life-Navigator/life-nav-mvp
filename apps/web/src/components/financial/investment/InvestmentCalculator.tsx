import React, { useState, useEffect } from 'react';
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { exportToPdf, exportToCsv } from '@/lib/utils/export-utils';
import { CalculatorType } from '@/lib/utils/calculator-storage';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  ReferenceLine,
} from 'recharts';
import { toast } from '@/components/ui/toaster';
import { useInvestmentCalculatorWithCache } from '@/hooks/useInvestmentCalculatorWithCache';

// Enum types
enum ContributionFrequency {
  WEEKLY = "weekly",
  BI_WEEKLY = "bi_weekly",
  MONTHLY = "monthly",
  QUARTERLY = "quarterly",
  ANNUALLY = "annually",
  ONE_TIME = "one_time"
}

enum RiskLevel {
  CONSERVATIVE = "conservative",
  MODERATELY_CONSERVATIVE = "moderately_conservative",
  MODERATE = "moderate",
  MODERATELY_AGGRESSIVE = "moderately_aggressive",
  AGGRESSIVE = "aggressive"
}

// Component
const InvestmentCalculator: React.FC = () => {
  // State for saved calculations
  const [savedCalculations, setSavedCalculations] = useState<any[]>([]);
  const [loadDialogOpen, setLoadDialogOpen] = useState(false);
  
  // Load saved calculations on component mount
  useEffect(() => {
    const calculations = loadSavedCalculations();
    setSavedCalculations(calculations);
  }, []);
  // Investment form state
  const [formData, setFormData] = useState({
    name: "Investment Scenario",
    initial_investment: 10000,
    annual_return_rate: 7.0,
    volatility: 12.0,
    inflation_rate: 2.5,
    fee_percentage: 0.5,
    tax_rate: 0.0,
    time_horizon_years: 20,
    contribution_amount: 500,
    contribution_frequency: ContributionFrequency.MONTHLY,
    contribution_growth_rate: 2.0,
    include_monthly_detail: false,
    include_monte_carlo: true,
    simulation_runs: 1000,
  });

  // Asset allocation state
  const [allocationData, setAllocationData] = useState({
    risk_level: RiskLevel.MODERATE,
    age: 35,
    time_horizon_years: 20,
    customize_allocation: false,
    custom_stock_percentage: 60,
  });

  // Lump sum vs. DCA state
  const [lumpSumData, setLumpSumData] = useState({
    total_amount: 50000,
    time_horizon_years: 10,
    risk_level: RiskLevel.MODERATE,
    dca_periods: 12,
    expected_return_rate: null,
  });

  // State for active tab
  const [activeTab, setActiveTab] = useState("growth");
  
  // State for active inner tab
  const [activeInnerTab, setActiveInnerTab] = useState("input");

  // Use the enhanced investment calculator hook with caching
  const {
    // Core API-compatible functions
    calculateInvestmentGrowth,
    calculateAssetAllocation,
    optimizeLumpSumVsDca,
    compareInvestmentScenarios,
    getHistoricalReturns,
    
    // React Query hooks (can be used for more declarative code)
    useInvestmentGrowth,
    useAssetAllocation,
    useLumpSumVsDca,
    
    // Prefetching capabilities
    prefetchInvestmentGrowth,
    
    // State
    isLoading,
    results,
  } = useInvestmentCalculatorWithCache();
  
  // Use the React Query hooks for the current active tab data
  const investmentGrowthQuery = useInvestmentGrowth(
    activeTab === "growth" ? formData : undefined, 
    activeTab === "growth" && activeInnerTab === "results"
  );
  
  const assetAllocationQuery = useAssetAllocation(
    activeTab === "allocation" ? allocationData : undefined,
    activeTab === "allocation" && activeInnerTab === "results"
  );
  
  const lumpSumQuery = useLumpSumVsDca(
    activeTab === "lump_sum" ? lumpSumData : undefined,
    activeTab === "lump_sum" && activeInnerTab === "results"
  );

  // Handle investment form changes with debounced prefetching
  const handleInvestmentChange = (field: string, value: any) => {
    setFormData(prev => {
      const newData = {
        ...prev,
        [field]: value
      };
      
      // Prefetch results if the change is significant enough
      // This helps to have data ready when the user clicks "Calculate"
      const significantFields = ['initial_investment', 'annual_return_rate', 'time_horizon_years'];
      if (significantFields.includes(field) && activeTab === "growth") {
        // Debounce the prefetch to avoid too many API calls
        const timer = setTimeout(() => {
          prefetchInvestmentGrowth(newData);
        }, 1000); // 1 second debounce
        
        return () => clearTimeout(timer);
      }
      
      return newData;
    });
  };
  
  // Save the current calculation to browser storage
  const saveCurrentCalculation = () => {
    const calculationType = activeTab;
    const calculationData = {
      tab: activeTab,
      formData: activeTab === "growth" ? formData : undefined,
      allocationData: activeTab === "allocation" ? allocationData : undefined,
      lumpSumData: activeTab === "lump_sum" ? lumpSumData : undefined,
      results: results
    };
    
    // Generate a unique name based on the current date/time if not provided
    const name = `${activeTab.replace('_', ' ')} - ${new Date().toLocaleString()}`;
    
    // Save to localStorage
    try {
      // Get existing saved calculations
      const savedCalculationsStr = localStorage.getItem('ln_saved_calculations');
      const savedCalculations = savedCalculationsStr 
        ? JSON.parse(savedCalculationsStr) 
        : [];
      
      // Add the new calculation
      savedCalculations.push({
        id: Date.now().toString(),
        name,
        type: calculationType,
        data: calculationData,
        timestamp: Date.now()
      });
      
      // Trim to max 20 items
      if (savedCalculations.length > 20) {
        savedCalculations.shift(); // Remove oldest
      }
      
      // Save back to localStorage
      localStorage.setItem('ln_saved_calculations', JSON.stringify(savedCalculations));
      
      toast({
        title: 'Calculation Saved',
        description: 'Your calculation has been saved for later use',
      });
      
      return true;
    } catch (error) {
      console.error('Error saving calculation:', error);
      
      toast({
        title: 'Save Failed',
        description: 'Unable to save your calculation',
        variant: 'destructive'
      });
      
      return false;
    }
  };

  // Handle asset allocation form changes
  const handleAllocationChange = (field: string, value: any) => {
    setAllocationData(prev => {
      const newData = {
        ...prev,
        [field]: value
      };
      
      return newData;
    });
  };

  // Handle lump sum form changes
  const handleLumpSumChange = (field: string, value: any) => {
    setLumpSumData(prev => {
      const newData = {
        ...prev,
        [field]: value
      };
      
      return newData;
    });
  };
  
  // Load saved calculations
  const loadSavedCalculations = () => {
    try {
      const savedCalculationsStr = localStorage.getItem('ln_saved_calculations');
      if (!savedCalculationsStr) {
        return [];
      }
      
      const savedCalculations = JSON.parse(savedCalculationsStr);
      return savedCalculations;
    } catch (error) {
      console.error('Error loading saved calculations:', error);
      return [];
    }
  };
  
  // Load a specific saved calculation
  const loadCalculation = (savedCalculation: any) => {
    try {
      const { data } = savedCalculation;
      
      // Set the active tab
      if (data.tab) {
        setActiveTab(data.tab);
      }
      
      // Load the appropriate data
      if (data.formData && data.tab === "growth") {
        setFormData(data.formData);
      }
      
      if (data.allocationData && data.tab === "allocation") {
        setAllocationData(data.allocationData);
      }
      
      if (data.lumpSumData && data.tab === "lump_sum") {
        setLumpSumData(data.lumpSumData);
      }
      
      // Set results if available
      if (data.results) {
        // The hook handles results management
        // Just trigger a recalculation
        if (data.tab === "growth" && data.formData) {
          calculateInvestmentGrowth(data.formData);
        } else if (data.tab === "allocation" && data.allocationData) {
          calculateAssetAllocation(data.allocationData);
        } else if (data.tab === "lump_sum" && data.lumpSumData) {
          optimizeLumpSumVsDca(data.lumpSumData);
        }
      }
      
      toast({
        title: 'Calculation Loaded',
        description: 'Your saved calculation has been loaded',
      });
      
      return true;
    } catch (error) {
      console.error('Error loading calculation:', error);
      
      toast({
        title: 'Load Failed',
        description: 'Unable to load your calculation',
        variant: 'destructive'
      });
      
      return false;
    }
  };

  // Handle calculate investment growth
  const handleCalculateGrowth = async () => {
    const result = await calculateInvestmentGrowth(formData);
    if (result) {
      setActiveInnerTab("results");
    }
  };

  // Handle calculate asset allocation
  const handleCalculateAllocation = async () => {
    const result = await calculateAssetAllocation(allocationData);
    if (result) {
      setActiveInnerTab("results");
    }
  };

  // Handle calculate lump sum vs. DCA
  const handleCalculateLumpSum = async () => {
    const result = await optimizeLumpSumVsDca(lumpSumData);
    if (result) {
      setActiveInnerTab("results");
    }
  };

  // Handle comparing scenarios
  const handleCompareScenarios = async () => {
    // Create different scenarios
    const scenarios = [
      {
        name: "Conservative",
        initial_investment: formData.initial_investment,
        annual_return_rate: 5.0,
        volatility: 8.0,
        inflation_rate: formData.inflation_rate,
        time_horizon_years: formData.time_horizon_years,
        contribution_amount: formData.contribution_amount,
        contribution_frequency: formData.contribution_frequency,
      },
      {
        name: "Moderate",
        initial_investment: formData.initial_investment,
        annual_return_rate: 7.0,
        volatility: 12.0,
        inflation_rate: formData.inflation_rate,
        time_horizon_years: formData.time_horizon_years,
        contribution_amount: formData.contribution_amount,
        contribution_frequency: formData.contribution_frequency,
      },
      {
        name: "Aggressive",
        initial_investment: formData.initial_investment,
        annual_return_rate: 9.0,
        volatility: 16.0,
        inflation_rate: formData.inflation_rate,
        time_horizon_years: formData.time_horizon_years,
        contribution_amount: formData.contribution_amount,
        contribution_frequency: formData.contribution_frequency,
      },
    ];
    
    const result = await compareInvestmentScenarios({ scenarios });
    if (result) {
      setActiveInnerTab("comparison");
    }
  };

  // Format currency for display
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  // Format percentage for display
  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  // Colors for charts
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#4CAF50'];

  // Get results based on active tab
  const getActiveResults = () => {
    if (!results) return null;
    
    switch (activeTab) {
      case "growth":
        return results.investment_growth;
      case "allocation":
        return results.asset_allocation;
      case "lump_sum":
        return results.lump_sum_dca;
      default:
        return null;
    }
  };

  // Format annual projection data for chart
  const getAnnualProjectionData = () => {
    const activeResults = getActiveResults();
    if (!activeResults || !activeResults.annual_projection) return [];
    
    return activeResults.annual_projection.map((year: any) => ({
      year: year.year,
      balance: year.balance,
      contribution: year.contribution,
      growth: year.growth,
      inflation_adjusted_balance: year.inflation_adjusted_balance,
    }));
  };

  // Format Monte Carlo data for chart
  const getMonteCarloData = () => {
    const activeResults = getActiveResults();
    if (!activeResults || !activeResults.monte_carlo) return null;
    
    const percentiles = activeResults.monte_carlo.percentiles;
    
    return activeResults.annual_projection.map((year: any, index: number) => ({
      year: year.year,
      "10th": percentiles["10th"][index],
      "25th": percentiles["25th"][index],
      "50th": percentiles["50th"][index],
      "75th": percentiles["75th"][index],
      "90th": percentiles["90th"][index],
      "Projected": year.balance,
    }));
  };

  // Format asset allocation data for pie chart
  const getAllocationData = () => {
    const activeResults = getActiveResults();
    if (!activeResults || !activeResults.allocation) return [];
    
    const { allocation } = activeResults;
    
    return [
      { name: 'Stocks', value: allocation.stocks },
      { name: 'Bonds', value: allocation.bonds },
      { name: 'Cash', value: allocation.cash },
      { name: 'Real Estate', value: allocation.real_estate },
      { name: 'Alternatives', value: allocation.alternatives },
    ];
  };

  // Format lump sum vs. DCA data for chart
  const getLumpSumVsDcaData = () => {
    const activeResults = getActiveResults();
    if (!activeResults) return [];
    
    const lumpSum = activeResults.lump_sum?.annual_projection || [];
    const dca = activeResults.dollar_cost_averaging?.annual_projection || [];
    const partial = activeResults.partial_lump_sum_dca?.annual_projection || [];
    
    // Combine the data
    return lumpSum.map((year: any, index: number) => ({
      year: year.year,
      "Lump Sum": year.balance,
      "DCA": dca[index]?.balance || 0,
      "Partial": partial[index]?.balance || 0,
    }));
  };

  // Handle saving the current calculation
  const handleSaveCalculation = () => {
    saveCurrentCalculation();
    // Refresh the saved calculations list
    setSavedCalculations(loadSavedCalculations());
  };
  
  // Handle loading a saved calculation
  const handleLoadCalculation = (calculation: any) => {
    loadCalculation(calculation);
    setLoadDialogOpen(false);
  };
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Investment Calculator</h1>
        
        <div className="flex space-x-2">
          {/* Save button */}
          <Button 
            onClick={handleSaveCalculation}
            variant="outline"
            disabled={!results}
            title={!results ? "Calculate first to save" : "Save calculation"}
          >
            Save
          </Button>
          
          {/* Load dialog */}
          <Dialog open={loadDialogOpen} onOpenChange={setLoadDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                variant="outline"
                disabled={savedCalculations.length === 0}
                title={savedCalculations.length === 0 ? "No saved calculations" : "Load saved calculation"}
              >
                Load
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Saved Calculations</DialogTitle>
              </DialogHeader>
              
              {savedCalculations.length > 0 ? (
                <div className="max-h-[60vh] overflow-y-auto">
                  <div className="space-y-2">
                    {savedCalculations.map((calc) => (
                      <div 
                        key={calc.id}
                        className="p-3 border rounded hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer flex items-center justify-between"
                        onClick={() => handleLoadCalculation(calc)}
                      >
                        <div>
                          <h3 className="font-medium">{calc.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {new Date(calc.timestamp).toLocaleString()}
                          </p>
                        </div>
                        <Button size="sm" variant="ghost">Load</Button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="py-6 text-center">
                  <p className="text-muted-foreground">No saved calculations found.</p>
                </div>
              )}
              
              <div className="flex justify-end gap-2 mt-4">
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      
      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full mb-6">
          <TabsTrigger value="growth" className="flex-1">Investment Growth</TabsTrigger>
          <TabsTrigger value="allocation" className="flex-1">Asset Allocation</TabsTrigger>
          <TabsTrigger value="lump_sum" className="flex-1">Lump Sum vs. DCA</TabsTrigger>
        </TabsList>
        
        {/* Investment Growth Tab */}
        <TabsContent value="growth" className="space-y-4">
          <Tabs value={activeInnerTab} onValueChange={setActiveInnerTab} className="w-full">
            <TabsList className="w-full mb-4">
              <TabsTrigger value="input" className="flex-1">Input</TabsTrigger>
              <TabsTrigger value="results" className="flex-1" disabled={!results?.investment_growth}>Results</TabsTrigger>
              <TabsTrigger value="comparison" className="flex-1" disabled={!results?.scenario_comparison}>Comparison</TabsTrigger>
            </TabsList>
            
            {/* Investment Growth Input Tab */}
            <TabsContent value="input" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Investment Parameters</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="font-medium">Initial Investment</label>
                    <Input 
                      type="number"
                      value={formData.initial_investment}
                      onChange={(e) => handleInvestmentChange('initial_investment', Number(e.target.value))}
                      min={0}
                      step={1000}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="font-medium">Time Horizon (Years)</label>
                    <Input 
                      type="number"
                      value={formData.time_horizon_years}
                      onChange={(e) => handleInvestmentChange('time_horizon_years', Number(e.target.value))}
                      min={1}
                      max={50}
                      step={1}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="font-medium">Expected Annual Return (%)</label>
                    <Input 
                      type="number"
                      value={formData.annual_return_rate}
                      onChange={(e) => handleInvestmentChange('annual_return_rate', Number(e.target.value))}
                      min={0}
                      max={20}
                      step={0.1}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="font-medium">Inflation Rate (%)</label>
                    <Input 
                      type="number"
                      value={formData.inflation_rate}
                      onChange={(e) => handleInvestmentChange('inflation_rate', Number(e.target.value))}
                      min={0}
                      max={10}
                      step={0.1}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="font-medium">Fee Percentage (%)</label>
                    <Input 
                      type="number"
                      value={formData.fee_percentage}
                      onChange={(e) => handleInvestmentChange('fee_percentage', Number(e.target.value))}
                      min={0}
                      max={3}
                      step={0.05}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="font-medium">Volatility (%)</label>
                    <Input 
                      type="number"
                      value={formData.volatility}
                      onChange={(e) => handleInvestmentChange('volatility', Number(e.target.value))}
                      min={0}
                      max={30}
                      step={0.5}
                    />
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>Contribution Settings</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="font-medium">Contribution Amount</label>
                    <Input 
                      type="number"
                      value={formData.contribution_amount}
                      onChange={(e) => handleInvestmentChange('contribution_amount', Number(e.target.value))}
                      min={0}
                      step={100}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="font-medium">Contribution Frequency</label>
                    <Select 
                      value={formData.contribution_frequency}
                      onValueChange={(value) => handleInvestmentChange('contribution_frequency', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select frequency" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ContributionFrequency.WEEKLY}>Weekly</SelectItem>
                        <SelectItem value={ContributionFrequency.BI_WEEKLY}>Bi-Weekly</SelectItem>
                        <SelectItem value={ContributionFrequency.MONTHLY}>Monthly</SelectItem>
                        <SelectItem value={ContributionFrequency.QUARTERLY}>Quarterly</SelectItem>
                        <SelectItem value={ContributionFrequency.ANNUALLY}>Annually</SelectItem>
                        <SelectItem value={ContributionFrequency.ONE_TIME}>One-Time</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="font-medium">Annual Contribution Growth (%)</label>
                    <Input 
                      type="number"
                      value={formData.contribution_growth_rate}
                      onChange={(e) => handleInvestmentChange('contribution_growth_rate', Number(e.target.value))}
                      min={0}
                      max={10}
                      step={0.5}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="font-medium">Tax Rate (%)</label>
                    <Input 
                      type="number"
                      value={formData.tax_rate}
                      onChange={(e) => handleInvestmentChange('tax_rate', Number(e.target.value))}
                      min={0}
                      max={50}
                      step={0.5}
                    />
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>Calculation Options</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2 flex items-center">
                    <input 
                      type="checkbox"
                      id="monte-carlo"
                      checked={formData.include_monte_carlo}
                      onChange={(e) => handleInvestmentChange('include_monte_carlo', e.target.checked)}
                      className="mr-2 h-4 w-4"
                    />
                    <label htmlFor="monte-carlo" className="font-medium">Include Monte Carlo Simulation</label>
                  </div>
                  
                  <div className="space-y-2 flex items-center">
                    <input 
                      type="checkbox"
                      id="monthly-detail"
                      checked={formData.include_monthly_detail}
                      onChange={(e) => handleInvestmentChange('include_monthly_detail', e.target.checked)}
                      className="mr-2 h-4 w-4"
                    />
                    <label htmlFor="monthly-detail" className="font-medium">Include Monthly Detail</label>
                  </div>
                  
                  {formData.include_monte_carlo && (
                    <div className="space-y-2">
                      <label className="font-medium">Simulation Runs</label>
                      <Input 
                        type="number"
                        value={formData.simulation_runs}
                        onChange={(e) => handleInvestmentChange('simulation_runs', Number(e.target.value))}
                        min={100}
                        max={10000}
                        step={100}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button onClick={handleCalculateGrowth} className="w-full sm:w-auto" disabled={isLoading}>
                  {isLoading ? <LoadingSpinner size="sm" /> : "Calculate Growth"}
                </Button>
                <Button onClick={handleCompareScenarios} className="w-full sm:w-auto" variant="outline" disabled={isLoading}>
                  Compare Scenarios
                </Button>
              </div>
            </TabsContent>
            
            {/* Investment Growth Results Tab */}
            <TabsContent value="results" className="space-y-6">
              {isLoading ? (
                <div className="flex justify-center py-20">
                  <LoadingSpinner size="lg" />
                </div>
              ) : results?.investment_growth ? (
                <>
                  <Card className="bg-primary text-primary-foreground">
                    <CardContent className="pt-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                        <div>
                          <h3 className="text-sm font-medium opacity-80">Final Portfolio Value</h3>
                          <p className="text-2xl font-bold">{formatCurrency(results.investment_growth.summary.final_balance)}</p>
                        </div>
                        <div>
                          <h3 className="text-sm font-medium opacity-80">After Inflation</h3>
                          <p className="text-2xl font-bold">{formatCurrency(results.investment_growth.summary.inflation_adjusted_benefit)}</p>
                        </div>
                        <div>
                          <h3 className="text-sm font-medium opacity-80">CAGR</h3>
                          <p className="text-2xl font-bold">{formatPercent(results.investment_growth.summary.compound_annual_growth_rate)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader>
                      <CardTitle>Portfolio Growth Over Time</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[400px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                          data={getAnnualProjectionData()}
                          margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis 
                            dataKey="year" 
                            label={{ value: 'Year', position: 'insideBottom', offset: -5 }} 
                          />
                          <YAxis 
                            tickFormatter={(value) => formatCurrency(value)}
                            width={100}
                          />
                          <Tooltip 
                            formatter={(value) => [formatCurrency(value as number), "Value"]}
                            labelFormatter={(label) => `Year: ${label}`}
                          />
                          <Legend />
                          <Area 
                            type="monotone" 
                            dataKey="balance" 
                            stroke="#8884d8" 
                            fill="#8884d8" 
                            fillOpacity={0.6} 
                            name="Portfolio Value"
                          />
                          <Area 
                            type="monotone" 
                            dataKey="inflation_adjusted_balance" 
                            stroke="#82ca9d" 
                            fill="#82ca9d" 
                            fillOpacity={0.6} 
                            name="Inflation-Adjusted Value"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                  
                  {results.investment_growth.monte_carlo && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Monte Carlo Simulation</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                          <div className="text-center p-4 bg-muted rounded-lg">
                            <div className="text-sm font-medium text-muted-foreground mb-1">
                              Median Outcome
                            </div>
                            <div className="text-2xl font-bold">
                              {formatCurrency(results.investment_growth.monte_carlo.median_final_balance)}
                            </div>
                          </div>
                          
                          <div className="text-center p-4 bg-muted rounded-lg">
                            <div className="text-sm font-medium text-muted-foreground mb-1">
                              Success Probability
                            </div>
                            <div className="text-2xl font-bold">
                              {formatPercent(
                                results.investment_growth.monte_carlo.probabilities["2.0x"] || 
                                results.investment_growth.monte_carlo.probabilities["1.0x"]
                              )}
                            </div>
                          </div>
                          
                          <div className="text-center p-4 bg-muted rounded-lg">
                            <div className="text-sm font-medium text-muted-foreground mb-1">
                              Worst/Best Case
                            </div>
                            <div className="text-2xl font-bold">
                              {formatCurrency(results.investment_growth.monte_carlo.worst_case)} / {formatCurrency(results.investment_growth.monte_carlo.best_case)}
                            </div>
                          </div>
                        </div>
                        
                        <div className="h-[400px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart
                              data={getMonteCarloData()}
                              margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="year" />
                              <YAxis tickFormatter={(value) => formatCurrency(value)} />
                              <Tooltip formatter={(value) => formatCurrency(value as number)} />
                              <Legend />
                              <Area 
                                type="monotone" 
                                dataKey="90th" 
                                stackId="1" 
                                stroke="#8884d8" 
                                fill="#8884d8" 
                                fillOpacity={0.2} 
                                name="90th Percentile" 
                              />
                              <Area 
                                type="monotone" 
                                dataKey="75th" 
                                stackId="1" 
                                stroke="#82ca9d" 
                                fill="#82ca9d" 
                                fillOpacity={0.2} 
                                name="75th Percentile" 
                              />
                              <Area 
                                type="monotone" 
                                dataKey="50th" 
                                stackId="1" 
                                stroke="#ffc658" 
                                fill="#ffc658" 
                                fillOpacity={0.5} 
                                name="Median (50th)" 
                              />
                              <Area 
                                type="monotone" 
                                dataKey="25th" 
                                stackId="1" 
                                stroke="#ff7300" 
                                fill="#ff7300" 
                                fillOpacity={0.2} 
                                name="25th Percentile" 
                              />
                              <Area 
                                type="monotone" 
                                dataKey="10th" 
                                stackId="1" 
                                stroke="#ff0000" 
                                fill="#ff0000" 
                                fillOpacity={0.2} 
                                name="10th Percentile" 
                              />
                              <Line 
                                type="monotone" 
                                dataKey="Projected" 
                                stroke="#000" 
                                strokeWidth={2} 
                                dot={false} 
                                name="Projected Path" 
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                  
                  <Card>
                    <CardHeader>
                      <CardTitle>Investment Summary</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <h3 className="font-medium mb-2">Contributions</h3>
                            <div className="space-y-2">
                              <div className="flex justify-between">
                                <span>Initial Investment:</span>
                                <span className="font-medium">{formatCurrency(results.investment_growth.scenario.initial_investment)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Total Contributions:</span>
                                <span className="font-medium">{formatCurrency(results.investment_growth.summary.total_contributions)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Investment Growth:</span>
                                <span className="font-medium text-green-600">{formatCurrency(results.investment_growth.summary.investment_growth)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Total Fees:</span>
                                <span className="font-medium text-red-600">{formatCurrency(results.investment_growth.summary.total_fees)}</span>
                              </div>
                              <div className="flex justify-between pt-2 border-t">
                                <span className="font-bold">Final Balance:</span>
                                <span className="font-bold">{formatCurrency(results.investment_growth.summary.final_balance)}</span>
                              </div>
                            </div>
                          </div>
                          
                          <div>
                            <h3 className="font-medium mb-2">Performance Metrics</h3>
                            <div className="space-y-2">
                              <div className="flex justify-between">
                                <span>Compound Annual Growth Rate:</span>
                                <span className="font-medium">{formatPercent(results.investment_growth.summary.compound_annual_growth_rate)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Growth Multiple:</span>
                                <span className="font-medium">{results.investment_growth.summary.growth_multiple.toFixed(2)}x</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Real Return Rate:</span>
                                <span className="font-medium">{formatPercent(results.investment_growth.summary.real_return_rate)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Inflation-Adjusted Balance:</span>
                                <span className="font-medium">{formatCurrency(results.investment_growth.summary.inflation_adjusted_balance)}</span>
                              </div>
                              <div className="flex justify-between pt-2 border-t">
                                <span className="font-bold">Time Horizon:</span>
                                <span className="font-bold">{results.investment_growth.scenario.time_horizon_years} years</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="flex flex-col sm:flex-row justify-center gap-4">
                    <Button 
                      onClick={() => setActiveInnerTab("input")}
                      variant="outline"
                      className="w-full sm:w-auto"
                    >
                      Modify Inputs
                    </Button>
                    <Button 
                      onClick={handleCalculateGrowth}
                      className="w-full sm:w-auto"
                      disabled={isLoading}
                    >
                      Recalculate
                    </Button>
                    <Button 
                      onClick={handleCompareScenarios}
                      className="w-full sm:w-auto"
                      variant="secondary"
                      disabled={isLoading}
                    >
                      Compare Scenarios
                    </Button>
                  </div>
                </>
              ) : (
                <div className="text-center py-20">
                  <h3 className="text-xl font-medium">No calculation results yet</h3>
                  <p className="text-muted-foreground mt-2">
                    Go to the Input tab to set up your investment calculation
                  </p>
                  <Button 
                    onClick={() => setActiveInnerTab("input")}
                    variant="outline"
                    className="mt-4"
                  >
                    Go to Inputs
                  </Button>
                </div>
              )}
            </TabsContent>
            
            {/* Investment Comparison Tab */}
            <TabsContent value="comparison" className="space-y-6">
              {results?.scenario_comparison ? (
                <>
                  <Card>
                    <CardHeader>
                      <CardTitle>Investment Scenario Comparison</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[400px] mb-6">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart
                            data={results.scenario_comparison.scenarios.map((scenario: any) => ({
                              name: scenario.name,
                              "Final Balance": scenario.final_balance,
                              "Inflation Adjusted": scenario.inflation_adjusted_balance,
                              "CAGR": scenario.compound_annual_growth_rate,
                            }))}
                            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis yAxisId="left" tickFormatter={(value) => formatCurrency(value)} />
                            <YAxis yAxisId="right" orientation="right" tickFormatter={(value) => `${value}%`} />
                            <Tooltip 
                              formatter={(value, name) => {
                                if (name === "CAGR") return [`${value}%`, name];
                                return [formatCurrency(value as number), name];
                              }}
                            />
                            <Legend />
                            <Bar yAxisId="left" dataKey="Final Balance" fill="#8884d8" name="Final Balance" />
                            <Bar yAxisId="left" dataKey="Inflation Adjusted" fill="#82ca9d" name="Inflation Adjusted" />
                            <Line yAxisId="right" type="monotone" dataKey="CAGR" stroke="#ff7300" name="CAGR" />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                      
                      <div className="space-y-4">
                        <h3 className="font-medium">Scenario Details</h3>
                        <div className="overflow-x-auto">
                          <table className="min-w-full border divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Scenario
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Final Balance
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Inflation Adjusted
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Investment Growth
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  CAGR
                                </th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {results.scenario_comparison.scenarios.map((scenario: any, i: number) => (
                                <tr key={i} className={scenario.name === results.scenario_comparison.best_performing.by_inflation_adjusted ? "bg-green-50" : ""}>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                    {scenario.name}
                                    {scenario.name === results.scenario_comparison.best_performing.by_inflation_adjusted && (
                                      <span className="ml-2 text-green-600">★</span>
                                    )}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                                    {formatCurrency(scenario.final_balance)}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                                    {formatCurrency(scenario.inflation_adjusted_balance)}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                                    {formatCurrency(scenario.investment_growth)}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                                    {formatPercent(scenario.compound_annual_growth_rate)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                      
                      {/* Recommendation */}
                      <Card className="bg-primary/10 mt-6">
                        <CardHeader>
                          <CardTitle>Recommendation</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="mb-4">Based on your investment goals, we recommend the following:</p>
                          <ul className="list-disc ml-6 space-y-2">
                            <li>
                              <strong>Recommended Portfolio:</strong>{' '}
                              {results.scenario_comparison.recommendation}
                            </li>
                            <li>
                              <strong>Best for Final Balance:</strong>{' '}
                              {results.scenario_comparison.best_performing.by_final_balance}
                            </li>
                            <li>
                              <strong>Best for CAGR:</strong>{' '}
                              {results.scenario_comparison.best_performing.by_cagr}
                            </li>
                            <li>
                              <strong>Best for Inflation-Adjusted Returns:</strong>{' '}
                              {results.scenario_comparison.best_performing.by_inflation_adjusted}
                            </li>
                          </ul>
                        </CardContent>
                      </Card>
                    </CardContent>
                  </Card>
                  
                  <div className="flex flex-col sm:flex-row justify-center gap-4">
                    <Button 
                      onClick={() => setActiveInnerTab("input")}
                      variant="outline"
                      className="w-full sm:w-auto"
                    >
                      Modify Inputs
                    </Button>
                    <Button 
                      onClick={() => setActiveInnerTab("results")}
                      className="w-full sm:w-auto"
                    >
                      View Growth Results
                    </Button>
                  </div>
                </>
              ) : (
                <div className="text-center py-20">
                  <h3 className="text-xl font-medium">No comparison results yet</h3>
                  <p className="text-muted-foreground mt-2">
                    Run a comparison to see how different investment scenarios affect your returns
                  </p>
                  <Button 
                    onClick={() => setActiveInnerTab("input")}
                    variant="outline"
                    className="mt-4"
                  >
                    Go to Inputs
                  </Button>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </TabsContent>
        
        {/* Asset Allocation Tab */}
        <TabsContent value="allocation" className="space-y-4">
          <Tabs value={activeInnerTab} onValueChange={setActiveInnerTab} className="w-full">
            <TabsList className="w-full mb-4">
              <TabsTrigger value="input" className="flex-1">Input</TabsTrigger>
              <TabsTrigger value="results" className="flex-1" disabled={!results?.asset_allocation}>Results</TabsTrigger>
            </TabsList>
            
            {/* Asset Allocation Input Tab */}
            <TabsContent value="input" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Your Profile</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="font-medium">Risk Tolerance</label>
                    <Select 
                      value={allocationData.risk_level}
                      onValueChange={(value) => handleAllocationChange('risk_level', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select risk level" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={RiskLevel.CONSERVATIVE}>Conservative</SelectItem>
                        <SelectItem value={RiskLevel.MODERATELY_CONSERVATIVE}>Moderately Conservative</SelectItem>
                        <SelectItem value={RiskLevel.MODERATE}>Moderate</SelectItem>
                        <SelectItem value={RiskLevel.MODERATELY_AGGRESSIVE}>Moderately Aggressive</SelectItem>
                        <SelectItem value={RiskLevel.AGGRESSIVE}>Aggressive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="font-medium">Age</label>
                    <Input 
                      type="number"
                      value={allocationData.age}
                      onChange={(e) => handleAllocationChange('age', Number(e.target.value))}
                      min={18}
                      max={100}
                      step={1}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="font-medium">Investment Time Horizon (Years)</label>
                    <Input 
                      type="number"
                      value={allocationData.time_horizon_years}
                      onChange={(e) => handleAllocationChange('time_horizon_years', Number(e.target.value))}
                      min={1}
                      max={50}
                      step={1}
                    />
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>Custom Allocation</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2 flex items-center">
                    <input 
                      type="checkbox"
                      id="customize-allocation"
                      checked={allocationData.customize_allocation}
                      onChange={(e) => handleAllocationChange('customize_allocation', e.target.checked)}
                      className="mr-2 h-4 w-4"
                    />
                    <label htmlFor="customize-allocation" className="font-medium">Customize Asset Allocation</label>
                  </div>
                  
                  {allocationData.customize_allocation && (
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <label className="font-medium">Stock Percentage ({allocationData.custom_stock_percentage}%)</label>
                        <SliderInput 
                          value={allocationData.custom_stock_percentage}
                          onChange={(value) => handleAllocationChange('custom_stock_percentage', value)}
                          min={0}
                          max={100}
                          step={5}
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
              
              <div className="flex justify-center">
                <Button onClick={handleCalculateAllocation} disabled={isLoading}>
                  {isLoading ? <LoadingSpinner size="sm" /> : "Calculate Asset Allocation"}
                </Button>
              </div>
            </TabsContent>
            
            {/* Asset Allocation Results Tab */}
            <TabsContent value="results" className="space-y-6">
              {isLoading ? (
                <div className="flex justify-center py-20">
                  <LoadingSpinner size="lg" />
                </div>
              ) : results?.asset_allocation ? (
                <>
                  <Card className="bg-primary text-primary-foreground">
                    <CardContent className="pt-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                        <div>
                          <h3 className="text-sm font-medium opacity-80">Expected Annual Return</h3>
                          <p className="text-2xl font-bold">{formatPercent(results.asset_allocation.portfolio.expected_return)}</p>
                        </div>
                        <div>
                          <h3 className="text-sm font-medium opacity-80">Portfolio Volatility</h3>
                          <p className="text-2xl font-bold">{formatPercent(results.asset_allocation.portfolio.volatility)}</p>
                        </div>
                        <div>
                          <h3 className="text-sm font-medium opacity-80">Sharpe Ratio</h3>
                          <p className="text-2xl font-bold">{results.asset_allocation.portfolio.sharpe_ratio.toFixed(2)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader>
                      <CardTitle>Recommended Asset Allocation</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={getAllocationData()}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              outerRadius={100}
                              fill="#8884d8"
                              dataKey="value"
                              nameKey="name"
                              label={({ name, value }) => `${name}: ${value}%`}
                            >
                              {getAllocationData().map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(value) => `${value}%`} />
                            <Legend />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      
                      <div>
                        <h3 className="font-medium mb-4">Asset Class Details</h3>
                        <div className="space-y-3">
                          {Object.entries(results.asset_allocation.asset_class_metrics).map(([assetClass, metrics]: [string, any]) => (
                            <div key={assetClass} className="p-3 border rounded">
                              <div className="flex justify-between mb-1">
                                <span className="font-medium capitalize">{assetClass}:</span>
                                <span>{formatPercent(metrics.allocation_percentage)}</span>
                              </div>
                              <div className="text-sm text-muted-foreground space-y-1">
                                <div className="flex justify-between">
                                  <span>Expected Return:</span>
                                  <span>{formatPercent(metrics.expected_return)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Volatility:</span>
                                  <span>{formatPercent(metrics.volatility)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Range:</span>
                                  <span>{formatPercent(metrics.worst_year)} to {formatPercent(metrics.best_year)}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader>
                      <CardTitle>Portfolio Projection</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <h3 className="font-medium mb-2">Expected Growth</h3>
                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <span>Time Horizon:</span>
                              <span className="font-medium">{results.asset_allocation.projected_growth.years} years</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Projected Growth:</span>
                              <span className="font-medium">{formatPercent(results.asset_allocation.projected_growth.percentage)}</span>
                            </div>
                            <div className="pt-2 border-t flex justify-between">
                              <span className="font-bold">Risk Level:</span>
                              <span className="font-bold capitalize">{results.asset_allocation.portfolio.risk_level}</span>
                            </div>
                          </div>
                        </div>
                        
                        <div>
                          <h3 className="font-medium mb-2">Investment Recommendation</h3>
                          <p className="text-muted-foreground mb-2">
                            {allocationData.customize_allocation 
                              ? "Based on your custom allocation preferences" 
                              : "Based on your risk tolerance and age"}
                            , we recommend the following portfolio allocation.
                          </p>
                          <p className="text-sm">
                            This allocation balances your risk tolerance with your time horizon 
                            to provide an optimal mix of growth potential and downside protection.
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <div className="flex justify-center">
                    <Button 
                      onClick={() => setActiveInnerTab("input")}
                      variant="outline"
                      className="mr-4"
                    >
                      Modify Inputs
                    </Button>
                    <Button 
                      onClick={handleCalculateAllocation}
                      disabled={isLoading}
                    >
                      Recalculate
                    </Button>
                  </div>
                </>
              ) : (
                <div className="text-center py-20">
                  <h3 className="text-xl font-medium">No allocation results yet</h3>
                  <p className="text-muted-foreground mt-2">
                    Go to the Input tab to set up your asset allocation calculation
                  </p>
                  <Button 
                    onClick={() => setActiveInnerTab("input")}
                    variant="outline"
                    className="mt-4"
                  >
                    Go to Inputs
                  </Button>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </TabsContent>
        
        {/* Lump Sum vs. DCA Tab */}
        <TabsContent value="lump_sum" className="space-y-4">
          <Tabs value={activeInnerTab} onValueChange={setActiveInnerTab} className="w-full">
            <TabsList className="w-full mb-4">
              <TabsTrigger value="input" className="flex-1">Input</TabsTrigger>
              <TabsTrigger value="results" className="flex-1" disabled={!results?.lump_sum_dca}>Results</TabsTrigger>
            </TabsList>
            
            {/* Lump Sum vs. DCA Input Tab */}
            <TabsContent value="input" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Investment Parameters</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="font-medium">Total Investment Amount</label>
                    <Input 
                      type="number"
                      value={lumpSumData.total_amount}
                      onChange={(e) => handleLumpSumChange('total_amount', Number(e.target.value))}
                      min={1000}
                      step={1000}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="font-medium">Time Horizon (Years)</label>
                    <Input 
                      type="number"
                      value={lumpSumData.time_horizon_years}
                      onChange={(e) => handleLumpSumChange('time_horizon_years', Number(e.target.value))}
                      min={1}
                      max={50}
                      step={1}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="font-medium">Risk Tolerance</label>
                    <Select 
                      value={lumpSumData.risk_level}
                      onValueChange={(value) => handleLumpSumChange('risk_level', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select risk level" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={RiskLevel.CONSERVATIVE}>Conservative</SelectItem>
                        <SelectItem value={RiskLevel.MODERATELY_CONSERVATIVE}>Moderately Conservative</SelectItem>
                        <SelectItem value={RiskLevel.MODERATE}>Moderate</SelectItem>
                        <SelectItem value={RiskLevel.MODERATELY_AGGRESSIVE}>Moderately Aggressive</SelectItem>
                        <SelectItem value={RiskLevel.AGGRESSIVE}>Aggressive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="font-medium">Dollar-Cost Averaging Periods</label>
                    <Input 
                      type="number"
                      value={lumpSumData.dca_periods}
                      onChange={(e) => handleLumpSumChange('dca_periods', Number(e.target.value))}
                      min={3}
                      max={36}
                      step={1}
                    />
                    <p className="text-xs text-muted-foreground">
                      Number of months to spread your investment
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="font-medium">Expected Annual Return (%) - Optional</label>
                    <Input 
                      type="number"
                      value={lumpSumData.expected_return_rate === null ? '' : lumpSumData.expected_return_rate}
                      onChange={(e) => handleLumpSumChange('expected_return_rate', e.target.value === '' ? null : Number(e.target.value))}
                      min={0}
                      max={20}
                      step={0.5}
                      placeholder="Uses risk level if not specified"
                    />
                  </div>
                </CardContent>
              </Card>
              
              <div className="flex justify-center">
                <Button onClick={handleCalculateLumpSum} disabled={isLoading}>
                  {isLoading ? <LoadingSpinner size="sm" /> : "Compare Strategies"}
                </Button>
              </div>
            </TabsContent>
            
            {/* Lump Sum vs. DCA Results Tab */}
            <TabsContent value="results" className="space-y-6">
              {isLoading ? (
                <div className="flex justify-center py-20">
                  <LoadingSpinner size="lg" />
                </div>
              ) : results?.lump_sum_dca ? (
                <>
                  <Card className="bg-primary text-primary-foreground">
                    <CardContent className="pt-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                        <div>
                          <h3 className="text-sm font-medium opacity-80">Best Strategy</h3>
                          <p className="text-2xl font-bold">{results.lump_sum_dca.comparison.best_strategy}</p>
                        </div>
                        <div>
                          <h3 className="text-sm font-medium opacity-80">Expected Annual Return</h3>
                          <p className="text-2xl font-bold">{formatPercent(results.lump_sum_dca.expected_annual_return)}</p>
                        </div>
                        <div>
                          <h3 className="text-sm font-medium opacity-80">Total Amount</h3>
                          <p className="text-2xl font-bold">{formatCurrency(results.lump_sum_dca.total_amount)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader>
                      <CardTitle>Strategy Growth Comparison</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[400px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={getLumpSumVsDcaData()}
                          margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis 
                            dataKey="year" 
                            label={{ value: 'Year', position: 'insideBottom', offset: -5 }} 
                          />
                          <YAxis 
                            tickFormatter={(value) => formatCurrency(value)}
                            width={100}
                          />
                          <Tooltip 
                            formatter={(value) => [formatCurrency(value as number), ""]}
                            labelFormatter={(label) => `Year: ${label}`}
                          />
                          <Legend />
                          <Line 
                            type="monotone" 
                            dataKey="Lump Sum" 
                            stroke="#8884d8" 
                            strokeWidth={2} 
                            dot={false} 
                          />
                          <Line 
                            type="monotone" 
                            dataKey="DCA" 
                            stroke="#82ca9d" 
                            strokeWidth={2} 
                            dot={false} 
                          />
                          <Line 
                            type="monotone" 
                            dataKey="Partial" 
                            stroke="#ffc658" 
                            strokeWidth={2} 
                            dot={false} 
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader>
                      <CardTitle>Strategy Comparison</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <table className="min-w-full border divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Strategy
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Investment Approach
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Final Balance
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Growth Amount
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Growth Percentage
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            <tr className={results.lump_sum_dca.comparison.best_strategy === "Lump Sum" ? "bg-green-50" : ""}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                Lump Sum
                                {results.lump_sum_dca.comparison.best_strategy === "Lump Sum" && (
                                  <span className="ml-2 text-green-600">★</span>
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm">
                                Invest entire amount immediately
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm">
                                {formatCurrency(results.lump_sum_dca.lump_sum.final_balance)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm">
                                {formatCurrency(results.lump_sum_dca.lump_sum.growth_amount)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm">
                                {formatPercent(results.lump_sum_dca.lump_sum.growth_percentage)}
                              </td>
                            </tr>
                            <tr className={results.lump_sum_dca.comparison.best_strategy === "Dollar Cost Averaging" ? "bg-green-50" : ""}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                Dollar Cost Averaging
                                {results.lump_sum_dca.comparison.best_strategy === "Dollar Cost Averaging" && (
                                  <span className="ml-2 text-green-600">★</span>
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm">
                                {formatCurrency(results.lump_sum_dca.dollar_cost_averaging.period_investment)} monthly for {results.lump_sum_dca.dca_periods} months
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm">
                                {formatCurrency(results.lump_sum_dca.dollar_cost_averaging.final_balance)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm">
                                {formatCurrency(results.lump_sum_dca.dollar_cost_averaging.growth_amount)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm">
                                {formatPercent(results.lump_sum_dca.dollar_cost_averaging.growth_percentage)}
                              </td>
                            </tr>
                            <tr className={results.lump_sum_dca.comparison.best_strategy === "Partial Lump Sum + DCA" ? "bg-green-50" : ""}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                Partial Lump Sum + DCA
                                {results.lump_sum_dca.comparison.best_strategy === "Partial Lump Sum + DCA" && (
                                  <span className="ml-2 text-green-600">★</span>
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm">
                                {formatCurrency(results.lump_sum_dca.partial_lump_sum_dca.initial_investment)} now + {formatCurrency(results.lump_sum_dca.partial_lump_sum_dca.period_investment)} monthly
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm">
                                {formatCurrency(results.lump_sum_dca.partial_lump_sum_dca.final_balance)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm">
                                {formatCurrency(results.lump_sum_dca.partial_lump_sum_dca.growth_amount)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm">
                                {formatPercent(results.lump_sum_dca.partial_lump_sum_dca.growth_percentage)}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                  
                  {/* Recommendation */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Strategy Recommendation</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <h3 className="font-medium mb-2">Performance Comparison</h3>
                          <p className="text-sm text-muted-foreground mb-3">
                            {results.lump_sum_dca.comparison.lump_sum_vs_dca > 0 
                              ? `Lump sum investing outperforms DCA by ${formatCurrency(results.lump_sum_dca.comparison.lump_sum_vs_dca)} (${formatPercent(results.lump_sum_dca.comparison.lump_sum_vs_dca_percentage)}).`
                              : `DCA outperforms lump sum investing by ${formatCurrency(Math.abs(results.lump_sum_dca.comparison.lump_sum_vs_dca))} (${formatPercent(Math.abs(results.lump_sum_dca.comparison.lump_sum_vs_dca_percentage))}).`
                            }
                          </p>
                          <p className="text-sm">
                            Historically, lump sum investing outperforms DCA about 2/3 of the time in rising markets, 
                            but DCA can reduce risk during market downturns.
                          </p>
                        </div>
                        
                        <div>
                          <h3 className="font-medium mb-2">Personalized Recommendation</h3>
                          <div className="p-4 bg-primary/10 rounded-lg">
                            <p className="mb-2">
                              <strong>Recommended Strategy: {results.lump_sum_dca.comparison.best_strategy}</strong>
                            </p>
                            <p className="text-sm mb-2">
                              {results.lump_sum_dca.strategy_recommendation}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Risk Level: <span className="capitalize">{results.lump_sum_dca.risk_considerations.risk_level}</span>
                            </p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <div className="flex justify-center">
                    <Button 
                      onClick={() => setActiveInnerTab("input")}
                      variant="outline"
                      className="mr-4"
                    >
                      Modify Inputs
                    </Button>
                    <Button 
                      onClick={handleCalculateLumpSum}
                      disabled={isLoading}
                    >
                      Recalculate
                    </Button>
                  </div>
                </>
              ) : (
                <div className="text-center py-20">
                  <h3 className="text-xl font-medium">No comparison results yet</h3>
                  <p className="text-muted-foreground mt-2">
                    Go to the Input tab to set up your lump sum vs. DCA comparison
                  </p>
                  <Button 
                    onClick={() => setActiveInnerTab("input")}
                    variant="outline"
                    className="mt-4"
                  >
                    Go to Inputs
                  </Button>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default InvestmentCalculator;