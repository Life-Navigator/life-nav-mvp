/**
 * Calculator API client
 */
import { apiClient } from './client';
import type {
  InvestmentGrowthRequest,
  InvestmentGrowthResponse,
  ScenarioComparisonRequest,
  ScenarioComparisonResult,
  AssetAllocationRequest,
  AssetAllocationResponse,
  LumpSumVsDcaRequest,
  LumpSumVsDcaResponse,
  HistoricalReturnsResponse
} from '@/types/calculator';

// This matches the paths we created in the API route handlers
const API_BASE_PATH = '/api/financial/calculator';

export const calculatorApi = {
  /**
   * Calculate investment growth based on provided parameters
   */
  calculateInvestmentGrowth: (data: InvestmentGrowthRequest) =>
    apiClient.post<InvestmentGrowthResponse>(`${API_BASE_PATH}/investment-growth`, data),

  /**
   * Compare multiple investment scenarios
   */
  compareInvestmentScenarios: (data: ScenarioComparisonRequest) =>
    apiClient.post<ScenarioComparisonResult>(`${API_BASE_PATH}/investment-growth/compare`, data),

  /**
   * Calculate recommended asset allocation based on risk profile and age
   */
  calculateAssetAllocation: (data: AssetAllocationRequest) =>
    apiClient.post<AssetAllocationResponse>(`${API_BASE_PATH}/asset-allocation`, data),

  /**
   * Compare lump sum vs dollar cost averaging investment strategies
   */
  optimizeLumpSumVsDca: (data: LumpSumVsDcaRequest) =>
    apiClient.post<LumpSumVsDcaResponse>(`${API_BASE_PATH}/lump-sum-vs-dca`, data),

  /**
   * Get historical returns data for different asset classes
   */
  getHistoricalReturns: () =>
    apiClient.get<HistoricalReturnsResponse>(`${API_BASE_PATH}/historical-returns`),
};