import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth/jwt';
import { db as prisma } from '@/lib/db';

// Market data and benchmarks (would integrate with real API in production)
const MARKET_DATA = {
  sp500: { ytdReturn: 0.1824, oneYearReturn: 0.2156, threeYearReturn: 0.0923, fiveYearReturn: 0.1247 },
  nasdaq: { ytdReturn: 0.2145, oneYearReturn: 0.2687, threeYearReturn: 0.0756, fiveYearReturn: 0.1534 },
  dowJones: { ytdReturn: 0.1245, oneYearReturn: 0.1567, threeYearReturn: 0.0834, fiveYearReturn: 0.1023 },
  bonds: { ytdReturn: 0.0234, oneYearReturn: 0.0456, threeYearReturn: 0.0123, fiveYearReturn: 0.0267 },
  riskFreeRate: 0.0525, // Current 10-year Treasury
};

// Sector classifications
const SECTOR_DATA: Record<string, { name: string; benchmark: number; beta: number; avgPE: number }> = {
  technology: { name: 'Technology', benchmark: 0.2456, beta: 1.25, avgPE: 28.5 },
  healthcare: { name: 'Healthcare', benchmark: 0.0823, beta: 0.85, avgPE: 22.3 },
  financial: { name: 'Financial Services', benchmark: 0.1234, beta: 1.15, avgPE: 14.2 },
  consumer_discretionary: { name: 'Consumer Discretionary', benchmark: 0.1567, beta: 1.10, avgPE: 24.8 },
  consumer_staples: { name: 'Consumer Staples', benchmark: 0.0456, beta: 0.65, avgPE: 21.5 },
  energy: { name: 'Energy', benchmark: -0.0234, beta: 1.35, avgPE: 11.2 },
  industrials: { name: 'Industrials', benchmark: 0.0923, beta: 1.05, avgPE: 19.8 },
  materials: { name: 'Materials', benchmark: 0.0512, beta: 1.20, avgPE: 16.5 },
  utilities: { name: 'Utilities', benchmark: 0.0234, beta: 0.45, avgPE: 18.2 },
  real_estate: { name: 'Real Estate', benchmark: 0.0123, beta: 0.90, avgPE: 35.6 },
  communication: { name: 'Communication Services', benchmark: 0.1823, beta: 1.05, avgPE: 20.3 },
};

// Default sector mapping for assets
const DEFAULT_SECTOR_MAP: Record<string, string> = {
  'AAPL': 'technology', 'MSFT': 'technology', 'GOOGL': 'communication', 'AMZN': 'consumer_discretionary',
  'NVDA': 'technology', 'TSLA': 'consumer_discretionary', 'META': 'communication', 'JPM': 'financial',
  'V': 'financial', 'JNJ': 'healthcare', 'PG': 'consumer_staples', 'XOM': 'energy',
  'VTI': 'diversified', 'VOO': 'diversified', 'VXUS': 'diversified', 'BND': 'bonds', 'AGG': 'bonds',
};

// Default beta values for common stocks (would come from market data API in production)
const DEFAULT_BETA_MAP: Record<string, number> = {
  'AAPL': 1.28, 'MSFT': 0.92, 'GOOGL': 1.08, 'AMZN': 1.24, 'NVDA': 1.72, 'TSLA': 2.05,
  'META': 1.15, 'JPM': 1.10, 'V': 0.98, 'JNJ': 0.55, 'PG': 0.42, 'XOM': 0.95,
  'VTI': 1.00, 'VOO': 1.00, 'VXUS': 0.85, 'BND': 0.05, 'AGG': 0.03,
};

interface Holding {
  ticker: string;
  name: string;
  sector: string;
  shares: number;
  costBasis: number;
  currentPrice: number;
  dividendYield: number;
  beta: number;
  region: string;
  marketValue?: number;
  unrealizedGain?: number;
  unrealizedGainPercent?: number;
  weight?: number;
  dayChange?: number;
  dayChangePercent?: number;
}

