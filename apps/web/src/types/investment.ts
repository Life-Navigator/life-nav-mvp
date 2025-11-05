/**
 * Investment domain type definitions
 */
import { Investment } from './financial';

export type InvestmentHolding = {
  id: string;
  ticker: string;
  name: string;
  type: string;
  sector: string;
  shares: number;
  price: number;
  value: number;
  costBasis: number;
  gainLoss: number;
  gainLossPercent: number;
  allocation: number;
};

export type AssetAllocation = {
  name: string;
  value: number;
  color: string;
}[];

export type SectorAllocation = {
  name: string;
  value: number;
  color: string;
}[];

export type GeographicAllocation = {
  name: string;
  value: number;
  color: string;
}[];

export type RiskMetrics = {
  beta: number;
  sharpeRatio: number;
  volatility: number;
  maxDrawdown: number;
  downside: number;
  concentrationRisk: number;
};

export type RiskAlert = {
  id: string;
  type: 'warning' | 'info';
  title: string;
  description: string;
};

export type StressTestScenario = {
  name: string;
  portfolioImpact: number;
};

export type PortfolioInsight = {
  id: string;
  type: 'warning' | 'info' | 'success';
  title: string;
  description: string;
  icon: string;
  action: string;
};

export type RebalancingRecommendation = {
  action: 'Add New' | 'Increase' | 'Reduce';
  ticker: string;
  name: string;
  current: number;
  target: number;
  difference: number;
};

export type PerformanceData = {
  date: string;
  portfolioValue: number;
  benchmark: number;
};

export type TimeRangeData = {
  [key: string]: PerformanceData[];
};

export type MarketAssumptions = {
  riskFreeRate: number;
  equityRiskPremium: number;
  inflationRate: number;
  bondYield: number;
};

export type InvestmentScenario = {
  name: string;
  returnRate: number;
  color: string;
};

export type InvestmentPortfolio = {
  totalValue: number;
  totalCostBasis: number;
  totalGainLoss: number;
  totalGainLossPercent: number;
  risk: 'Conservative' | 'Moderate' | 'Aggressive' | string;
  holdings: InvestmentHolding[];
  assetAllocation: AssetAllocation;
  sectorAllocation: SectorAllocation;
  geographicAllocation: GeographicAllocation;
  riskMetrics: RiskMetrics;
  riskAlerts: RiskAlert[];
  stressTests: StressTestScenario[];
  insights: PortfolioInsight[];
  rebalancingRecommendations: RebalancingRecommendation[];
  performance: TimeRangeData;
  marketAssumptions: MarketAssumptions;
};