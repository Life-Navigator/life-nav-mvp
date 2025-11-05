import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ui/toaster';
import { calculatorApi } from '@/lib/api/calculator';
import type {
  InvestmentGrowthRequest,
  ScenarioComparisonRequest,
  AssetAllocationRequest,
  LumpSumVsDcaRequest,
  InvestmentCalculatorResults,
  InvestmentGrowthResponse,
  ScenarioComparisonResult,
  AssetAllocationResponse,
  LumpSumVsDcaResponse,
  HistoricalReturnsResponse
} from '@/types/calculator';
import { useState } from 'react';

// Cache keys
export const CACHE_KEYS = {
  INVESTMENT_GROWTH: 'investment-growth',
  SCENARIO_COMPARISON: 'scenario-comparison',
  ASSET_ALLOCATION: 'asset-allocation',
  LUMP_SUM_VS_DCA: 'lump-sum-vs-dca',
  HISTORICAL_RETURNS: 'historical-returns',
};

// Helper to generate a stable cache key from request parameters
const generateCacheKey = (prefix: string, params: any) => {
  // Sort keys to ensure same object produces same key regardless of property order
  const orderedParams = Object.keys(params)
    .sort()
    .reduce((obj: Record<string, any>, key) => {
      // Skip undefined values and functions
      if (params[key] !== undefined && typeof params[key] !== 'function') {
        obj[key] = params[key];
      }
      return obj;
    }, {});
  
  return [prefix, JSON.stringify(orderedParams)];
};

/**
 * Enhanced Investment Calculator hook with caching
 * Uses React Query for efficient caching and request management
 */