interface PortfolioMetrics {
  totalValue: number;
  totalCost: number;
  totalGain: number;
  totalGainPercent: number;
  dayChange: number;
  dayChangePercent: number;
  ytdReturn: number;
  oneYearReturn: number;
  threeYearReturn: number;
  fiveYearReturn: number;
  dividendYield: number;
  annualDividendIncome: number;
}

interface RiskMetrics {
  portfolioBeta: number;
  sharpeRatio: number;
  sortinoRatio: number;
  standardDeviation: number;
  maxDrawdown: number;
  valueAtRisk95: number;
  valueAtRisk99: number;
  trackingError: number;
  informationRatio: number;
  alpha: number;
  rSquared: number;
  upCaptureRatio: number;
  downCaptureRatio: number;
}

interface AllocationData {
  assetAllocation: Array<{ category: string; value: number; percentage: number; target?: number; color: string }>;
  sectorAllocation: Array<{ sector: string; value: number; percentage: number; benchmark: number; overUnder: number; color: string }>;
  geographicAllocation: Array<{ region: string; value: number; percentage: number; color: string }>;
  marketCapAllocation: Array<{ category: string; value: number; percentage: number; color: string }>;
}

interface TaxData {
  shortTermGains: number;
  longTermGains: number;
  shortTermLosses: number;
  longTermLosses: number;
  netGain: number;
  estimatedTax: number;
  harvestingOpportunities: Array<{
    ticker: string;
    name: string;
    loss: number;
    shares: number;
    taxSavings: number;
    washSaleRisk: boolean;
    recommendation: string;
  }>;
  taxEfficientWithdrawals: Array<{
    account: string;
    amount: number;
    taxImpact: number;
    reason: string;
  }>;
}

interface RebalanceRecommendation {
  ticker: string;
  name: string;
  currentWeight: number;
  targetWeight: number;
  difference: number;
  action: 'buy' | 'sell' | 'hold';
  shares: number;
  amount: number;
  reason: string;
  priority: 'high' | 'medium' | 'low';
  taxImpact?: number;
}

interface PortfolioInsight {
  category: string;
  type: 'warning' | 'opportunity' | 'info' | 'success';
  title: string;
  description: string;
  impact?: string;
  action?: string;
  priority: 'high' | 'medium' | 'low';
}

// GET - Comprehensive investment analytics
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '') || request.cookies.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload?.userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const userId = payload.userId;

    // Fetch user's investment holdings from database
    const userHoldings = await prisma.investmentHolding.findMany({
      where: { userId },
      orderBy: { marketValue: 'desc' },
    });

    // Transform database holdings to the format expected by the frontend
    let holdings: Holding[] = userHoldings.map((holding) => ({
      ticker: holding.ticker,
      name: holding.name,
      sector: holding.sector || DEFAULT_SECTOR_MAP[holding.ticker] || 'other',
      shares: holding.shares,
      costBasis: holding.costBasis,
      currentPrice: holding.currentPrice,
      dividendYield: holding.dividendYield,
      beta: holding.beta,
      region: holding.region,
      marketValue: holding.marketValue,
      unrealizedGain: holding.unrealizedGain,
      unrealizedGainPercent: holding.unrealizedGainPct,
      dayChange: 0, // Would come from market data API
      dayChangePercent: 0,
    }));

    // Calculate total portfolio value
    const totalValue = holdings.reduce((sum, h) => sum + (h.marketValue || 0), 0);

    // Add weight to each holding
    holdings = holdings.map(h => ({
      ...h,
      weight: (h.marketValue || 0) / totalValue,
    }));

    // Calculate portfolio metrics
    const portfolioMetrics = calculatePortfolioMetrics(holdings, totalValue);

    // Calculate risk metrics
    const riskMetrics = calculateRiskMetrics(holdings, totalValue);

    // Calculate allocations
    const allocations = calculateAllocations(holdings, totalValue);

    // Calculate tax data
    const taxData = calculateTaxData(holdings);

    // Generate rebalancing recommendations
    const rebalanceRecommendations = generateRebalanceRecommendations(holdings, totalValue);

    // Generate portfolio insights
    const insights = generateInsights(holdings, portfolioMetrics, riskMetrics, allocations);

    // Performance comparison with benchmarks
    const benchmarkComparison = {
      portfolio: portfolioMetrics.ytdReturn,
      sp500: MARKET_DATA.sp500.ytdReturn,
      nasdaq: MARKET_DATA.nasdaq.ytdReturn,
      bonds: MARKET_DATA.bonds.ytdReturn,
      outperformance: portfolioMetrics.ytdReturn - MARKET_DATA.sp500.ytdReturn,
    };

    // Dividend analysis
    const dividendAnalysis = calculateDividendAnalysis(holdings);

    // Factor exposure analysis
    const factorExposure = calculateFactorExposure(holdings);

    // Concentration analysis
    const concentrationAnalysis = calculateConcentrationAnalysis(holdings, totalValue);

    return NextResponse.json({
      holdings,
      portfolioMetrics,
      riskMetrics,
      allocations,
      taxData,
      rebalanceRecommendations,
      insights,
      benchmarkComparison,
      dividendAnalysis,
      factorExposure,
      concentrationAnalysis,
      marketData: MARKET_DATA,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching investment analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch investment analytics' },
      { status: 500 }
    );
  }
}

