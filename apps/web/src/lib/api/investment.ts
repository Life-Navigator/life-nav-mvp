/**
 * Investment domain API client
 */
import { apiClient } from './client';
import { financialApi } from './financial';
import type { Investment } from '../../types/financial';
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
} from '../../types/investment';

export const investmentApi = {
  /**
   * Get all investments for the current user
   * Re-uses the existing financial API for basic functionality
   */
  getInvestments: () => financialApi.getInvestments(),
  
  /**
   * Get a single investment by ID
   */
  getInvestment: (id: string) => financialApi.getInvestment(id),
  
  /**
   * Create a new investment
   */
  createInvestment: (data: Omit<Investment, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => 
    financialApi.createInvestment(data),
  
  /**
   * Update an existing investment
   */
  updateInvestment: (id: string, data: Partial<Investment>) => 
    financialApi.updateInvestment(id, data),
  
  /**
   * Delete an investment
   */
  deleteInvestment: (id: string) => financialApi.deleteInvestment(id),
  
  /**
   * Get the entire investment portfolio with detailed information
   */
  getPortfolio: () =>
    apiClient.get<InvestmentPortfolio>('/financial/investments/portfolio'),
  
  /**
   * Get portfolio holdings
   */
  getHoldings: () =>
    apiClient.get<InvestmentHolding[]>('/financial/investments/holdings'),
  
  /**
   * Get asset allocation breakdown
   */
  getAssetAllocation: () =>
    apiClient.get<AssetAllocation>('/financial/investments/allocation/asset'),
  
  /**
   * Get sector allocation breakdown
   */
  getSectorAllocation: () =>
    apiClient.get<SectorAllocation>('/financial/investments/allocation/sector'),
  
  /**
   * Get geographic allocation breakdown
   */
  getGeographicAllocation: () =>
    apiClient.get<GeographicAllocation>('/financial/investments/allocation/geographic'),
  
  /**
   * Get risk metrics for portfolio
   */
  getRiskMetrics: () =>
    apiClient.get<RiskMetrics>('/financial/investments/risk/metrics'),
  
  /**
   * Get risk alerts for portfolio
   */
  getRiskAlerts: () =>
    apiClient.get<RiskAlert[]>('/financial/investments/risk/alerts'),
  
  /**
   * Get stress test scenarios for portfolio
   */
  getStressTests: () =>
    apiClient.get<StressTestScenario[]>('/financial/investments/risk/stress-tests'),
  
  /**
   * Get portfolio insights and recommendations
   */
  getInsights: () =>
    apiClient.get<PortfolioInsight[]>('/financial/investments/insights'),
  
  /**
   * Get rebalancing recommendations for portfolio
   */
  getRebalancingRecommendations: () =>
    apiClient.get<RebalancingRecommendation[]>('/financial/investments/rebalancing'),
  
  /**
   * Get performance data for different time ranges
   */
  getPerformance: () =>
    apiClient.get<TimeRangeData>('/financial/investments/performance'),
  
  /**
   * Get market assumptions for investment projections
   */
  getMarketAssumptions: () =>
    apiClient.get<MarketAssumptions>('/financial/investments/market-assumptions'),
  
  /**
   * Update market assumptions for investment projections
   */
  updateMarketAssumptions: (data: Partial<MarketAssumptions>) =>
    apiClient.patch<MarketAssumptions>('/financial/investments/market-assumptions', data),
};