export function useInvestmentCalculatorWithCache() {
  const queryClient = useQueryClient();
  const [results, setResults] = useState<InvestmentCalculatorResults | null>(null);

  /**
   * Calculate investment growth with caching
   */
  const useInvestmentGrowth = (params: InvestmentGrowthRequest, enabled = true) => {
    return useQuery({
      queryKey: generateCacheKey(CACHE_KEYS.INVESTMENT_GROWTH, params),
      queryFn: () => calculatorApi.calculateInvestmentGrowth(params),
      enabled,
      staleTime: 1000 * 60 * 15, // 15 minutes
      gcTime: 1000 * 60 * 60 * 24, // 24 hours
      onSuccess: (data) => {
        setResults(prevResults => ({
          ...prevResults,
          investment_growth: data
        }));
      },
      onError: (error: any) => {
        toast({
          title: 'Error',
          description: error?.message || 'Failed to calculate investment growth',
          variant: 'destructive'
        });
      }
    });
  };

  /**
   * Mutation for calculating investment growth
   * Use this for calculations that should not be cached
   */
  const investmentGrowthMutation = useMutation({
    mutationFn: (data: InvestmentGrowthRequest) => 
      calculatorApi.calculateInvestmentGrowth(data),
    onSuccess: (data) => {
      setResults(prevResults => ({
        ...prevResults,
        investment_growth: data
      }));
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error?.message || 'Failed to calculate investment growth',
        variant: 'destructive'
      });
    }
  });

  /**
   * Compare investment scenarios with caching
   */
  const useScenarioComparison = (params: ScenarioComparisonRequest, enabled = true) => {
    return useQuery({
      queryKey: generateCacheKey(CACHE_KEYS.SCENARIO_COMPARISON, params),
      queryFn: () => calculatorApi.compareInvestmentScenarios(params),
      enabled,
      staleTime: 1000 * 60 * 15, // 15 minutes
      gcTime: 1000 * 60 * 60 * 24, // 24 hours
      onSuccess: (data) => {
        setResults(prevResults => ({
          ...prevResults,
          scenario_comparison: data
        }));
      },
      onError: (error: any) => {
        toast({
          title: 'Error',
          description: error?.message || 'Failed to compare investment scenarios',
          variant: 'destructive'
        });
      }
    });
  };

  /**
   * Calculate asset allocation with caching
   */
  const useAssetAllocation = (params: AssetAllocationRequest, enabled = true) => {
    return useQuery({
      queryKey: generateCacheKey(CACHE_KEYS.ASSET_ALLOCATION, params),
      queryFn: () => calculatorApi.calculateAssetAllocation(params),
      enabled,
      staleTime: 1000 * 60 * 15, // 15 minutes
      gcTime: 1000 * 60 * 60 * 24, // 24 hours
      onSuccess: (data) => {
        setResults(prevResults => ({
          ...prevResults,
          asset_allocation: data
        }));
      },
      onError: (error: any) => {
        toast({
          title: 'Error',
          description: error?.message || 'Failed to calculate asset allocation',
          variant: 'destructive'
        });
      }
    });
  };

  /**
   * Compare lump sum vs dollar cost averaging with caching
   */
  const useLumpSumVsDca = (params: LumpSumVsDcaRequest, enabled = true) => {
    return useQuery({
      queryKey: generateCacheKey(CACHE_KEYS.LUMP_SUM_VS_DCA, params),
      queryFn: () => calculatorApi.optimizeLumpSumVsDca(params),
      enabled,
      staleTime: 1000 * 60 * 15, // 15 minutes
      gcTime: 1000 * 60 * 60 * 24, // 24 hours
      onSuccess: (data) => {
        setResults(prevResults => ({
          ...prevResults,
          lump_sum_dca: data
        }));
      },
      onError: (error: any) => {
        toast({
          title: 'Error',
          description: error?.message || 'Failed to optimize lump sum vs DCA',
          variant: 'destructive'
        });
      }
    });
  };

  /**
   * Get historical returns with caching
   */
  const useHistoricalReturns = (enabled = true) => {
    return useQuery({
      queryKey: [CACHE_KEYS.HISTORICAL_RETURNS],
      queryFn: () => calculatorApi.getHistoricalReturns(),
      enabled,
      staleTime: 1000 * 60 * 60 * 24, // 24 hours (this data changes less frequently)
      gcTime: 1000 * 60 * 60 * 24 * 7, // 7 days
      onSuccess: (data) => {
        setResults(prevResults => ({
          ...prevResults,
          historical_returns: data
        }));
      },
      onError: (error: any) => {
        toast({
          title: 'Error',
          description: error?.message || 'Failed to get historical returns',
          variant: 'destructive'
        });
      }
    });
  };

  /**
   * Prefetch calculation results for improved UX
   * Call this function when you anticipate the user will need these results soon
   */
  const prefetchInvestmentGrowth = async (params: InvestmentGrowthRequest) => {
    await queryClient.prefetchQuery({
      queryKey: generateCacheKey(CACHE_KEYS.INVESTMENT_GROWTH, params),
      queryFn: () => calculatorApi.calculateInvestmentGrowth(params),
      staleTime: 1000 * 60 * 15, // 15 minutes
    });
  };

  /**
   * Prefetch scenario comparison results
   */
  const prefetchScenarioComparison = async (params: ScenarioComparisonRequest) => {
    await queryClient.prefetchQuery({
      queryKey: generateCacheKey(CACHE_KEYS.SCENARIO_COMPARISON, params),
      queryFn: () => calculatorApi.compareInvestmentScenarios(params),
      staleTime: 1000 * 60 * 15, // 15 minutes
    });
  };

  /**
   * Invalidate cached data for a specific calculation type
   */
  const invalidateCache = async (cacheKey: string) => {
    await queryClient.invalidateQueries({ queryKey: [cacheKey] });
  };

  /**
   * Remove specific calculation from cache
   */
  const removeFromCache = (cacheKey: string, params?: any) => {
    const queryKey = params 
      ? generateCacheKey(cacheKey, params)
      : [cacheKey];
    
    queryClient.removeQueries({ queryKey });
  };

  /**
   * Reset all calculator results state
   */
  const resetResults = () => {
    setResults(null);
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

  // Expose conventional functions for backward compatibility
  const calculateInvestmentGrowth = async (data: InvestmentGrowthRequest) => {
    try {
      // Try to get from cache first
      const cachedData = queryClient.getQueryData<InvestmentGrowthResponse>(
        generateCacheKey(CACHE_KEYS.INVESTMENT_GROWTH, data)
      );
      
      if (cachedData) {
        setResults(prev => ({
          ...prev,
          investment_growth: cachedData
        }));
        return cachedData;
      }
      
      // Not in cache, perform mutation
      const result = await investmentGrowthMutation.mutateAsync(data);
      return result;
    } catch (error) {
      return null;
    }
  };

  // Similar patterns for other calculators to maintain API compatibility
  const compareInvestmentScenarios = async (data: ScenarioComparisonRequest) => {
    try {
      const result = await calculatorApi.compareInvestmentScenarios(data);
      setResults(prev => ({
        ...prev,
        scenario_comparison: result
      }));
      return result;
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to compare scenarios',
        variant: 'destructive'
      });
      return null;
    }
  };

  const calculateAssetAllocation = async (data: AssetAllocationRequest) => {
    try {
      const result = await calculatorApi.calculateAssetAllocation(data);
      setResults(prev => ({
        ...prev,
        asset_allocation: result
      }));
      return result;
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to calculate asset allocation',
        variant: 'destructive'
      });
      return null;
    }
  };

  const optimizeLumpSumVsDca = async (data: LumpSumVsDcaRequest) => {
    try {
      const result = await calculatorApi.optimizeLumpSumVsDca(data);
      setResults(prev => ({
        ...prev,
        lump_sum_dca: result
      }));
      return result;
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to optimize investment strategy',
        variant: 'destructive'
      });
      return null;
    }
  };

  const getHistoricalReturns = async () => {
    try {
      const result = await calculatorApi.getHistoricalReturns();
      setResults(prev => ({
        ...prev,
        historical_returns: result
      }));
      return result;
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to get historical returns',
        variant: 'destructive'
      });
      return null;
    }
  };

  return {
    // Results and state
    results,
    isLoading: investmentGrowthMutation.isPending,
    
    // React Query hooks
    useInvestmentGrowth,
    useScenarioComparison,
    useAssetAllocation,
    useLumpSumVsDca,
    useHistoricalReturns,
    
    // Prefetching functions
    prefetchInvestmentGrowth,
    prefetchScenarioComparison,
    
    // Cache management
    invalidateCache,
    removeFromCache,
    
    // Original API-compatible functions
    calculateInvestmentGrowth,
    compareInvestmentScenarios,
    calculateAssetAllocation,
    optimizeLumpSumVsDca,
    getHistoricalReturns,
    
    // State management
    resetResults,
    resetResultsByType
  };
}