// Helper functions

function calculatePortfolioMetrics(holdings: Holding[], totalValue: number): PortfolioMetrics {
  const totalCost = holdings.reduce((sum, h) => sum + (h.costBasis * h.shares), 0);
  const totalGain = totalValue - totalCost;
  const dayChange = holdings.reduce((sum, h) => sum + (h.dayChange || 0) * h.shares, 0);

  // Weighted dividend yield
  const dividendYield = holdings.reduce((sum, h) => sum + h.dividendYield * (h.weight || 0), 0);
  const annualDividendIncome = totalValue * dividendYield;

  // Simulated historical returns (would come from actual price history)
  const ytdReturn = 0.1456 + (Math.random() * 0.05 - 0.025);
  const oneYearReturn = 0.1823 + (Math.random() * 0.05 - 0.025);
  const threeYearReturn = 0.0945 + (Math.random() * 0.03 - 0.015);
  const fiveYearReturn = 0.1234 + (Math.random() * 0.03 - 0.015);

  return {
    totalValue,
    totalCost,
    totalGain,
    totalGainPercent: totalGain / totalCost,
    dayChange,
    dayChangePercent: dayChange / totalValue,
    ytdReturn,
    oneYearReturn,
    threeYearReturn,
    fiveYearReturn,
    dividendYield,
    annualDividendIncome,
  };
}

function calculateRiskMetrics(holdings: Holding[], totalValue: number): RiskMetrics {
  // Weighted portfolio beta
  const portfolioBeta = holdings.reduce((sum, h) => sum + h.beta * (h.weight || 0), 0);

  // Simulated metrics (would be calculated from historical data)
  const standardDeviation = 0.165 + (Math.random() * 0.02);
  const expectedReturn = 0.12;
  const riskFreeRate = MARKET_DATA.riskFreeRate;

  const sharpeRatio = (expectedReturn - riskFreeRate) / standardDeviation;
  const sortinoRatio = sharpeRatio * 1.15; // Simplified - would need downside deviation
  const maxDrawdown = -0.18 - (Math.random() * 0.05);
  const valueAtRisk95 = totalValue * standardDeviation * 1.645;
  const valueAtRisk99 = totalValue * standardDeviation * 2.326;

  return {
    portfolioBeta,
    sharpeRatio,
    sortinoRatio,
    standardDeviation,
    maxDrawdown,
    valueAtRisk95,
    valueAtRisk99,
    trackingError: 0.032 + (Math.random() * 0.01),
    informationRatio: 0.45 + (Math.random() * 0.2),
    alpha: 0.012 + (Math.random() * 0.01),
    rSquared: 0.92 + (Math.random() * 0.05),
    upCaptureRatio: 1.05 + (Math.random() * 0.1),
    downCaptureRatio: 0.88 + (Math.random() * 0.1),
  };
}

