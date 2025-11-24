"use client";

import { useState, useEffect, useCallback } from "react";
import { PlaidLinkButton } from "@/components/finance/PlaidLinkButton";

// Tab types for investment management
type TabType =
  | "overview"
  | "holdings"
  | "performance"
  | "allocation"
  | "risk"
  | "tax"
  | "dividends"
  | "rebalance";

// Type definitions
interface Holding {
  id: string;
  symbol: string;
  name: string;
  shares: number;
  costBasis: number;
  currentPrice: number;
  marketValue: number;
  gainLoss: number;
  gainLossPercent: number;
  sector: string;
  assetClass: string;
  dayChange: number;
  dayChangePercent: number;
  dividendYield: number;
  peRatio: number;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
}

interface PortfolioMetrics {
  totalValue: number;
  totalCostBasis: number;
  totalGainLoss: number;
  totalGainLossPercent: number;
  dayChange: number;
  dayChangePercent: number;
  ytdReturn: number;
  ytdReturnPercent: number;
  oneYearReturn: number;
  threeYearReturn: number;
  fiveYearReturn: number;
  dividendIncome: number;
  cashBalance: number;
}

interface RiskMetrics {
  beta: number;
  sharpeRatio: number;
  sortinoRatio: number;
  standardDeviation: number;
  maxDrawdown: number;
  valueAtRisk: number;
  rSquared: number;
  alpha: number;
  treynorRatio: number;
  informationRatio: number;
  riskLevel: "Low" | "Moderate" | "High" | "Very High";
}

interface AllocationData {
  byAssetClass: Array<{ name: string; value: number; percentage: number; target: number; color: string }>;
  bySector: Array<{ name: string; value: number; percentage: number; color: string }>;
  byGeography: Array<{ name: string; value: number; percentage: number; color: string }>;
  byMarketCap: Array<{ name: string; value: number; percentage: number; color: string }>;
}

interface TaxData {
  shortTermGains: number;
  longTermGains: number;
  unrealizedGains: number;
  unrealizedLosses: number;
  estimatedTaxLiability: number;
  harvestableAmount: number;
  taxLotOpportunities: Array<{
    symbol: string;
    shares: number;
    loss: number;
    holdingPeriod: string;
    action: string;
  }>;
  washSaleWarnings: Array<{ symbol: string; amount: number; expiryDate: string }>;
}

interface RebalanceRecommendation {
  assetClass: string;
  currentWeight: number;
  targetWeight: number;
  difference: number;
  action: "Buy" | "Sell" | "Hold";
  amount: number;
  urgency: "High" | "Medium" | "Low";
  reason: string;
}

interface DividendData {
  totalAnnualIncome: number;
  monthlyIncome: number;
  yieldOnCost: number;
  currentYield: number;
  paymentSchedule: Array<{
    month: string;
    expected: number;
    stocks: string[];
  }>;
  topPayers: Array<{
    symbol: string;
    name: string;
    annualDividend: number;
    yield: number;
    growthRate: number;
  }>;
  growthProjection: Array<{
    year: number;
    income: number;
    yieldOnCost: number;
  }>;
}

interface Insight {
  id: string;
  type: "opportunity" | "warning" | "info" | "success";
  category: string;
  title: string;
  description: string;
  impact?: string;
  action?: string;
}

interface BenchmarkComparison {
  name: string;
  portfolioReturn: number;
  benchmarkReturn: number;
  alpha: number;
  period: string;
}

interface FactorExposure {
  factor: string;
  exposure: number;
  benchmark: number;
  description: string;
}

interface ConcentrationRisk {
  type: string;
  name: string;
  percentage: number;
  threshold: number;
  status: "Safe" | "Warning" | "Critical";
}

