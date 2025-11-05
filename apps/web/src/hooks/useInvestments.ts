import { useState, useEffect } from 'react';
import { investmentApi } from '@/lib/api/investment';
import type { 
  InvestmentPortfolio,
  InvestmentHolding,
  AssetAllocation,
  SectorAllocation,
  GeographicAllocation,
  RiskMetrics,
  RiskAlert,
  StressTestScenario,
  PortfolioInsight,
  RebalancingRecommendation,
  TimeRangeData,
  MarketAssumptions
} from '@/types/investment';

export function useInvestmentPortfolio() {
  const [portfolio, setPortfolio] = useState<InvestmentPortfolio | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchPortfolio = async () => {
      try {
        setIsLoading(true);
        const data = await investmentApi.getPortfolio();
        setPortfolio(data);
        setError(null);
      } catch (err) {
        console.error('Error fetching investment portfolio:', err);
        setError(err instanceof Error ? err : new Error('Failed to fetch portfolio'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchPortfolio();
  }, []);

  return { portfolio, isLoading, error };
}

export function useInvestmentHoldings() {
  const [holdings, setHoldings] = useState<InvestmentHolding[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchHoldings = async () => {
      try {
        setIsLoading(true);
        const data = await investmentApi.getHoldings();
        setHoldings(data);
        setError(null);
      } catch (err) {
        console.error('Error fetching investment holdings:', err);
        setError(err instanceof Error ? err : new Error('Failed to fetch holdings'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchHoldings();
  }, []);

  return { holdings, isLoading, error };
}

export function useAssetAllocation() {
  const [allocation, setAllocation] = useState<AssetAllocation>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchAllocation = async () => {
      try {
        setIsLoading(true);
        const data = await investmentApi.getAssetAllocation();
        setAllocation(data);
        setError(null);
      } catch (err) {
        console.error('Error fetching asset allocation:', err);
        setError(err instanceof Error ? err : new Error('Failed to fetch asset allocation'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllocation();
  }, []);

  return { allocation, isLoading, error };
}

export function useSectorAllocation() {
  const [allocation, setAllocation] = useState<SectorAllocation>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchAllocation = async () => {
      try {
        setIsLoading(true);
        const data = await investmentApi.getSectorAllocation();
        setAllocation(data);
        setError(null);
      } catch (err) {
        console.error('Error fetching sector allocation:', err);
        setError(err instanceof Error ? err : new Error('Failed to fetch sector allocation'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllocation();
  }, []);

  return { allocation, isLoading, error };
}

export function useGeographicAllocation() {
  const [allocation, setAllocation] = useState<GeographicAllocation>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchAllocation = async () => {
      try {
        setIsLoading(true);
        const data = await investmentApi.getGeographicAllocation();
        setAllocation(data);
        setError(null);
      } catch (err) {
        console.error('Error fetching geographic allocation:', err);
        setError(err instanceof Error ? err : new Error('Failed to fetch geographic allocation'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllocation();
  }, []);

  return { allocation, isLoading, error };
}

export function useRiskMetrics() {
  const [metrics, setMetrics] = useState<RiskMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        setIsLoading(true);
        const data = await investmentApi.getRiskMetrics();
        setMetrics(data);
        setError(null);
      } catch (err) {
        console.error('Error fetching risk metrics:', err);
        setError(err instanceof Error ? err : new Error('Failed to fetch risk metrics'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchMetrics();
  }, []);

  return { metrics, isLoading, error };
}

export function useRiskAlerts() {
  const [alerts, setAlerts] = useState<RiskAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        setIsLoading(true);
        const data = await investmentApi.getRiskAlerts();
        setAlerts(data);
        setError(null);
      } catch (err) {
        console.error('Error fetching risk alerts:', err);
        setError(err instanceof Error ? err : new Error('Failed to fetch risk alerts'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchAlerts();
  }, []);

  return { alerts, isLoading, error };
}

export function useStressTests() {
  const [tests, setTests] = useState<StressTestScenario[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchTests = async () => {
      try {
        setIsLoading(true);
        const data = await investmentApi.getStressTests();
        setTests(data);
        setError(null);
      } catch (err) {
        console.error('Error fetching stress tests:', err);
        setError(err instanceof Error ? err : new Error('Failed to fetch stress tests'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchTests();
  }, []);

  return { tests, isLoading, error };
}

export function useInvestmentInsights() {
  const [insights, setInsights] = useState<PortfolioInsight[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchInsights = async () => {
      try {
        setIsLoading(true);
        const data = await investmentApi.getInsights();
        setInsights(data);
        setError(null);
      } catch (err) {
        console.error('Error fetching investment insights:', err);
        setError(err instanceof Error ? err : new Error('Failed to fetch insights'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchInsights();
  }, []);

  return { insights, isLoading, error };
}

export function useRebalancingRecommendations() {
  const [recommendations, setRecommendations] = useState<RebalancingRecommendation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchRecommendations = async () => {
      try {
        setIsLoading(true);
        const data = await investmentApi.getRebalancingRecommendations();
        setRecommendations(data);
        setError(null);
      } catch (err) {
        console.error('Error fetching rebalancing recommendations:', err);
        setError(err instanceof Error ? err : new Error('Failed to fetch recommendations'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchRecommendations();
  }, []);

  return { recommendations, isLoading, error };
}

export function usePerformanceData() {
  const [performance, setPerformance] = useState<TimeRangeData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchPerformance = async () => {
      try {
        setIsLoading(true);
        const data = await investmentApi.getPerformance();
        setPerformance(data);
        setError(null);
      } catch (err) {
        console.error('Error fetching performance data:', err);
        setError(err instanceof Error ? err : new Error('Failed to fetch performance data'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchPerformance();
  }, []);

  return { performance, isLoading, error };
}

export function useMarketAssumptions() {
  const [assumptions, setAssumptions] = useState<MarketAssumptions | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchAssumptions = async () => {
      try {
        setIsLoading(true);
        const data = await investmentApi.getMarketAssumptions();
        setAssumptions(data);
        setError(null);
      } catch (err) {
        console.error('Error fetching market assumptions:', err);
        setError(err instanceof Error ? err : new Error('Failed to fetch market assumptions'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchAssumptions();
  }, []);

  const updateAssumptions = async (data: Partial<MarketAssumptions>) => {
    try {
      setIsSaving(true);
      setSaveError(null);
      const updated = await investmentApi.updateMarketAssumptions(data);
      setAssumptions(updated);
      return true;
    } catch (err) {
      console.error('Error updating market assumptions:', err);
      setSaveError(err instanceof Error ? err : new Error('Failed to update market assumptions'));
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  return { assumptions, isLoading, error, updateAssumptions, isSaving, saveError };
}