function calculateAllocations(holdings: Holding[], totalValue: number): AllocationData {
  // Asset allocation
  const assetGroups: Record<string, number> = {};
  holdings.forEach(h => {
    const assetClass = h.sector === 'bonds' ? 'Fixed Income' :
                      h.sector === 'diversified' ? 'Diversified' : 'Equities';
    assetGroups[assetClass] = (assetGroups[assetClass] || 0) + (h.marketValue || 0);
  });

  const assetColors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];
  const assetAllocation = Object.entries(assetGroups).map(([category, value], i) => ({
    category,
    value,
    percentage: value / totalValue,
    target: category === 'Equities' ? 0.70 : category === 'Fixed Income' ? 0.25 : 0.05,
    color: assetColors[i % assetColors.length],
  }));

  // Sector allocation
  const sectorGroups: Record<string, number> = {};
  holdings.forEach(h => {
    if (h.sector !== 'bonds' && h.sector !== 'diversified') {
      sectorGroups[h.sector] = (sectorGroups[h.sector] || 0) + (h.marketValue || 0);
    }
  });

  const equityValue = holdings
    .filter(h => h.sector !== 'bonds' && h.sector !== 'diversified')
    .reduce((sum, h) => sum + (h.marketValue || 0), 0);

  const sectorColors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1'];
  const sectorAllocation = Object.entries(sectorGroups).map(([sector, value], i) => {
    const sectorInfo = SECTOR_DATA[sector] || { name: sector, benchmark: 0.10 };
    const percentage = value / equityValue;
    return {
      sector: sectorInfo.name,
      value,
      percentage,
      benchmark: sectorInfo.benchmark,
      overUnder: percentage - sectorInfo.benchmark,
      color: sectorColors[i % sectorColors.length],
    };
  });

  // Geographic allocation
  const geoGroups: Record<string, number> = {};
  holdings.forEach(h => {
    geoGroups[h.region] = (geoGroups[h.region] || 0) + (h.marketValue || 0);
  });

  const geoColors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444'];
  const geographicAllocation = Object.entries(geoGroups).map(([region, value], i) => ({
    region,
    value,
    percentage: value / totalValue,
    color: geoColors[i % geoColors.length],
  }));

  // Market cap allocation (simulated)
  const marketCapAllocation = [
    { category: 'Large Cap', value: totalValue * 0.65, percentage: 0.65, color: '#3B82F6' },
    { category: 'Mid Cap', value: totalValue * 0.20, percentage: 0.20, color: '#10B981' },
    { category: 'Small Cap', value: totalValue * 0.10, percentage: 0.10, color: '#F59E0B' },
    { category: 'Micro Cap', value: totalValue * 0.05, percentage: 0.05, color: '#EF4444' },
  ];

  return { assetAllocation, sectorAllocation, geographicAllocation, marketCapAllocation };
}

