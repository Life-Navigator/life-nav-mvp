import { QueryClient } from '@tanstack/react-query';
import { CalculatorType, saveCalculatorData, getCalculatorData } from '../utils/calculator-storage';

// Map React Query cache keys to calculator types
const mapCacheKeyToCalculatorType = (queryKey: unknown[]): CalculatorType | null => {
  if (!queryKey || !queryKey.length) return null;
  
  const cacheKey = queryKey[0] as string;
  
  switch (cacheKey) {
    case 'investment-growth':
      return CalculatorType.INVESTMENT_GROWTH;
    case 'scenario-comparison':
      return CalculatorType.SCENARIO_COMPARISON;
    case 'asset-allocation':
      return CalculatorType.ASSET_ALLOCATION;
    case 'lump-sum-vs-dca':
      return CalculatorType.LUMP_SUM_VS_DCA;
    case 'historical-returns':
      return CalculatorType.HISTORICAL_RETURNS;
    default:
      return null;
  }
};

/**
 * Persist selected query results to localStorage
 * This adds persistence to React Query's in-memory cache
 */
export const setupQueryPersistence = (queryClient: QueryClient): void => {
  // Subscribe to query cache changes
  queryClient.getQueryCache().subscribe(event => {
    if (!event.query) return;
    
    // Only persist on successful query completions
    if (event.type !== 'success' || !event.query.state.data) return;
    
    // Get the query key and check if it should be persisted
    const queryKey = event.query.queryKey;
    const calculatorType = mapCacheKeyToCalculatorType(queryKey as unknown[]);
    
    if (!calculatorType) return;
    
    // Get the input parameters from the query key
    if (queryKey.length < 2) return;
    
    try {
      // The second item in the query key is the stringified input parameters
      const inputStr = queryKey[1] as string;
      const input = JSON.parse(inputStr);
      
      // Save to localStorage
      saveCalculatorData(
        calculatorType,
        input,
        event.query.state.data
      );
    } catch (error) {
      console.error('Error persisting query result:', error);
    }
  });
};

/**
 * Restore cached query results from localStorage
 * This function hydrates the React Query cache from localStorage on app startup
 */
export const hydrateQueryCache = (queryClient: QueryClient): void => {
  // Restore investment growth calculations
  const investmentGrowthData = getCalculatorData(
    CalculatorType.INVESTMENT_GROWTH,
    null // Get all calculations
  );
  
  if (investmentGrowthData.data) {
    // Parse the stringified input to get the original parameters
    const input = investmentGrowthData.data;
    
    // Set the query data in the cache
    queryClient.setQueryData(
      ['investment-growth', JSON.stringify(input)],
      investmentGrowthData.data
    );
  }
  
  // Restore historical returns data
  const historicalReturnsData = getCalculatorData(
    CalculatorType.HISTORICAL_RETURNS,
    {}
  );
  
  if (historicalReturnsData.data) {
    queryClient.setQueryData(
      ['historical-returns'],
      historicalReturnsData.data
    );
  }
  
  // We could do the same for other calculator types as needed
};

/**
 * Create a custom wrapper for the QueryClient to add persistence
 */
export const createPersistentQueryClient = (): QueryClient => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 15, // 15 minutes
        gcTime: 1000 * 60 * 60 * 24, // 24 hours
        retry: 1,
      },
    },
  });
  
  // Set up persistence
  setupQueryPersistence(queryClient);
  
  // Hydrate the cache with existing localStorage data
  hydrateQueryCache(queryClient);
  
  return queryClient;
};