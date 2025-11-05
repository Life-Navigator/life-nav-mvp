import { useState } from 'react';
import { toast } from '@/components/ui/toaster';
import { calculatorApi } from '@/lib/api/calculator';
import type {
  InvestmentGrowthRequest,
  ScenarioComparisonRequest,
  AssetAllocationRequest,
  LumpSumVsDcaRequest,
  InvestmentCalculatorResults
} from '@/types/calculator';

/**
 * Custom hook for investment calculator functionality
 * Provides methods for calculating investment growth, comparing scenarios,
 * calculating asset allocation, and optimizing lump sum vs DCA strategies
 */
export function useInvestmentCalculator() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [results, setResults] = useState<InvestmentCalculatorResults | null>(null);

  /**
   * Calculate investment growth based on provided parameters
   */
  const calculateInvestmentGrowth = async (data: InvestmentGrowthRequest) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await calculatorApi.calculateInvestmentGrowth(data);
      
      setResults(prevResults => ({
        ...prevResults,
        investment_growth: response
      }));
      
      return response;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to calculate investment growth');
      setError(error);
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Compare multiple investment scenarios
   */
  const compareInvestmentScenarios = async (data: ScenarioComparisonRequest) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await calculatorApi.compareInvestmentScenarios(data);
      
      setResults(prevResults => ({
        ...prevResults,
        scenario_comparison: response
      }));
      
      return response;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to compare investment scenarios');
      setError(error);
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Calculate recommended asset allocation based on risk profile and age
   */
  const calculateAssetAllocation = async (data: AssetAllocationRequest) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await calculatorApi.calculateAssetAllocation(data);
      
      setResults(prevResults => ({
        ...prevResults,
        asset_allocation: response
      }));
      
      return response;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to calculate asset allocation');
      setError(error);
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Compare lump sum vs dollar cost averaging investment strategies
   */
  const optimizeLumpSumVsDca = async (data: LumpSumVsDcaRequest) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await calculatorApi.optimizeLumpSumVsDca(data);
      
      setResults(prevResults => ({
        ...prevResults,
        lump_sum_dca: response
      }));
      
      return response;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to optimize lump sum vs DCA');
      setError(error);
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Get historical returns data for different asset classes
   */
  const getHistoricalReturns = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await calculatorApi.getHistoricalReturns();
      
      setResults(prevResults => ({
        ...prevResults,
        historical_returns: response
      }));
      
      return response;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to get historical returns');
      setError(error);
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Reset all calculator results
   */
  const resetResults = () => {
    setResults(null);
    setError(null);
  };

  /**
   * Reset specific calculator results by type
   */
  const resetResultsByType = (type: keyof InvestmentCalculatorResults) => {
    if (!results) return;
    
    const newResults = { ...results };
    delete newResults[type];
    setResults(newResults);
  };

  return {
    isLoading,
    error,
    results,
    calculateInvestmentGrowth,
    compareInvestmentScenarios,
    calculateAssetAllocation,
    optimizeLumpSumVsDca,
    getHistoricalReturns,
    resetResults,
    resetResultsByType
  };
}