function calculateTaxData(holdings: Holding[]): TaxData {
  let shortTermGains = 0;
  let longTermGains = 0;
  let shortTermLosses = 0;
  let longTermLosses = 0;

  const harvestingOpportunities: TaxData['harvestingOpportunities'] = [];

  holdings.forEach(h => {
    const gain = (h.unrealizedGain || 0);
    const isLongTerm = Math.random() > 0.3; // Simulated holding period

    if (gain > 0) {
      if (isLongTerm) longTermGains += gain;
      else shortTermGains += gain;
    } else {
      if (isLongTerm) longTermLosses += Math.abs(gain);
      else shortTermLosses += Math.abs(gain);

      // Add to harvesting opportunities if loss is significant
      if (gain < -100) {
        harvestingOpportunities.push({
          ticker: h.ticker,
          name: h.name,
          loss: Math.abs(gain),
          shares: h.shares,
          taxSavings: Math.abs(gain) * 0.35,
          washSaleRisk: Math.random() > 0.7,
          recommendation: `Sell ${h.shares} shares to realize $${Math.abs(gain).toFixed(0)} loss`,
        });
      }
    }
  });

  const netGain = (shortTermGains + longTermGains) - (shortTermLosses + longTermLosses);
  const estimatedTax = (shortTermGains - shortTermLosses) * 0.37 + (longTermGains - longTermLosses) * 0.20;

  return {
    shortTermGains,
    longTermGains,
    shortTermLosses,
    longTermLosses,
    netGain,
    estimatedTax: Math.max(0, estimatedTax),
    harvestingOpportunities: harvestingOpportunities.sort((a, b) => b.taxSavings - a.taxSavings).slice(0, 5),
    taxEfficientWithdrawals: [
      { account: 'Taxable Brokerage', amount: 10000, taxImpact: 1500, reason: 'Lower tax on long-term gains' },
      { account: 'Traditional IRA', amount: 5000, taxImpact: 1850, reason: 'Withdraw last due to ordinary income tax' },
      { account: 'Roth IRA', amount: 5000, taxImpact: 0, reason: 'Tax-free withdrawals' },
    ],
  };
}

function generateRebalanceRecommendations(holdings: Holding[], totalValue: number): RebalanceRecommendation[] {
  // Target allocation (simplified - would come from user preferences)
  const targetWeights: Record<string, number> = {
    technology: 0.25,
    healthcare: 0.10,
    financial: 0.10,
    consumer_discretionary: 0.08,
    consumer_staples: 0.05,
    energy: 0.05,
    communication: 0.07,
    diversified: 0.15,
    bonds: 0.15,
  };

  const recommendations: RebalanceRecommendation[] = [];

  // Group holdings by sector
  const sectorWeights: Record<string, { weight: number; holdings: Holding[] }> = {};
  holdings.forEach(h => {
    if (!sectorWeights[h.sector]) {
      sectorWeights[h.sector] = { weight: 0, holdings: [] };
    }
    sectorWeights[h.sector].weight += h.weight || 0;
    sectorWeights[h.sector].holdings.push(h);
  });

  // Generate recommendations for each sector
  Object.entries(targetWeights).forEach(([sector, targetWeight]) => {
    const currentWeight = sectorWeights[sector]?.weight || 0;
    const difference = currentWeight - targetWeight;

    if (Math.abs(difference) > 0.02) { // Only if difference > 2%
      const holding = sectorWeights[sector]?.holdings[0];
      if (holding) {
        const action = difference > 0 ? 'sell' : 'buy';
        const amount = Math.abs(difference) * totalValue;
        const shares = Math.round(amount / holding.currentPrice);

        recommendations.push({
          ticker: holding.ticker,
          name: holding.name,
          currentWeight,
          targetWeight,
          difference,
          action,
          shares,
          amount,
          reason: difference > 0
            ? `Overweight in ${SECTOR_DATA[sector]?.name || sector} by ${(Math.abs(difference) * 100).toFixed(1)}%`
            : `Underweight in ${SECTOR_DATA[sector]?.name || sector} by ${(Math.abs(difference) * 100).toFixed(1)}%`,
          priority: Math.abs(difference) > 0.05 ? 'high' : Math.abs(difference) > 0.03 ? 'medium' : 'low',
          taxImpact: action === 'sell' ? amount * 0.15 : 0,
        });
      }
    }
  });

  return recommendations.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}