export default function InvestmentPage() {
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [showAddHoldingModal, setShowAddHoldingModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Add holding form state
  const [newHolding, setNewHolding] = useState({
    ticker: "",
    name: "",
    shares: "",
    costBasis: "",
    currentPrice: "",
    sector: "",
    accountName: "",
    accountType: "taxable",
    purchaseDate: "",
  });

  // Data states
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [portfolioMetrics, setPortfolioMetrics] = useState<PortfolioMetrics | null>(null);
  const [riskMetrics, setRiskMetrics] = useState<RiskMetrics | null>(null);
  const [allocation, setAllocation] = useState<AllocationData | null>(null);
  const [taxData, setTaxData] = useState<TaxData | null>(null);
  const [dividendData, setDividendData] = useState<DividendData | null>(null);
  const [rebalanceRecommendations, setRebalanceRecommendations] = useState<RebalanceRecommendation[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [benchmarks, setBenchmarks] = useState<BenchmarkComparison[]>([]);
  const [factorExposure, setFactorExposure] = useState<FactorExposure[]>([]);
  const [concentrationRisks, setConcentrationRisks] = useState<ConcentrationRisk[]>([]);
  const [selectedTimeframe, setSelectedTimeframe] = useState<"1D" | "1W" | "1M" | "3M" | "YTD" | "1Y" | "3Y" | "5Y" | "ALL">("YTD");

  // Fetch all investment analytics data
  const fetchAnalyticsData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch("/api/investments/analytics", {
        credentials: 'include', // Ensure cookies are sent for auth
      });

      // Handle auth redirect or unauthorized - just show empty state
      if (response.status === 401 || response.redirected || !response.ok) {
        // User not authenticated or no data - show empty state, not error
        setHoldings([]);
        setIsLoading(false);
        return;
      }

      // Check if response is JSON (API might redirect to login page HTML)
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        // Response is not JSON (likely redirect to login page)
        setHoldings([]);
        setIsLoading(false);
        return;
      }

      const data = await response.json();

        // Transform holdings to match expected interface (API uses ticker, we use symbol)
        const transformedHoldings: Holding[] = (data.holdings || []).map((h: {
          ticker?: string;
          symbol?: string;
          name: string;
          shares: number;
          costBasis: number;
          currentPrice: number;
          marketValue?: number;
          unrealizedGain?: number;
          unrealizedGainPercent?: number;
          sector: string;
          dividendYield: number;
          beta: number;
          dayChange?: number;
          dayChangePercent?: number;
          weight?: number;
        }, index: number) => ({
          id: h.ticker || h.symbol || `holding-${index}`,
          symbol: h.ticker || h.symbol || 'N/A',
          name: h.name || 'Unknown',
          shares: h.shares || 0,
          costBasis: (h.costBasis || 0) * (h.shares || 0),
          currentPrice: h.currentPrice || 0,
          marketValue: h.marketValue || (h.shares || 0) * (h.currentPrice || 0),
          gainLoss: h.unrealizedGain || 0,
          gainLossPercent: (h.unrealizedGainPercent || 0) * 100,
          sector: h.sector || 'Other',
          assetClass: h.sector === 'bonds' ? 'Fixed Income' : 'Equities',
          dayChange: (h.dayChange || 0) * (h.shares || 0),
          dayChangePercent: (h.dayChangePercent || 0) * 100,
          dividendYield: (h.dividendYield || 0) * 100,
          peRatio: 25,
          fiftyTwoWeekHigh: h.currentPrice * 1.2,
          fiftyTwoWeekLow: h.currentPrice * 0.8,
        }));

        setHoldings(transformedHoldings);

        // Transform portfolio metrics
        if (data.portfolioMetrics) {
          const pm = data.portfolioMetrics;
          setPortfolioMetrics({
            totalValue: pm.totalValue || 0,
            totalCostBasis: pm.totalCost || 0,
            totalGainLoss: pm.totalGain || 0,
            totalGainLossPercent: (pm.totalGainPercent || 0) * 100,
            dayChange: pm.dayChange || 0,
            dayChangePercent: (pm.dayChangePercent || 0) * 100,
            ytdReturn: pm.ytdReturn * (pm.totalValue || 0) || 0,
            ytdReturnPercent: (pm.ytdReturn || 0) * 100,
            oneYearReturn: (pm.oneYearReturn || 0) * 100,
            threeYearReturn: (pm.threeYearReturn || 0) * 100,
            fiveYearReturn: (pm.fiveYearReturn || 0) * 100,
            dividendIncome: pm.annualDividendIncome || 0,
            cashBalance: 15000,
          });
        }

        // Transform risk metrics
        if (data.riskMetrics) {
          const rm = data.riskMetrics;
          setRiskMetrics({
            beta: rm.portfolioBeta || 1,
            sharpeRatio: rm.sharpeRatio || 0,
            sortinoRatio: rm.sortinoRatio || 0,
            standardDeviation: (rm.standardDeviation || 0) * 100,
            maxDrawdown: Math.abs(rm.maxDrawdown || 0) * 100,
            valueAtRisk: rm.valueAtRisk95 || 0,
            rSquared: rm.rSquared || 0,
            alpha: (rm.alpha || 0) * 100,
            treynorRatio: rm.sharpeRatio || 0,
            informationRatio: rm.informationRatio || 0,
            riskLevel: rm.portfolioBeta > 1.2 ? "High" : rm.portfolioBeta > 0.8 ? "Moderate" : "Low",
          });
        }

        // Transform allocations
        if (data.allocations) {
          const alloc = data.allocations;
          setAllocation({
            byAssetClass: (alloc.assetAllocation || []).map((a: { category: string; value: number; percentage: number; target?: number; color: string }) => ({
              name: a.category,
              value: a.value,
              percentage: (a.percentage || 0) * 100,
              target: (a.target || 0) * 100,
              color: a.color,
            })),
            bySector: (alloc.sectorAllocation || []).map((s: { sector: string; value: number; percentage: number; color: string }) => ({
              name: s.sector,
              value: s.value,
              percentage: (s.percentage || 0) * 100,
              color: s.color,
            })),
            byGeography: (alloc.geographicAllocation || []).map((g: { region: string; value: number; percentage: number; color: string }) => ({
              name: g.region,
              value: g.value,
              percentage: (g.percentage || 0) * 100,
              color: g.color,
            })),
            byMarketCap: (alloc.marketCapAllocation || []).map((m: { category: string; value: number; percentage: number; color: string }) => ({
              name: m.category,
              value: m.value,
              percentage: (m.percentage || 0) * 100,
              color: m.color,
            })),
          });
        }

        // Transform tax data
        if (data.taxData) {
          const td = data.taxData;
          setTaxData({
            shortTermGains: td.shortTermGains || 0,
            longTermGains: td.longTermGains || 0,
            unrealizedGains: (td.shortTermGains || 0) + (td.longTermGains || 0),
            unrealizedLosses: (td.shortTermLosses || 0) + (td.longTermLosses || 0),
            estimatedTaxLiability: td.estimatedTax || 0,
            harvestableAmount: (td.shortTermLosses || 0) + (td.longTermLosses || 0),
            taxLotOpportunities: (td.harvestingOpportunities || []).map((o: { ticker: string; shares: number; loss: number; recommendation: string }) => ({
              symbol: o.ticker,
              shares: o.shares,
              loss: -o.loss,
              holdingPeriod: 'Long-term',
              action: 'Harvest',
            })),
            washSaleWarnings: [],
          });
        }

        // Transform dividend data
        if (data.dividendAnalysis) {
          const da = data.dividendAnalysis;
          setDividendData({
            totalAnnualIncome: da.totalAnnualIncome || 0,
            monthlyIncome: (da.totalAnnualIncome || 0) / 12,
            yieldOnCost: (da.yieldOnCost || 0) * 100,
            currentYield: (da.averageYield || 0) * 100,
            paymentSchedule: (da.monthlyProjection || []).slice(0, 12).map((m: { month: string; amount: number }) => ({
              month: m.month,
              expected: m.amount,
              stocks: ['AAPL', 'MSFT', 'JNJ'],
            })),
            topPayers: (da.topPayers || []).map((p: { ticker: string; name: string; annualIncome: number; yield: number }) => ({
              symbol: p.ticker,
              name: p.name,
              annualDividend: p.annualIncome,
              yield: (p.yield || 0) * 100,
              growthRate: 7.5,
            })),
            growthProjection: Array.from({ length: 10 }, (_, i) => ({
              year: i + 1,
              income: (da.totalAnnualIncome || 0) * Math.pow(1.07, i + 1),
              yieldOnCost: ((da.yieldOnCost || 0) * 100) * Math.pow(1.07, i + 1),
            })),
          });
        }

        // Transform rebalance recommendations
        if (data.rebalanceRecommendations) {
          setRebalanceRecommendations(data.rebalanceRecommendations.map((r: { ticker: string; currentWeight: number; targetWeight: number; difference: number; action: string; amount: number; priority: string; reason: string }) => ({
            assetClass: r.ticker,
            currentWeight: (r.currentWeight || 0) * 100,
            targetWeight: (r.targetWeight || 0) * 100,
            difference: (r.difference || 0) * 100,
            action: r.action === 'buy' ? 'Buy' : r.action === 'sell' ? 'Sell' : 'Hold',
            amount: r.amount || 0,
            urgency: r.priority === 'high' ? 'High' : r.priority === 'medium' ? 'Medium' : 'Low',
            reason: r.reason || '',
          })));
        }

        // Transform insights
        if (data.insights) {
          setInsights(data.insights.map((i: { category: string; type: string; title: string; description: string; impact?: string; action?: string }, index: number) => ({
            id: `insight-${index}`,
            type: i.type as "opportunity" | "warning" | "info" | "success",
            category: i.category,
            title: i.title,
            description: i.description,
            impact: i.impact,
            action: i.action,
          })));
        }

        // Transform benchmarks
        if (data.benchmarkComparison) {
          const bc = data.benchmarkComparison;
          setBenchmarks([
            {
              name: 'S&P 500',
              portfolioReturn: (bc.portfolio || 0) * 100,
              benchmarkReturn: (bc.sp500 || 0) * 100,
              alpha: (bc.outperformance || 0) * 100,
              period: 'YTD',
            },
            {
              name: 'NASDAQ',
              portfolioReturn: (bc.portfolio || 0) * 100,
              benchmarkReturn: (bc.nasdaq || 0) * 100,
              alpha: ((bc.portfolio || 0) - (bc.nasdaq || 0)) * 100,
              period: 'YTD',
            },
            {
              name: 'Bonds',
              portfolioReturn: (bc.portfolio || 0) * 100,
              benchmarkReturn: (bc.bonds || 0) * 100,
              alpha: ((bc.portfolio || 0) - (bc.bonds || 0)) * 100,
              period: 'YTD',
            },
          ]);
        }

        // Transform factor exposure
        if (data.factorExposure) {
          const fe = data.factorExposure;
          setFactorExposure([
            { factor: 'Value', exposure: fe.value || 0, benchmark: 0.2, description: 'Exposure to undervalued stocks' },
            { factor: 'Growth', exposure: fe.growth || 0, benchmark: 0.3, description: 'Exposure to high-growth stocks' },
            { factor: 'Momentum', exposure: fe.momentum || 0, benchmark: 0.2, description: 'Exposure to trending stocks' },
            { factor: 'Quality', exposure: fe.quality || 0, benchmark: 0.25, description: 'Exposure to high-quality companies' },
          ]);
        }

        // Transform concentration risks
        if (data.concentrationAnalysis) {
          const ca = data.concentrationAnalysis;
          setConcentrationRisks([
            {
              type: 'Top 5 Holdings',
              name: 'Portfolio Concentration',
              percentage: (ca.top5Weight || 0) * 100,
              threshold: 40,
              status: (ca.top5Weight || 0) > 0.5 ? 'Critical' : (ca.top5Weight || 0) > 0.4 ? 'Warning' : 'Safe',
            },
            {
              type: 'Top 10 Holdings',
              name: 'Broader Concentration',
              percentage: (ca.top10Weight || 0) * 100,
              threshold: 60,
              status: (ca.top10Weight || 0) > 0.7 ? 'Critical' : (ca.top10Weight || 0) > 0.6 ? 'Warning' : 'Safe',
            },
          ]);
        }
      // Data loaded successfully - no else branch needed since we handle errors above
    } catch (err) {
      // Network error or JSON parsing error - just show empty state
      console.error("Error fetching investment analytics:", err);
      setHoldings([]);
      // Don't set error - just show empty state
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial data load
  useEffect(() => {
    fetchAnalyticsData();
  }, [fetchAnalyticsData]);

  // Handle adding a new holding
  const handleAddHolding = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/investments/holdings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker: newHolding.ticker.toUpperCase(),
          name: newHolding.name,
          shares: parseFloat(newHolding.shares),
          costBasis: parseFloat(newHolding.costBasis),
          currentPrice: newHolding.currentPrice ? parseFloat(newHolding.currentPrice) : undefined,
          sector: newHolding.sector || undefined,
          accountName: newHolding.accountName || undefined,
          accountType: newHolding.accountType,
          purchaseDate: newHolding.purchaseDate || undefined,
        }),
      });
      if (response.ok) {
        setShowAddHoldingModal(false);
        setNewHolding({
          ticker: "", name: "", shares: "", costBasis: "", currentPrice: "",
          sector: "", accountName: "", accountType: "taxable", purchaseDate: "",
        });
        fetchAnalyticsData(); // Refresh data
      } else {
        const data = await response.json();
        setError(data.error || "Failed to add holding");
      }
    } catch (err) {
      console.error("Error adding holding:", err);
      setError("Failed to add holding");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Empty state component
  const renderEmptyState = () => (
    <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
      <div className="mx-auto w-24 h-24 bg-indigo-100 rounded-full flex items-center justify-center mb-6">
        <svg className="w-12 h-12 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      </div>
      <h3 className="text-xl font-semibold text-gray-900 mb-2">No Investment Holdings Yet</h3>
      <p className="text-gray-500 mb-6 max-w-md mx-auto">
        Start tracking your investments by adding holdings manually, importing from a CSV file, or connecting your brokerage accounts through Plaid.
      </p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
        <button
          onClick={() => setShowAddHoldingModal(true)}
          className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
        >
          + Add Holding Manually
        </button>
        <PlaidLinkButton
          buttonText="Connect Brokerage (Plaid)"
          className="px-6 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium !bg-white hover:!bg-gray-50"
          onSuccess={async () => {
            // After connecting, sync investments from Plaid
            try {
              await fetch('/api/plaid/investments', { method: 'POST' });
              fetchAnalyticsData(); // Refresh data
            } catch (error) {
              console.error('Failed to sync investments:', error);
            }
          }}
        />
      </div>
      <div className="mt-8 pt-8 border-t border-gray-200">
        <h4 className="text-sm font-medium text-gray-900 mb-4">Popular holdings to track:</h4>
        <div className="flex flex-wrap gap-2 justify-center">
          {['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'VTI', 'VOO', 'SPY'].map((ticker) => (
            <button
              key={ticker}
              onClick={() => {
                setNewHolding(prev => ({ ...prev, ticker }));
                setShowAddHoldingModal(true);
              }}
              className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-full text-sm hover:bg-gray-200"
            >
              {ticker}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  // Add Holding Modal
  const renderAddHoldingModal = () => (
    showAddHoldingModal && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900">Add Investment Holding</h2>
              <button onClick={() => setShowAddHoldingModal(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          <form onSubmit={handleAddHolding} className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ticker Symbol *</label>
                <input
                  type="text"
                  required
                  value={newHolding.ticker}
                  onChange={(e) => setNewHolding(prev => ({ ...prev, ticker: e.target.value.toUpperCase() }))}
                  placeholder="AAPL"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company Name *</label>
                <input
                  type="text"
                  required
                  value={newHolding.name}
                  onChange={(e) => setNewHolding(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Apple Inc."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Shares *</label>
                <input
                  type="number"
                  required
                  step="0.0001"
                  min="0"
                  value={newHolding.shares}
                  onChange={(e) => setNewHolding(prev => ({ ...prev, shares: e.target.value }))}
                  placeholder="100"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cost Basis (per share) *</label>
                <input
                  type="number"
                  required
                  step="0.01"
                  min="0"
                  value={newHolding.costBasis}
                  onChange={(e) => setNewHolding(prev => ({ ...prev, costBasis: e.target.value }))}
                  placeholder="150.00"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Current Price (optional)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={newHolding.currentPrice}
                  onChange={(e) => setNewHolding(prev => ({ ...prev, currentPrice: e.target.value }))}
                  placeholder="178.50"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Date</label>
                <input
                  type="date"
                  value={newHolding.purchaseDate}
                  onChange={(e) => setNewHolding(prev => ({ ...prev, purchaseDate: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Account Name</label>
                <input
                  type="text"
                  value={newHolding.accountName}
                  onChange={(e) => setNewHolding(prev => ({ ...prev, accountName: e.target.value }))}
                  placeholder="Fidelity Brokerage"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Account Type</label>
                <select
                  value={newHolding.accountType}
                  onChange={(e) => setNewHolding(prev => ({ ...prev, accountType: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="taxable">Taxable Brokerage</option>
                  <option value="traditional_ira">Traditional IRA</option>
                  <option value="roth_ira">Roth IRA</option>
                  <option value="401k">401(k)</option>
                  <option value="roth_401k">Roth 401(k)</option>
                  <option value="hsa">HSA</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sector</label>
              <select
                value={newHolding.sector}
                onChange={(e) => setNewHolding(prev => ({ ...prev, sector: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="">Select sector...</option>
                <option value="technology">Technology</option>
                <option value="healthcare">Healthcare</option>
                <option value="financial">Financial Services</option>
                <option value="consumer_discretionary">Consumer Discretionary</option>
                <option value="consumer_staples">Consumer Staples</option>
                <option value="energy">Energy</option>
                <option value="industrials">Industrials</option>
                <option value="materials">Materials</option>
                <option value="utilities">Utilities</option>
                <option value="real_estate">Real Estate</option>
                <option value="communication">Communication Services</option>
                <option value="diversified">Diversified/ETF</option>
                <option value="bonds">Bonds/Fixed Income</option>
              </select>
            </div>
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => setShowAddHoldingModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {isSubmitting ? "Adding..." : "Add Holding"}
              </button>
            </div>
          </form>
        </div>
      </div>
    )
  );

  const tabs = [
    { id: "overview" as TabType, label: "Overview" },
    { id: "holdings" as TabType, label: "Holdings" },
    { id: "performance" as TabType, label: "Performance" },
    { id: "allocation" as TabType, label: "Allocation" },
    { id: "risk" as TabType, label: "Risk Analysis" },
    { id: "tax" as TabType, label: "Tax Planning" },
    { id: "dividends" as TabType, label: "Dividends" },
    { id: "rebalance" as TabType, label: "Rebalance" },
  ];

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatCurrencyPrecise = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatPercent = (value: number, decimals: number = 2) => {
    return `${value >= 0 ? "+" : ""}${value.toFixed(decimals)}%`;
  };

  const formatPercentPlain = (value: number, decimals: number = 1) => {
    return `${(value * 100).toFixed(decimals)}%`;
  };

  const getChangeColor = (value: number) => {
    return value >= 0 ? "text-green-600" : "text-red-600";
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case "Low": return "text-green-600 bg-green-100";
      case "Moderate": return "text-yellow-600 bg-yellow-100";
      case "High": return "text-orange-600 bg-orange-100";
      case "Very High": return "text-red-600 bg-red-100";
      default: return "text-gray-600 bg-gray-100";
    }
  };

  // Overview Tab
  const renderOverview = () => {
    // Show empty state if no holdings
    if (holdings.length === 0) {
      return renderEmptyState();
    }

    return (
    <div className="space-y-6">
      {/* Portfolio Value Hero */}
      <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-medium opacity-90">Total Portfolio Value</h2>
            <div className="text-4xl font-bold mt-1">{formatCurrency(portfolioMetrics?.totalValue || 0)}</div>
            <div className="flex items-center gap-4 mt-2">
              <span className={`text-sm ${(portfolioMetrics?.dayChangePercent || 0) >= 0 ? "text-green-300" : "text-red-300"}`}>
                {formatCurrency(portfolioMetrics?.dayChange || 0)} ({formatPercent(portfolioMetrics?.dayChangePercent || 0)}) Today
              </span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm opacity-75">Total Gain/Loss</div>
            <div className={`text-2xl font-bold ${(portfolioMetrics?.totalGainLoss || 0) >= 0 ? "text-green-300" : "text-red-300"}`}>
              {formatCurrency(portfolioMetrics?.totalGainLoss || 0)}
            </div>
            <div className={`text-sm ${(portfolioMetrics?.totalGainLossPercent || 0) >= 0 ? "text-green-300" : "text-red-300"}`}>
              {formatPercent(portfolioMetrics?.totalGainLossPercent || 0)}
            </div>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-4 gap-4">
          <div>
            <div className="text-sm opacity-75">YTD Return</div>
            <div className="font-semibold text-lg">{formatPercent(portfolioMetrics?.ytdReturnPercent || 0)}</div>
          </div>
          <div>
            <div className="text-sm opacity-75">1 Year</div>
            <div className="font-semibold text-lg">{formatPercent(portfolioMetrics?.oneYearReturn || 0)}</div>
          </div>
          <div>
            <div className="text-sm opacity-75">3 Year</div>
            <div className="font-semibold text-lg">{formatPercent(portfolioMetrics?.threeYearReturn || 0)}</div>
          </div>
          <div>
            <div className="text-sm opacity-75">5 Year</div>
            <div className="font-semibold text-lg">{formatPercent(portfolioMetrics?.fiveYearReturn || 0)}</div>
          </div>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Cost Basis</div>
          <div className="text-2xl font-bold text-gray-900">{formatCurrency(portfolioMetrics?.totalCostBasis || 0)}</div>
          <div className="text-xs text-gray-500 mt-1">Total invested</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Cash Balance</div>
          <div className="text-2xl font-bold text-gray-900">{formatCurrency(portfolioMetrics?.cashBalance || 0)}</div>
          <div className="text-xs text-gray-500 mt-1">Available to invest</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Dividend Income</div>
          <div className="text-2xl font-bold text-green-600">{formatCurrency(portfolioMetrics?.dividendIncome || 0)}/yr</div>
          <div className="text-xs text-gray-500 mt-1">{formatCurrency((portfolioMetrics?.dividendIncome || 0) / 12)}/mo</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Risk Level</div>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-xl font-bold px-3 py-1 rounded-full ${getRiskColor(riskMetrics?.riskLevel || "Moderate")}`}>
              {riskMetrics?.riskLevel || "Moderate"}
            </span>
          </div>
          <div className="text-xs text-gray-500 mt-1">Beta: {riskMetrics?.beta?.toFixed(2) || "1.00"}</div>
        </div>
      </div>

      {/* Benchmark Comparison */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Benchmark Comparison</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {benchmarks.map((benchmark, index) => (
            <div key={index} className={`p-4 rounded-lg ${benchmark.alpha >= 0 ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
              <div className="text-sm text-gray-600 font-medium">{benchmark.name}</div>
              <div className="flex justify-between items-end mt-2">
                <div>
                  <div className="text-xs text-gray-500">Your Portfolio</div>
                  <div className={`text-xl font-bold ${getChangeColor(benchmark.portfolioReturn)}`}>
                    {formatPercent(benchmark.portfolioReturn)}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-gray-500">vs Benchmark</div>
                  <div className={`text-xl font-bold ${getChangeColor(benchmark.alpha)}`}>
                    {formatPercent(benchmark.alpha)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-500">{benchmark.name}</div>
                  <div className={`text-xl font-bold ${getChangeColor(benchmark.benchmarkReturn)}`}>
                    {formatPercent(benchmark.benchmarkReturn)}
                  </div>
                </div>
              </div>
              <div className="text-xs text-gray-500 mt-2 text-center">{benchmark.period}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Insights */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Investment Insights</h3>
        <div className="space-y-3">
          {insights.slice(0, 4).map((insight) => (
            <div
              key={insight.id}
              className={`p-4 rounded-lg border ${
                insight.type === "opportunity" ? "border-blue-200 bg-blue-50" :
                insight.type === "warning" ? "border-yellow-200 bg-yellow-50" :
                insight.type === "success" ? "border-green-200 bg-green-50" :
                "border-gray-200 bg-gray-50"
              }`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                      insight.type === "opportunity" ? "bg-blue-200 text-blue-800" :
                      insight.type === "warning" ? "bg-yellow-200 text-yellow-800" :
                      insight.type === "success" ? "bg-green-200 text-green-800" :
                      "bg-gray-200 text-gray-800"
                    }`}>
                      {insight.category}
                    </span>
                  </div>
                  <div className="font-medium text-gray-900 mt-1">{insight.title}</div>
                  <div className="text-sm text-gray-600 mt-1">{insight.description}</div>
                </div>
                {insight.action && (
                  <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm whitespace-nowrap">
                    {insight.action}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Top Holdings Preview */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Top Holdings</h3>
          <button onClick={() => setActiveTab("holdings")} className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
            View All →
          </button>
        </div>
        <div className="space-y-3">
          {holdings.slice(0, 5).map((holding) => (
            <div key={holding.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                  <span className="text-indigo-700 font-bold text-sm">{holding.symbol.slice(0, 2)}</span>
                </div>
                <div>
                  <div className="font-medium text-gray-900">{holding.symbol}</div>
                  <div className="text-sm text-gray-500">{holding.shares.toFixed(2)} shares</div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-semibold text-gray-900">{formatCurrency(holding.marketValue)}</div>
                <div className={`text-sm ${getChangeColor(holding.gainLossPercent)}`}>
                  {formatPercent(holding.gainLossPercent)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
  };

  // Holdings Tab
  const renderHoldings = () => (
    <div className="space-y-6">
      {/* Holdings Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Total Positions</div>
          <div className="text-2xl font-bold text-gray-900">{holdings.length}</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Profitable</div>
          <div className="text-2xl font-bold text-green-600">{holdings.filter(h => h.gainLoss > 0).length}</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500">At a Loss</div>
          <div className="text-2xl font-bold text-red-600">{holdings.filter(h => h.gainLoss < 0).length}</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Avg Dividend Yield</div>
          <div className="text-2xl font-bold text-indigo-600">
            {(holdings.reduce((sum, h) => sum + h.dividendYield, 0) / holdings.length || 0).toFixed(2)}%
          </div>
        </div>
      </div>

      {/* Holdings Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900">All Holdings</h3>
          <div className="flex gap-2">
            <button className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Export CSV</button>
            <button className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">+ Add Position</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Symbol</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Shares</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Market Value</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Cost Basis</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Gain/Loss</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Day Change</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Yield</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Sector</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {holdings.map((holding) => (
                <tr key={holding.id} className="hover:bg-gray-50">
                  <td className="px-4 py-4">
                    <div className="font-medium text-gray-900">{holding.symbol}</div>
                    <div className="text-sm text-gray-500 truncate max-w-[150px]">{holding.name}</div>
                  </td>
                  <td className="px-4 py-4 text-right text-gray-900">{holding.shares.toFixed(4)}</td>
                  <td className="px-4 py-4 text-right text-gray-900">{formatCurrencyPrecise(holding.currentPrice)}</td>
                  <td className="px-4 py-4 text-right font-medium text-gray-900">{formatCurrency(holding.marketValue)}</td>
                  <td className="px-4 py-4 text-right text-gray-500">{formatCurrency(holding.costBasis)}</td>
                  <td className="px-4 py-4 text-right">
                    <div className={`font-medium ${getChangeColor(holding.gainLoss)}`}>{formatCurrency(holding.gainLoss)}</div>
                    <div className={`text-sm ${getChangeColor(holding.gainLossPercent)}`}>{formatPercent(holding.gainLossPercent)}</div>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className={`font-medium ${getChangeColor(holding.dayChange)}`}>{formatCurrencyPrecise(holding.dayChange)}</div>
                    <div className={`text-sm ${getChangeColor(holding.dayChangePercent)}`}>{formatPercent(holding.dayChangePercent)}</div>
                  </td>
                  <td className="px-4 py-4 text-right text-gray-900">{holding.dividendYield.toFixed(2)}%</td>
                  <td className="px-4 py-4 text-center">
                    <span className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-full">{holding.sector}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  // Performance Tab
  const renderPerformance = () => (
    <div className="space-y-6">
      {/* Time Period Selector */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex flex-wrap gap-2">
          {(["1D", "1W", "1M", "3M", "YTD", "1Y", "3Y", "5Y", "ALL"] as const).map((period) => (
            <button
              key={period}
              onClick={() => setSelectedTimeframe(period)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                selectedTimeframe === period
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {period}
            </button>
          ))}
        </div>
      </div>

      {/* Performance Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl p-4 text-white">
          <div className="text-sm opacity-90">YTD Return</div>
          <div className="text-3xl font-bold mt-1">{formatPercent(portfolioMetrics?.ytdReturnPercent || 0)}</div>
          <div className="text-sm opacity-75 mt-1">{formatCurrency(portfolioMetrics?.ytdReturn || 0)}</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500">1 Year Return</div>
          <div className={`text-2xl font-bold ${getChangeColor(portfolioMetrics?.oneYearReturn || 0)}`}>
            {formatPercent(portfolioMetrics?.oneYearReturn || 0)}
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500">3 Year CAGR</div>
          <div className={`text-2xl font-bold ${getChangeColor(portfolioMetrics?.threeYearReturn || 0)}`}>
            {formatPercent(portfolioMetrics?.threeYearReturn || 0)}
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500">5 Year CAGR</div>
          <div className={`text-2xl font-bold ${getChangeColor(portfolioMetrics?.fiveYearReturn || 0)}`}>
            {formatPercent(portfolioMetrics?.fiveYearReturn || 0)}
          </div>
        </div>
      </div>

      {/* Performance Chart Placeholder */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Portfolio Performance</h3>
        <div className="h-64 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg flex items-center justify-center">
          <div className="text-center">
            <div className="text-4xl mb-2">📈</div>
            <div className="text-gray-500">Interactive performance chart</div>
            <div className="text-sm text-gray-400">Coming soon with real-time data visualization</div>
          </div>
        </div>
      </div>

      {/* Benchmark Comparison Detail */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Detailed Benchmark Analysis</h3>
        <div className="space-y-4">
          {benchmarks.map((benchmark, index) => (
            <div key={index} className="p-4 border border-gray-200 rounded-lg">
              <div className="flex justify-between items-center mb-3">
                <span className="font-medium text-gray-900">{benchmark.name}</span>
                <span className="text-sm text-gray-500">{benchmark.period}</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-500">Your Portfolio</span>
                    <span className={`font-medium ${getChangeColor(benchmark.portfolioReturn)}`}>
                      {formatPercent(benchmark.portfolioReturn)}
                    </span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${benchmark.portfolioReturn >= 0 ? "bg-green-500" : "bg-red-500"}`}
                      style={{ width: `${Math.min(100, Math.abs(benchmark.portfolioReturn) * 2)}%` }}
                    />
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-500">{benchmark.name}</span>
                    <span className={`font-medium ${getChangeColor(benchmark.benchmarkReturn)}`}>
                      {formatPercent(benchmark.benchmarkReturn)}
                    </span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${benchmark.benchmarkReturn >= 0 ? "bg-blue-500" : "bg-red-500"}`}
                      style={{ width: `${Math.min(100, Math.abs(benchmark.benchmarkReturn) * 2)}%` }}
                    />
                  </div>
                </div>
              </div>
              <div className="mt-3 text-center">
                <span className={`text-sm font-medium ${getChangeColor(benchmark.alpha)}`}>
                  Alpha: {formatPercent(benchmark.alpha)} {benchmark.alpha >= 0 ? "outperformance" : "underperformance"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Top Performers / Worst Performers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-green-700 mb-4">🏆 Top Performers</h3>
          <div className="space-y-3">
            {holdings
              .sort((a, b) => b.gainLossPercent - a.gainLossPercent)
              .slice(0, 5)
              .map((holding) => (
                <div key={holding.id} className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                  <div>
                    <div className="font-medium text-gray-900">{holding.symbol}</div>
                    <div className="text-sm text-gray-500">{holding.name}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-green-600">{formatPercent(holding.gainLossPercent)}</div>
                    <div className="text-sm text-gray-500">{formatCurrency(holding.gainLoss)}</div>
                  </div>
                </div>
              ))}
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-red-700 mb-4">📉 Worst Performers</h3>
          <div className="space-y-3">
            {holdings
              .sort((a, b) => a.gainLossPercent - b.gainLossPercent)
              .slice(0, 5)
              .map((holding) => (
                <div key={holding.id} className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                  <div>
                    <div className="font-medium text-gray-900">{holding.symbol}</div>
                    <div className="text-sm text-gray-500">{holding.name}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-red-600">{formatPercent(holding.gainLossPercent)}</div>
                    <div className="text-sm text-gray-500">{formatCurrency(holding.gainLoss)}</div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );

  // Allocation Tab
  const renderAllocation = () => (
    <div className="space-y-6">
      {/* Asset Class Allocation */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Asset Class Allocation</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-3">
            {allocation?.byAssetClass.map((item, index) => (
              <div key={index} className="p-3 bg-gray-50 rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium text-gray-900">{item.name}</span>
                  <div className="text-right">
                    <span className="font-semibold text-gray-900">{item.percentage.toFixed(1)}%</span>
                    <span className="text-sm text-gray-500 ml-2">({formatCurrency(item.value)})</span>
                  </div>
                </div>
                <div className="relative h-3 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="absolute left-0 top-0 h-full rounded-full transition-all"
                    style={{ width: `${item.percentage}%`, backgroundColor: item.color }}
                  />
                  {item.target > 0 && (
                    <div
                      className="absolute top-0 w-0.5 h-full bg-gray-800"
                      style={{ left: `${item.target}%` }}
                      title={`Target: ${item.target}%`}
                    />
                  )}
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Current: {item.percentage.toFixed(1)}%</span>
                  <span>Target: {item.target.toFixed(1)}%</span>
                  <span className={item.percentage > item.target ? "text-orange-600" : item.percentage < item.target - 5 ? "text-red-600" : "text-green-600"}>
                    {item.percentage > item.target ? "Overweight" : item.percentage < item.target - 5 ? "Underweight" : "On Target"}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-center">
            <div className="relative w-64 h-64">
              {/* Simple CSS pie chart visualization */}
              <div className="w-full h-full rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center">
                <div className="w-32 h-32 bg-white rounded-full flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900">{allocation?.byAssetClass.length}</div>
                    <div className="text-sm text-gray-500">Asset Classes</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sector Allocation */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Sector Allocation</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {allocation?.bySector.map((item, index) => (
            <div key={index} className="p-4 rounded-lg border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-colors">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-sm font-medium text-gray-700">{item.name}</span>
              </div>
              <div className="text-2xl font-bold text-gray-900">{item.percentage.toFixed(1)}%</div>
              <div className="text-sm text-gray-500">{formatCurrency(item.value)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Geographic Allocation */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Geographic Allocation</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {allocation?.byGeography.map((item, index) => (
            <div key={index} className="p-4 bg-gray-50 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="font-medium text-gray-900">{item.name}</span>
                <span className="text-lg font-bold text-gray-900">{item.percentage.toFixed(1)}%</span>
              </div>
              <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${item.percentage}%`, backgroundColor: item.color }}
                />
              </div>
              <div className="text-sm text-gray-500 mt-1">{formatCurrency(item.value)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Market Cap Allocation */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Market Cap Distribution</h3>
        <div className="flex items-center gap-4">
          {allocation?.byMarketCap.map((item, index) => (
            <div key={index} className="flex-1 text-center">
              <div className="h-32 flex items-end justify-center mb-2">
                <div
                  className="w-full max-w-[60px] rounded-t-lg transition-all"
                  style={{
                    height: `${item.percentage * 1.2}%`,
                    backgroundColor: item.color,
                  }}
                />
              </div>
              <div className="text-sm font-medium text-gray-900">{item.name}</div>
              <div className="text-lg font-bold text-gray-900">{item.percentage.toFixed(1)}%</div>
              <div className="text-xs text-gray-500">{formatCurrency(item.value)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // Risk Analysis Tab
  const renderRiskAnalysis = () => (
    <div className="space-y-6">
      {/* Risk Overview */}
      <div className="bg-gradient-to-br from-orange-500 to-red-600 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Portfolio Risk Assessment</h2>
            <p className="text-sm opacity-75 mt-1">Comprehensive analysis of your portfolio's risk profile</p>
          </div>
          <div className={`px-6 py-3 rounded-xl font-bold text-xl ${getRiskColor(riskMetrics?.riskLevel || "Moderate")} bg-white`}>
            {riskMetrics?.riskLevel || "Moderate"} Risk
          </div>
        </div>
      </div>

      {/* Key Risk Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Beta</div>
          <div className="text-2xl font-bold text-gray-900">{riskMetrics?.beta?.toFixed(2) || "1.00"}</div>
          <div className="text-xs text-gray-500 mt-1">Market sensitivity</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Sharpe Ratio</div>
          <div className="text-2xl font-bold text-gray-900">{riskMetrics?.sharpeRatio?.toFixed(2) || "0.00"}</div>
          <div className="text-xs text-gray-500 mt-1">Risk-adjusted return</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Sortino Ratio</div>
          <div className="text-2xl font-bold text-gray-900">{riskMetrics?.sortinoRatio?.toFixed(2) || "0.00"}</div>
          <div className="text-xs text-gray-500 mt-1">Downside risk-adjusted</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Alpha</div>
          <div className={`text-2xl font-bold ${getChangeColor(riskMetrics?.alpha || 0)}`}>
            {formatPercent(riskMetrics?.alpha || 0)}
          </div>
          <div className="text-xs text-gray-500 mt-1">Excess return</div>
        </div>
      </div>

      {/* Volatility & Drawdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Volatility Analysis</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Standard Deviation</span>
              <span className="font-semibold">{riskMetrics?.standardDeviation?.toFixed(2) || "0"}%</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-orange-500 rounded-full"
                style={{ width: `${Math.min(100, (riskMetrics?.standardDeviation || 0) * 5)}%` }}
              />
            </div>
            <div className="text-sm text-gray-500">
              Portfolio volatility compared to the market average of ~15%
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Maximum Drawdown</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Worst Peak-to-Trough</span>
              <span className="font-semibold text-red-600">{formatPercent(-(riskMetrics?.maxDrawdown || 0))}</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-red-500 rounded-full"
                style={{ width: `${Math.min(100, (riskMetrics?.maxDrawdown || 0) * 2)}%` }}
              />
            </div>
            <div className="text-sm text-gray-500">
              Maximum historical loss from peak to trough
            </div>
          </div>
        </div>
      </div>

      {/* Value at Risk */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Value at Risk (VaR)</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center p-4 bg-red-50 rounded-lg border border-red-200">
            <div className="text-sm text-red-600 font-medium">95% VaR (Daily)</div>
            <div className="text-3xl font-bold text-red-700 mt-2">{formatCurrency(riskMetrics?.valueAtRisk || 0)}</div>
            <div className="text-sm text-gray-600 mt-2">
              5% chance of losing more than this in a single day
            </div>
          </div>
          <div className="text-center p-4 bg-orange-50 rounded-lg border border-orange-200">
            <div className="text-sm text-orange-600 font-medium">99% VaR (Daily)</div>
            <div className="text-3xl font-bold text-orange-700 mt-2">{formatCurrency((riskMetrics?.valueAtRisk || 0) * 1.5)}</div>
            <div className="text-sm text-gray-600 mt-2">
              1% chance of losing more than this in a single day
            </div>
          </div>
          <div className="text-center p-4 bg-yellow-50 rounded-lg border border-yellow-200">
            <div className="text-sm text-yellow-600 font-medium">Monthly VaR (95%)</div>
            <div className="text-3xl font-bold text-yellow-700 mt-2">{formatCurrency((riskMetrics?.valueAtRisk || 0) * 4.5)}</div>
            <div className="text-sm text-gray-600 mt-2">
              5% chance of losing more than this in a month
            </div>
          </div>
        </div>
      </div>

      {/* Factor Exposure */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Factor Exposure</h3>
        <div className="space-y-4">
          {factorExposure.map((factor, index) => (
            <div key={index} className="p-4 bg-gray-50 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium text-gray-900">{factor.factor}</span>
                <div className="text-right">
                  <span className={`font-semibold ${factor.exposure > factor.benchmark ? "text-green-600" : factor.exposure < factor.benchmark ? "text-red-600" : "text-gray-600"}`}>
                    {factor.exposure.toFixed(2)}
                  </span>
                  <span className="text-sm text-gray-500 ml-2">(Benchmark: {factor.benchmark.toFixed(2)})</span>
                </div>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${factor.exposure > 0 ? "bg-indigo-500" : "bg-red-500"}`}
                  style={{ width: `${Math.min(100, Math.abs(factor.exposure) * 50)}%` }}
                />
              </div>
              <div className="text-sm text-gray-500 mt-2">{factor.description}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Concentration Risk */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Concentration Risk</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {concentrationRisks.map((risk, index) => (
            <div
              key={index}
              className={`p-4 rounded-lg border ${
                risk.status === "Critical" ? "border-red-300 bg-red-50" :
                risk.status === "Warning" ? "border-yellow-300 bg-yellow-50" :
                "border-green-300 bg-green-50"
              }`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-sm text-gray-500">{risk.type}</div>
                  <div className="font-medium text-gray-900">{risk.name}</div>
                </div>
                <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                  risk.status === "Critical" ? "bg-red-200 text-red-800" :
                  risk.status === "Warning" ? "bg-yellow-200 text-yellow-800" :
                  "bg-green-200 text-green-800"
                }`}>
                  {risk.status}
                </span>
              </div>
              <div className="mt-3">
                <div className="flex justify-between text-sm mb-1">
                  <span>Exposure: {risk.percentage.toFixed(1)}%</span>
                  <span>Threshold: {risk.threshold}%</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      risk.status === "Critical" ? "bg-red-500" :
                      risk.status === "Warning" ? "bg-yellow-500" :
                      "bg-green-500"
                    }`}
                    style={{ width: `${Math.min(100, (risk.percentage / risk.threshold) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // Tax Planning Tab
  const renderTaxPlanning = () => (
    <div className="space-y-6">
      {/* Tax Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Short-Term Gains</div>
          <div className="text-2xl font-bold text-red-600">{formatCurrency(taxData?.shortTermGains || 0)}</div>
          <div className="text-xs text-gray-500 mt-1">Taxed as ordinary income</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Long-Term Gains</div>
          <div className="text-2xl font-bold text-orange-600">{formatCurrency(taxData?.longTermGains || 0)}</div>
          <div className="text-xs text-gray-500 mt-1">Preferential tax rate</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Unrealized Gains</div>
          <div className="text-2xl font-bold text-green-600">{formatCurrency(taxData?.unrealizedGains || 0)}</div>
          <div className="text-xs text-gray-500 mt-1">No tax until sold</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Est. Tax Liability</div>
          <div className="text-2xl font-bold text-gray-900">{formatCurrency(taxData?.estimatedTaxLiability || 0)}</div>
          <div className="text-xs text-gray-500 mt-1">Based on current gains</div>
        </div>
      </div>

      {/* Tax-Loss Harvesting */}
      <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Tax-Loss Harvesting Opportunity</h2>
            <p className="text-sm opacity-75 mt-1">Potential tax savings from harvesting losses</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">{formatCurrency(taxData?.harvestableAmount || 0)}</div>
            <div className="text-sm opacity-75">Available to harvest</div>
          </div>
        </div>
      </div>

      {/* Tax Lot Opportunities */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Tax-Loss Harvesting Candidates</h3>
          <p className="text-sm text-gray-500">Positions with unrealized losses that could be harvested</p>
        </div>
        <div className="divide-y divide-gray-200">
          {taxData?.taxLotOpportunities && taxData.taxLotOpportunities.length > 0 ? taxData.taxLotOpportunities.map((lot, index) => (
            <div key={index} className="p-4 hover:bg-gray-50">
              <div className="flex justify-between items-center">
                <div>
                  <div className="font-medium text-gray-900">{lot.symbol}</div>
                  <div className="text-sm text-gray-500">{lot.shares.toFixed(2)} shares • {lot.holdingPeriod}</div>
                </div>
                <div className="text-right flex items-center gap-4">
                  <div>
                    <div className="font-semibold text-red-600">{formatCurrency(lot.loss)}</div>
                    <div className="text-sm text-gray-500">Harvestable loss</div>
                  </div>
                  <button className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm">
                    {lot.action}
                  </button>
                </div>
              </div>
            </div>
          )) : (
            <div className="p-8 text-center text-gray-500">
              No tax-loss harvesting opportunities at this time
            </div>
          )}
        </div>
      </div>

      {/* Wash Sale Warnings */}
      {taxData?.washSaleWarnings && taxData.washSaleWarnings.length > 0 && (
        <div className="bg-white rounded-lg border border-red-200 overflow-hidden">
          <div className="p-4 border-b border-red-200 bg-red-50">
            <h3 className="text-lg font-semibold text-red-800">⚠️ Wash Sale Warnings</h3>
            <p className="text-sm text-red-600">These positions may trigger wash sale rules</p>
          </div>
          <div className="divide-y divide-gray-200">
            {taxData.washSaleWarnings.map((warning, index) => (
              <div key={index} className="p-4">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-medium text-gray-900">{warning.symbol}</div>
                    <div className="text-sm text-gray-500">Wash sale restriction expires {warning.expiryDate}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-red-600">{formatCurrency(warning.amount)}</div>
                    <div className="text-sm text-gray-500">Disallowed loss</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tax Planning Tips */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Tax Planning Strategies</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="font-medium text-blue-800">Hold for Long-Term</div>
            <div className="text-sm text-blue-600 mt-1">
              Consider holding positions for over 1 year to qualify for long-term capital gains rates (0%, 15%, or 20%)
            </div>
          </div>
          <div className="p-4 bg-green-50 rounded-lg border border-green-200">
            <div className="font-medium text-green-800">Offset Gains with Losses</div>
            <div className="text-sm text-green-600 mt-1">
              Use harvested losses to offset capital gains, reducing your overall tax liability
            </div>
          </div>
          <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
            <div className="font-medium text-purple-800">Avoid Wash Sales</div>
            <div className="text-sm text-purple-600 mt-1">
              Wait 31 days before repurchasing substantially identical securities after selling at a loss
            </div>
          </div>
          <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
            <div className="font-medium text-orange-800">Consider Tax-Advantaged Accounts</div>
            <div className="text-sm text-orange-600 mt-1">
              Move high-turnover strategies to IRAs to defer or eliminate taxes on gains
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Dividends Tab
  const renderDividends = () => (
    <div className="space-y-6">
      {/* Dividend Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl p-4 text-white">
          <div className="text-sm opacity-90">Annual Income</div>
          <div className="text-3xl font-bold mt-1">{formatCurrency(dividendData?.totalAnnualIncome || 0)}</div>
          <div className="text-sm opacity-75 mt-1">{formatCurrency(dividendData?.monthlyIncome || 0)}/month</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Yield on Cost</div>
          <div className="text-2xl font-bold text-green-600">{(dividendData?.yieldOnCost || 0).toFixed(2)}%</div>
          <div className="text-xs text-gray-500 mt-1">Based on cost basis</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Current Yield</div>
          <div className="text-2xl font-bold text-indigo-600">{(dividendData?.currentYield || 0).toFixed(2)}%</div>
          <div className="text-xs text-gray-500 mt-1">Based on market value</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-500">Dividend Stocks</div>
          <div className="text-2xl font-bold text-gray-900">{dividendData?.topPayers?.length || 0}</div>
          <div className="text-xs text-gray-500 mt-1">Paying dividends</div>
        </div>
      </div>

      {/* Monthly Payment Schedule */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Expected Monthly Income</h3>
        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {dividendData?.paymentSchedule?.map((month, index) => (
            <div key={index} className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-500">{month.month}</div>
              <div className="text-lg font-bold text-green-600 mt-1">{formatCurrency(month.expected)}</div>
              <div className="text-xs text-gray-400 mt-1 truncate" title={month.stocks.join(", ")}>
                {month.stocks.slice(0, 2).join(", ")}
                {month.stocks.length > 2 && "..."}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Top Dividend Payers */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Top Dividend Payers</h3>
        </div>
        <div className="divide-y divide-gray-200">
          {dividendData?.topPayers?.map((payer, index) => (
            <div key={index} className="p-4 hover:bg-gray-50">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    <span className="text-green-700 font-bold text-sm">{payer.symbol.slice(0, 2)}</span>
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">{payer.symbol}</div>
                    <div className="text-sm text-gray-500">{payer.name}</div>
                  </div>
                </div>
                <div className="flex items-center gap-8">
                  <div className="text-center">
                    <div className="text-sm text-gray-500">Annual Dividend</div>
                    <div className="font-semibold text-green-600">{formatCurrency(payer.annualDividend)}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-gray-500">Yield</div>
                    <div className="font-semibold text-gray-900">{payer.yield.toFixed(2)}%</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm text-gray-500">5Y Growth</div>
                    <div className={`font-semibold ${getChangeColor(payer.growthRate)}`}>
                      {formatPercent(payer.growthRate)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Dividend Growth Projection */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">10-Year Income Projection</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {dividendData?.growthProjection?.map((year, index) => (
            <div key={index} className="text-center p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg border border-green-200">
              <div className="text-sm text-gray-500">Year {year.year}</div>
              <div className="text-xl font-bold text-green-700 mt-1">{formatCurrency(year.income)}</div>
              <div className="text-xs text-gray-500 mt-1">YoC: {year.yieldOnCost.toFixed(2)}%</div>
            </div>
          ))}
        </div>
        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
          <div className="text-sm text-gray-500">
            Projection assumes dividend growth rate continues at historical average. Actual results may vary.
          </div>
        </div>
      </div>
    </div>
  );

  // Rebalance Tab
  const renderRebalance = () => (
    <div className="space-y-6">
      {/* Rebalance Overview */}
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Portfolio Rebalancing</h2>
            <p className="text-sm opacity-75 mt-1">Recommendations to align your portfolio with target allocations</p>
          </div>
          <div className="text-right">
            <div className="text-sm opacity-75">Actions Needed</div>
            <div className="text-4xl font-bold">{rebalanceRecommendations.filter(r => r.action !== "Hold").length}</div>
          </div>
        </div>
      </div>

      {/* Rebalance Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-green-200 p-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
              <span className="text-green-600 font-bold">↑</span>
            </div>
            <div>
              <div className="text-sm text-gray-500">To Buy</div>
              <div className="text-xl font-bold text-green-600">
                {formatCurrency(rebalanceRecommendations.filter(r => r.action === "Buy").reduce((sum, r) => sum + r.amount, 0))}
              </div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-red-200 p-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
              <span className="text-red-600 font-bold">↓</span>
            </div>
            <div>
              <div className="text-sm text-gray-500">To Sell</div>
              <div className="text-xl font-bold text-red-600">
                {formatCurrency(rebalanceRecommendations.filter(r => r.action === "Sell").reduce((sum, r) => sum + r.amount, 0))}
              </div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
              <span className="text-gray-600 font-bold">✓</span>
            </div>
            <div>
              <div className="text-sm text-gray-500">On Target</div>
              <div className="text-xl font-bold text-gray-600">
                {rebalanceRecommendations.filter(r => r.action === "Hold").length} positions
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Rebalance Recommendations */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900">Rebalancing Recommendations</h3>
          <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm">
            Execute All
          </button>
        </div>
        <div className="divide-y divide-gray-200">
          {rebalanceRecommendations.map((rec, index) => (
            <div
              key={index}
              className={`p-4 ${
                rec.urgency === "High" ? "bg-red-50" :
                rec.urgency === "Medium" ? "bg-yellow-50" :
                ""
              }`}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{rec.assetClass}</span>
                    <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                      rec.action === "Buy" ? "bg-green-200 text-green-800" :
                      rec.action === "Sell" ? "bg-red-200 text-red-800" :
                      "bg-gray-200 text-gray-800"
                    }`}>
                      {rec.action}
                    </span>
                    <span className={`px-2 py-0.5 text-xs rounded-full ${
                      rec.urgency === "High" ? "bg-red-200 text-red-800" :
                      rec.urgency === "Medium" ? "bg-yellow-200 text-yellow-800" :
                      "bg-gray-200 text-gray-800"
                    }`}>
                      {rec.urgency} Priority
                    </span>
                  </div>
                  <div className="text-sm text-gray-600 mt-1">{rec.reason}</div>
                  <div className="flex gap-6 mt-2 text-sm">
                    <div>
                      <span className="text-gray-500">Current: </span>
                      <span className="font-medium">{rec.currentWeight.toFixed(1)}%</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Target: </span>
                      <span className="font-medium">{rec.targetWeight.toFixed(1)}%</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Difference: </span>
                      <span className={`font-medium ${rec.difference > 0 ? "text-green-600" : "text-red-600"}`}>
                        {rec.difference > 0 ? "+" : ""}{rec.difference.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right ml-4">
                  <div className={`text-xl font-bold ${rec.action === "Buy" ? "text-green-600" : rec.action === "Sell" ? "text-red-600" : "text-gray-600"}`}>
                    {rec.action !== "Hold" ? formatCurrency(rec.amount) : "—"}
                  </div>
                  {rec.action !== "Hold" && (
                    <button className={`mt-2 px-4 py-1.5 text-sm rounded-lg ${
                      rec.action === "Buy" ? "bg-green-600 text-white hover:bg-green-700" :
                      "bg-red-600 text-white hover:bg-red-700"
                    }`}>
                      {rec.action}
                    </button>
                  )}
                </div>
              </div>
              {/* Progress Bar */}
              <div className="mt-3">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>0%</span>
                  <span>Target: {rec.targetWeight.toFixed(1)}%</span>
                  <span>100%</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden relative">
                  <div
                    className={`absolute h-full rounded-full ${
                      rec.currentWeight > rec.targetWeight + 5 ? "bg-red-500" :
                      rec.currentWeight < rec.targetWeight - 5 ? "bg-orange-500" :
                      "bg-green-500"
                    }`}
                    style={{ width: `${rec.currentWeight}%` }}
                  />
                  <div
                    className="absolute h-full w-0.5 bg-gray-800"
                    style={{ left: `${rec.targetWeight}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Rebalancing Strategy */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Rebalancing Best Practices</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="font-medium text-blue-800">Threshold-Based Rebalancing</div>
            <div className="text-sm text-blue-600 mt-1">
              Rebalance when any asset class drifts more than 5% from target allocation
            </div>
          </div>
          <div className="p-4 bg-green-50 rounded-lg border border-green-200">
            <div className="font-medium text-green-800">Tax-Efficient Rebalancing</div>
            <div className="text-sm text-green-600 mt-1">
              Use new contributions to rebalance rather than selling existing positions
            </div>
          </div>
          <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
            <div className="font-medium text-purple-800">Calendar Rebalancing</div>
            <div className="text-sm text-purple-600 mt-1">
              Review portfolio allocation quarterly and rebalance as needed
            </div>
          </div>
          <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
            <div className="font-medium text-orange-800">Cost Consideration</div>
            <div className="text-sm text-orange-600 mt-1">
              Consider trading costs and tax implications before executing trades
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case "overview": return renderOverview();
      case "holdings": return renderHoldings();
      case "performance": return renderPerformance();
      case "allocation": return renderAllocation();
      case "risk": return renderRiskAnalysis();
      case "tax": return renderTaxPlanning();
      case "dividends": return renderDividends();
      case "rebalance": return renderRebalance();
      default: return renderOverview();
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading investment data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-xl mb-4">Error</div>
          <p className="text-gray-600">{error}</p>
          <button
            onClick={() => fetchAnalyticsData()}
            className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Investment Portfolio</h1>
              <p className="text-sm text-gray-500 mt-1">Comprehensive investment analysis and management</p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getRiskColor(riskMetrics?.riskLevel || "Moderate")}`}>
                {riskMetrics?.riskLevel || "Moderate"} Risk
              </span>
              <button
                onClick={() => setShowAddHoldingModal(true)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
              >
                + Add Holding
              </button>
              <button
                onClick={() => fetchAnalyticsData()}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
              >
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-1 overflow-x-auto py-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? "bg-indigo-100 text-indigo-700"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {renderTabContent()}
      </div>

      {/* Add Holding Modal */}
      {renderAddHoldingModal()}
    </div>
  );
}