function generateInsights(
  holdings: Holding[],
  metrics: PortfolioMetrics,
  risk: RiskMetrics,
  allocations: AllocationData
): PortfolioInsight[] {
  const insights: PortfolioInsight[] = [];

  // Concentration risk
  const topHolding = holdings.reduce((max, h) => (h.weight || 0) > (max.weight || 0) ? h : max, holdings[0]);
  if ((topHolding.weight || 0) > 0.15) {
    insights.push({
      category: 'Concentration Risk',
      type: 'warning',
      title: 'High Single Stock Concentration',
      description: `${topHolding.name} represents ${((topHolding.weight || 0) * 100).toFixed(1)}% of your portfolio. Consider diversifying.`,
      impact: 'Increases portfolio volatility and single-stock risk',
      action: 'Consider trimming position or adding diversified ETFs',
      priority: 'high',
    });
  }

  // Sector concentration
  const techAllocation = allocations.sectorAllocation.find(s => s.sector === 'Technology');
  if (techAllocation && techAllocation.percentage > 0.30) {
    insights.push({
      category: 'Sector Risk',
      type: 'warning',
      title: 'Technology Sector Overweight',
      description: `Tech sector is ${(techAllocation.percentage * 100).toFixed(1)}% of equity allocation vs ${(techAllocation.benchmark * 100).toFixed(1)}% benchmark.`,
      impact: 'Higher correlation to tech sector drawdowns',
      action: 'Consider adding defensive sectors like healthcare or utilities',
      priority: 'medium',
    });
  }

  // High beta
  if (risk.portfolioBeta > 1.15) {
    insights.push({
      category: 'Market Risk',
      type: 'warning',
      title: 'Higher Than Market Volatility',
      description: `Portfolio beta of ${risk.portfolioBeta.toFixed(2)} means 15%+ more volatile than the market.`,
      impact: 'Larger swings during market movements',
      action: 'Add low-beta stocks or bonds to reduce volatility',
      priority: 'medium',
    });
  }

  // Tax-loss harvesting opportunity
  const losses = holdings.filter(h => (h.unrealizedGain || 0) < -500);
  if (losses.length > 0) {
    const totalLoss = losses.reduce((sum, h) => sum + Math.abs(h.unrealizedGain || 0), 0);
    insights.push({
      category: 'Tax Optimization',
      type: 'opportunity',
      title: 'Tax-Loss Harvesting Available',
      description: `${losses.length} positions with $${totalLoss.toFixed(0)} in unrealized losses available for harvesting.`,
      impact: `Potential tax savings of $${(totalLoss * 0.35).toFixed(0)}`,
      action: 'Review positions for tax-loss harvesting before year-end',
      priority: 'high',
    });
  }

  // Dividend income
  if (metrics.dividendYield > 0.02) {
    insights.push({
      category: 'Income',
      type: 'success',
      title: 'Strong Dividend Income',
      description: `Portfolio yields ${(metrics.dividendYield * 100).toFixed(2)}% with $${metrics.annualDividendIncome.toFixed(0)}/year in dividend income.`,
      impact: 'Provides steady income regardless of market conditions',
      action: 'Consider DRIP to compound returns',
      priority: 'low',
    });
  }

  // Performance vs benchmark
  if (metrics.ytdReturn > MARKET_DATA.sp500.ytdReturn) {
    insights.push({
      category: 'Performance',
      type: 'success',
      title: 'Outperforming Benchmark',
      description: `Portfolio up ${(metrics.ytdReturn * 100).toFixed(1)}% YTD vs S&P 500 at ${(MARKET_DATA.sp500.ytdReturn * 100).toFixed(1)}%.`,
      impact: `${((metrics.ytdReturn - MARKET_DATA.sp500.ytdReturn) * 100).toFixed(1)}% outperformance`,
      priority: 'low',
    });
  }

  // International diversification
  const intlAllocation = allocations.geographicAllocation.find(g => g.region === 'International');
  if (!intlAllocation || intlAllocation.percentage < 0.15) {
    insights.push({
      category: 'Diversification',
      type: 'info',
      title: 'Limited International Exposure',
      description: `Only ${((intlAllocation?.percentage || 0) * 100).toFixed(1)}% international allocation vs recommended 20-30%.`,
      impact: 'Missing diversification benefits from global markets',
      action: 'Consider adding VXUS or other international ETFs',
      priority: 'medium',
    });
  }

  return insights.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}

function calculateDividendAnalysis(holdings: Holding[]) {
  const dividendHoldings = holdings.filter(h => h.dividendYield > 0);
  const totalDividendIncome = dividendHoldings.reduce(
    (sum, h) => sum + ((h.marketValue || 0) * h.dividendYield),
    0
  );

  // Monthly dividend projection (simplified)
  const monthlyProjection = Array.from({ length: 12 }, (_, i) => ({
    month: new Date(2024, i, 1).toLocaleString('default', { month: 'short' }),
    amount: totalDividendIncome / 12 * (0.8 + Math.random() * 0.4), // Simulate quarterly patterns
    qualified: totalDividendIncome / 12 * 0.85 * (0.8 + Math.random() * 0.4),
    nonQualified: totalDividendIncome / 12 * 0.15 * (0.8 + Math.random() * 0.4),
  }));

  // Top dividend payers
  const topPayers = dividendHoldings
    .map(h => ({
      ticker: h.ticker,
      name: h.name,
      yield: h.dividendYield,
      annualIncome: (h.marketValue || 0) * h.dividendYield,
      frequency: 'Quarterly',
      exDivDate: '2024-02-15', // Simulated
    }))
    .sort((a, b) => b.annualIncome - a.annualIncome)
    .slice(0, 10);

  return {
    totalAnnualIncome: totalDividendIncome,
    averageYield: holdings.reduce((sum, h) => sum + h.dividendYield * (h.weight || 0), 0),
    qualifiedPercentage: 0.85,
    growthRate: 0.065, // 6.5% average dividend growth
    monthlyProjection,
    topPayers,
    yieldOnCost: totalDividendIncome / holdings.reduce((sum, h) => sum + h.costBasis * h.shares, 0),
  };
}

function calculateFactorExposure(holdings: Holding[]) {
  // Simulated factor exposures (would come from factor model analysis)
  return {
    value: 0.15 + (Math.random() * 0.2 - 0.1),
    growth: 0.45 + (Math.random() * 0.2 - 0.1),
    momentum: 0.25 + (Math.random() * 0.2 - 0.1),
    quality: 0.35 + (Math.random() * 0.2 - 0.1),
    size: -0.10 + (Math.random() * 0.2 - 0.1), // Negative = large cap tilt
    volatility: 0.05 + (Math.random() * 0.1 - 0.05),
    dividend: holdings.reduce((sum, h) => sum + h.dividendYield * (h.weight || 0), 0) > 0.02 ? 0.30 : 0.10,
  };
}

function calculateConcentrationAnalysis(holdings: Holding[], totalValue: number) {
  const sortedByWeight = [...holdings].sort((a, b) => (b.weight || 0) - (a.weight || 0));

  // Top holdings concentration
  const top5Weight = sortedByWeight.slice(0, 5).reduce((sum, h) => sum + (h.weight || 0), 0);
  const top10Weight = sortedByWeight.slice(0, 10).reduce((sum, h) => sum + (h.weight || 0), 0);

  // HHI (Herfindahl-Hirschman Index) for concentration
  const hhi = holdings.reduce((sum, h) => sum + Math.pow((h.weight || 0) * 100, 2), 0);

  // Number of holdings
  const totalHoldings = holdings.length;
  const effectiveHoldings = 1 / holdings.reduce((sum, h) => sum + Math.pow(h.weight || 0, 2), 0);

  return {
    top5Weight,
    top10Weight,
    hhi,
    totalHoldings,
    effectiveHoldings,
    concentrationLevel: hhi > 2500 ? 'High' : hhi > 1500 ? 'Moderate' : 'Low',
    topHoldings: sortedByWeight.slice(0, 10).map(h => ({
      ticker: h.ticker,
      name: h.name,
      weight: h.weight || 0,
      value: h.marketValue || 0,
    })),
  };
}
