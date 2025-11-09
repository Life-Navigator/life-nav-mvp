import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LineChart, PieChart } from 'react-native-chart-kit';
import { Dimensions } from 'react-native';
import {
  usePortfolio,
  usePortfolioPerformance,
  useAssetAllocation,
  useHoldings,
  useAddHolding,
  useUpdateHolding,
  useDeleteHolding,
  usePortfolioMetrics,
  useDividends,
  useInvestmentStrategy,
  useUpdateInvestmentStrategy,
} from '../../hooks/useFinance';

const screenWidth = Dimensions.get('window').width;

interface Holding {
  id: string;
  symbol: string;
  name: string;
  shares: number;
  costBasis: number;
  currentPrice: number;
  currentValue: number;
  gainLoss: number;
  gainLossPercent: number;
  sector: string;
  assetClass: string;
  dividendYield?: number;
  annualDividend?: number;
}

interface PortfolioAllocation {
  category: string;
  value: number;
  target: number;
  color: string;
}

interface PerformanceMetrics {
  totalReturn: number;
  annualizedReturn: number;
  ytdReturn: number;
  oneYearReturn: number;
  fiveYearReturn: number;
  lifetimeReturn: number;
  alpha: number;
  beta: number;
  sharpeRatio: number;
  standardDeviation: number;
  maxDrawdown: number;
  avgExpenseRatio: number;
}

interface TaxHarvestingOpportunity {
  id: string;
  holding: string;
  symbol: string;
  unrealizedLoss: number;
  potentialTaxSavings: number;
  washSaleRisk: boolean;
}

interface DividendIncome {
  holdingId: string;
  symbol: string;
  annualDividend: number;
  dividendYield: number;
  frequency: string;
  nextPaymentDate: string;
  dripEnabled: boolean;
}

interface InvestmentPortfolio {
  totalValue: number;
  cashBalance: number;
  totalGainLoss: number;
  totalGainLossPercent: number;
  allocations: PortfolioAllocation[];
  holdings: Holding[];
  performance: PerformanceMetrics;
  benchmarkComparison: {
    benchmark: string;
    portfolioReturn: number;
    benchmarkReturn: number;
  };
  taxHarvesting: TaxHarvestingOpportunity[];
  dividendIncome: {
    total: DividendIncome[];
    totalAnnualIncome: number;
    averageYield: number;
  };
  riskAssessment: {
    riskTolerance: 'conservative' | 'moderate' | 'aggressive';
    timeHorizon: number;
    investmentGoals: string[];
  };
  rebalancingNeeded: boolean;
  rebalancingRecommendations?: Array<{
    action: 'buy' | 'sell';
    category: string;
    amount: number;
  }>;
  historicalPerformance: Array<{
    date: string;
    value: number;
  }>;
}

export default function InvestmentManagementScreen() {
  const [selectedTab, setSelectedTab] = useState<'overview' | 'holdings' | 'performance' | 'dividends'>('overview');
  const [sortBy, setSortBy] = useState<'value' | 'gain'>('value');

  const { data: portfolio, isLoading, error, refetch, isRefresching } = usePortfolio();

  const isRefreshing = isRefresching || false;

  const handleExportReport = () => {
    Alert.alert('Export', 'Investment report exported successfully');
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.loadingText}>Loading portfolio...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="alert-circle" size={48} color="#FF6B6B" />
        <Text style={styles.errorText}>Failed to load portfolio</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!portfolio) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="trending-up-outline" size={48} color="#999" />
        <Text style={styles.emptyText}>No portfolio found</Text>
      </View>
    );
  }

  const allocationData = portfolio.allocations.map(alloc => ({
    name: alloc.category,
    value: alloc.value,
    color: alloc.color,
    legendFontColor: '#333',
    legendFontSize: 12,
  }));

  const performanceData = {
    labels: portfolio.historicalPerformance
      .filter((_, i) => i % Math.floor(portfolio.historicalPerformance.length / 6) === 0)
      .map(p => new Date(p.date).toLocaleDateString('en-US', { month: 'short' })),
    datasets: [
      {
        data: portfolio.historicalPerformance
          .filter((_, i) => i % Math.floor(portfolio.historicalPerformance.length / 6) === 0)
          .map(p => p.value / 1000),
        color: (opacity = 1) => `rgba(0, 122, 255, ${opacity})`,
        strokeWidth: 2,
      },
    ],
  };

  const sortedHoldings = [...portfolio.holdings].sort((a, b) => {
    if (sortBy === 'value') return b.currentValue - a.currentValue;
    return b.gainLoss - a.gainLoss;
  });

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Portfolio</Text>
        <TouchableOpacity onPress={handleExportReport}>
          <Ionicons name="download-outline" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      {/* Portfolio Overview Card */}
      <View style={styles.portfolioCard}>
        <Text style={styles.portfolioLabel}>Total Portfolio Value</Text>
        <Text style={styles.portfolioValue}>
          ${portfolio.totalValue.toLocaleString()}
        </Text>
        <View style={styles.gainLossContainer}>
          <Ionicons
            name={portfolio.totalGainLoss >= 0 ? 'trending-up' : 'trending-down'}
            size={20}
            color={portfolio.totalGainLoss >= 0 ? '#34C759' : '#FF3B30'}
          />
          <Text
            style={[
              styles.gainLossValue,
              { color: portfolio.totalGainLoss >= 0 ? '#34C759' : '#FF3B30' },
            ]}
          >
            {portfolio.totalGainLoss >= 0 ? '+' : ''}$
            {portfolio.totalGainLoss.toLocaleString()} ({portfolio.totalGainLossPercent >= 0 ? '+' : ''}
            {portfolio.totalGainLossPercent.toFixed(2)}%)
          </Text>
        </View>

        {/* Quick Stats */}
        <View style={styles.quickStats}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>YTD Return</Text>
            <Text
              style={[
                styles.statValue,
                { color: portfolio.performance.ytdReturn >= 0 ? '#34C759' : '#FF3B30' },
              ]}
            >
              {portfolio.performance.ytdReturn >= 0 ? '+' : ''}
              {portfolio.performance.ytdReturn.toFixed(2)}%
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>1Y Return</Text>
            <Text
              style={[
                styles.statValue,
                { color: portfolio.performance.oneYearReturn >= 0 ? '#34C759' : '#FF3B30' },
              ]}
            >
              {portfolio.performance.oneYearReturn >= 0 ? '+' : ''}
              {portfolio.performance.oneYearReturn.toFixed(2)}%
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Cash</Text>
            <Text style={styles.statValue}>
              ${(portfolio.cashBalance / 1000).toFixed(1)}k
            </Text>
          </View>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'overview' && styles.tabActive]}
          onPress={() => setSelectedTab('overview')}
        >
          <Text style={[styles.tabText, selectedTab === 'overview' && styles.tabTextActive]}>
            Overview
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'holdings' && styles.tabActive]}
          onPress={() => setSelectedTab('holdings')}
        >
          <Text style={[styles.tabText, selectedTab === 'holdings' && styles.tabTextActive]}>
            Holdings
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'performance' && styles.tabActive]}
          onPress={() => setSelectedTab('performance')}
        >
          <Text style={[styles.tabText, selectedTab === 'performance' && styles.tabTextActive]}>
            Performance
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'dividends' && styles.tabActive]}
          onPress={() => setSelectedTab('dividends')}
        >
          <Text style={[styles.tabText, selectedTab === 'dividends' && styles.tabTextActive]}>
            Dividends
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={() => refetch()} />
        }
      >
        {selectedTab === 'overview' && (
          <>
            {/* Asset Allocation */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Asset Allocation</Text>
              <View style={styles.chartCard}>
                <PieChart
                  data={allocationData}
                  width={screenWidth - 60}
                  height={220}
                  chartConfig={{
                    color: (opacity = 1) => `rgba(0, 122, 255, ${opacity})`,
                  }}
                  accessor="value"
                  backgroundColor="transparent"
                  paddingLeft="15"
                  absolute
                />
              </View>

              {/* Allocation Details */}
              {portfolio.allocations.map(alloc => (
                <View key={alloc.category} style={styles.allocationCard}>
                  <View style={styles.allocationHeader}>
                    <View style={styles.allocationInfo}>
                      <View
                        style={[styles.colorDot, { backgroundColor: alloc.color }]}
                      />
                      <Text style={styles.allocationCategory}>{alloc.category}</Text>
                    </View>
                    <Text style={styles.allocationValue}>
                      ${(alloc.value / 1000).toFixed(1)}k
                    </Text>
                  </View>
                  <View style={styles.allocationBars}>
                    <View style={styles.barContainer}>
                      <Text style={styles.barLabel}>Current</Text>
                      <View style={styles.barBackground}>
                        <View
                          style={[
                            styles.barFill,
                            {
                              width: `${(alloc.value / portfolio.totalValue) * 100}%`,
                              backgroundColor: alloc.color,
                            },
                          ]}
                        />
                      </View>
                      <Text style={styles.barValue}>
                        {((alloc.value / portfolio.totalValue) * 100).toFixed(1)}%
                      </Text>
                    </View>
                    <View style={styles.barContainer}>
                      <Text style={styles.barLabel}>Target</Text>
                      <View style={styles.barBackground}>
                        <View
                          style={[
                            styles.barFill,
                            { width: `${alloc.target}%`, backgroundColor: '#E5E5EA' },
                          ]}
                        />
                      </View>
                      <Text style={styles.barValue}>{alloc.target}%</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>

            {/* Rebalancing */}
            {portfolio.rebalancingNeeded && portfolio.rebalancingRecommendations && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Rebalancing Recommendations</Text>
                <View style={styles.warningBanner}>
                  <Ionicons name="warning" size={20} color="#FF9500" />
                  <Text style={styles.warningText}>
                    Your portfolio is out of balance with your target allocation
                  </Text>
                </View>

                {portfolio.rebalancingRecommendations.map((rec, index) => (
                  <View key={index} style={styles.rebalanceCard}>
                    <View style={styles.rebalanceHeader}>
                      <Ionicons
                        name={rec.action === 'buy' ? 'arrow-down-circle' : 'arrow-up-circle'}
                        size={24}
                        color={rec.action === 'buy' ? '#34C759' : '#FF3B30'}
                      />
                      <View style={styles.rebalanceInfo}>
                        <Text style={styles.rebalanceAction}>
                          {rec.action.toUpperCase()} {rec.category}
                        </Text>
                        <Text style={styles.rebalanceAmount}>
                          ${rec.amount.toLocaleString()}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))}

                <TouchableOpacity
                  style={styles.rebalanceButton}
                >
                  <Text style={styles.rebalanceButtonText}>Auto-Rebalance Portfolio</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Tax-Loss Harvesting */}
            {portfolio.taxHarvesting.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Tax-Loss Harvesting Opportunities</Text>
                {portfolio.taxHarvesting.map(opp => (
                  <View key={opp.id} style={styles.taxHarvestCard}>
                    <View style={styles.taxHarvestHeader}>
                      <Text style={styles.taxHarvestSymbol}>{opp.symbol}</Text>
                      <Text style={styles.taxHarvestLoss}>
                        -${opp.unrealizedLoss.toLocaleString()}
                      </Text>
                    </View>
                    <Text style={styles.taxHarvestSavings}>
                      Potential Tax Savings: ${opp.potentialTaxSavings.toLocaleString()}
                    </Text>
                    {opp.washSaleRisk && (
                      <View style={styles.washSaleBanner}>
                        <Ionicons name="alert-circle" size={16} color="#FF9500" />
                        <Text style={styles.washSaleText}>Wash sale risk</Text>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}

            {/* Benchmark Comparison */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Benchmark Comparison</Text>
              <View style={styles.benchmarkCard}>
                <Text style={styles.benchmarkName}>{portfolio.benchmarkComparison.benchmark}</Text>
                <View style={styles.benchmarkRow}>
                  <View style={styles.benchmarkItem}>
                    <Text style={styles.benchmarkLabel}>Your Portfolio</Text>
                    <Text
                      style={[
                        styles.benchmarkValue,
                        {
                          color:
                            portfolio.benchmarkComparison.portfolioReturn >= 0
                              ? '#34C759'
                              : '#FF3B30',
                        },
                      ]}
                    >
                      {portfolio.benchmarkComparison.portfolioReturn >= 0 ? '+' : ''}
                      {portfolio.benchmarkComparison.portfolioReturn.toFixed(2)}%
                    </Text>
                  </View>
                  <View style={styles.benchmarkItem}>
                    <Text style={styles.benchmarkLabel}>Benchmark</Text>
                    <Text
                      style={[
                        styles.benchmarkValue,
                        {
                          color:
                            portfolio.benchmarkComparison.benchmarkReturn >= 0
                              ? '#34C759'
                              : '#FF3B30',
                        },
                      ]}
                    >
                      {portfolio.benchmarkComparison.benchmarkReturn >= 0 ? '+' : ''}
                      {portfolio.benchmarkComparison.benchmarkReturn.toFixed(2)}%
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </>
        )}

        {selectedTab === 'holdings' && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Holdings</Text>
              <View style={styles.sortButtons}>
                <TouchableOpacity
                  style={[styles.sortButton, sortBy === 'value' && styles.sortButtonActive]}
                  onPress={() => setSortBy('value')}
                >
                  <Text
                    style={[
                      styles.sortButtonText,
                      sortBy === 'value' && styles.sortButtonTextActive,
                    ]}
                  >
                    Value
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.sortButton, sortBy === 'gain' && styles.sortButtonActive]}
                  onPress={() => setSortBy('gain')}
                >
                  <Text
                    style={[
                      styles.sortButtonText,
                      sortBy === 'gain' && styles.sortButtonTextActive,
                    ]}
                  >
                    Gain/Loss
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {sortedHoldings.map(holding => (
              <View key={holding.id} style={styles.holdingCard}>
                <View style={styles.holdingHeader}>
                  <View>
                    <Text style={styles.holdingSymbol}>{holding.symbol}</Text>
                    <Text style={styles.holdingName}>{holding.name}</Text>
                    <Text style={styles.holdingSector}>{holding.sector}</Text>
                  </View>
                  <View style={styles.holdingValueContainer}>
                    <Text style={styles.holdingValue}>
                      ${holding.currentValue.toLocaleString()}
                    </Text>
                    <Text
                      style={[
                        styles.holdingGain,
                        { color: holding.gainLoss >= 0 ? '#34C759' : '#FF3B30' },
                      ]}
                    >
                      {holding.gainLoss >= 0 ? '+' : ''}${holding.gainLoss.toLocaleString()} (
                      {holding.gainLossPercent >= 0 ? '+' : ''}
                      {holding.gainLossPercent.toFixed(2)}%)
                    </Text>
                  </View>
                </View>
                <View style={styles.holdingDetails}>
                  <View style={styles.holdingDetailRow}>
                    <Text style={styles.holdingDetailLabel}>Shares:</Text>
                    <Text style={styles.holdingDetailValue}>{holding.shares}</Text>
                  </View>
                  <View style={styles.holdingDetailRow}>
                    <Text style={styles.holdingDetailLabel}>Current Price:</Text>
                    <Text style={styles.holdingDetailValue}>
                      ${holding.currentPrice.toFixed(2)}
                    </Text>
                  </View>
                  <View style={styles.holdingDetailRow}>
                    <Text style={styles.holdingDetailLabel}>Cost Basis:</Text>
                    <Text style={styles.holdingDetailValue}>
                      ${holding.costBasis.toFixed(2)}
                    </Text>
                  </View>
                  {holding.dividendYield && (
                    <View style={styles.holdingDetailRow}>
                      <Text style={styles.holdingDetailLabel}>Dividend Yield:</Text>
                      <Text style={styles.holdingDetailValue}>
                        {holding.dividendYield.toFixed(2)}%
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        {selectedTab === 'performance' && (
          <>
            {/* Performance Chart */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Portfolio Performance</Text>
              <View style={styles.chartCard}>
                <LineChart
                  data={performanceData}
                  width={screenWidth - 60}
                  height={220}
                  yAxisLabel="$"
                  yAxisSuffix="k"
                  chartConfig={{
                    backgroundColor: '#FFFFFF',
                    backgroundGradientFrom: '#FFFFFF',
                    backgroundGradientTo: '#FFFFFF',
                    decimalPlaces: 0,
                    color: (opacity = 1) => `rgba(0, 122, 255, ${opacity})`,
                    labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                    propsForDots: {
                      r: '4',
                      strokeWidth: '2',
                      stroke: '#007AFF',
                    },
                  }}
                  bezier
                  style={styles.chart}
                />
              </View>
            </View>

            {/* Performance Metrics */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Performance Metrics</Text>
              <View style={styles.metricsGrid}>
                <View style={styles.metricCard}>
                  <Text style={styles.metricLabel}>Total Return</Text>
                  <Text
                    style={[
                      styles.metricValue,
                      { color: portfolio.performance.totalReturn >= 0 ? '#34C759' : '#FF3B30' },
                    ]}
                  >
                    {portfolio.performance.totalReturn >= 0 ? '+' : ''}
                    {portfolio.performance.totalReturn.toFixed(2)}%
                  </Text>
                </View>
                <View style={styles.metricCard}>
                  <Text style={styles.metricLabel}>Annualized Return</Text>
                  <Text
                    style={[
                      styles.metricValue,
                      {
                        color:
                          portfolio.performance.annualizedReturn >= 0 ? '#34C759' : '#FF3B30',
                      },
                    ]}
                  >
                    {portfolio.performance.annualizedReturn >= 0 ? '+' : ''}
                    {portfolio.performance.annualizedReturn.toFixed(2)}%
                  </Text>
                </View>
                <View style={styles.metricCard}>
                  <Text style={styles.metricLabel}>5Y Return</Text>
                  <Text
                    style={[
                      styles.metricValue,
                      { color: portfolio.performance.fiveYearReturn >= 0 ? '#34C759' : '#FF3B30' },
                    ]}
                  >
                    {portfolio.performance.fiveYearReturn >= 0 ? '+' : ''}
                    {portfolio.performance.fiveYearReturn.toFixed(2)}%
                  </Text>
                </View>
                <View style={styles.metricCard}>
                  <Text style={styles.metricLabel}>Sharpe Ratio</Text>
                  <Text style={styles.metricValue}>
                    {portfolio.performance.sharpeRatio.toFixed(2)}
                  </Text>
                </View>
                <View style={styles.metricCard}>
                  <Text style={styles.metricLabel}>Alpha</Text>
                  <Text style={styles.metricValue}>
                    {portfolio.performance.alpha.toFixed(2)}
                  </Text>
                </View>
                <View style={styles.metricCard}>
                  <Text style={styles.metricLabel}>Beta</Text>
                  <Text style={styles.metricValue}>
                    {portfolio.performance.beta.toFixed(2)}
                  </Text>
                </View>
                <View style={styles.metricCard}>
                  <Text style={styles.metricLabel}>Std Deviation</Text>
                  <Text style={styles.metricValue}>
                    {portfolio.performance.standardDeviation.toFixed(2)}%
                  </Text>
                </View>
                <View style={styles.metricCard}>
                  <Text style={styles.metricLabel}>Max Drawdown</Text>
                  <Text style={[styles.metricValue, { color: '#FF3B30' }]}>
                    {portfolio.performance.maxDrawdown.toFixed(2)}%
                  </Text>
                </View>
                <View style={styles.metricCard}>
                  <Text style={styles.metricLabel}>Avg Expense Ratio</Text>
                  <Text style={styles.metricValue}>
                    {portfolio.performance.avgExpenseRatio.toFixed(2)}%
                  </Text>
                </View>
              </View>
            </View>
          </>
        )}

        {selectedTab === 'dividends' && (
          <View style={styles.section}>
            <View style={styles.dividendSummary}>
              <View style={styles.dividendSummaryItem}>
                <Text style={styles.dividendSummaryLabel}>Annual Income</Text>
                <Text style={styles.dividendSummaryValue}>
                  ${portfolio.dividendIncome.totalAnnualIncome.toLocaleString()}
                </Text>
              </View>
              <View style={styles.dividendSummaryItem}>
                <Text style={styles.dividendSummaryLabel}>Average Yield</Text>
                <Text style={styles.dividendSummaryValue}>
                  {portfolio.dividendIncome.averageYield.toFixed(2)}%
                </Text>
              </View>
            </View>

            <Text style={styles.sectionTitle}>Dividend Income by Holding</Text>
            {portfolio.dividendIncome.total.map(div => (
              <View key={div.holdingId} style={styles.dividendCard}>
                <View style={styles.dividendHeader}>
                  <View>
                    <Text style={styles.dividendSymbol}>{div.symbol}</Text>
                    <Text style={styles.dividendFrequency}>{div.frequency}</Text>
                  </View>
                  <View style={styles.dividendAmounts}>
                    <Text style={styles.dividendAnnual}>
                      ${div.annualDividend.toLocaleString()}/yr
                    </Text>
                    <Text style={styles.dividendYield}>{div.dividendYield.toFixed(2)}% yield</Text>
                  </View>
                </View>
                <View style={styles.dividendFooter}>
                  <Text style={styles.dividendNext}>
                    Next Payment: {new Date(div.nextPaymentDate).toLocaleDateString()}
                  </Text>
                  {div.dripEnabled && (
                    <View style={styles.dripBadge}>
                      <Text style={styles.dripText}>DRIP</Text>
                    </View>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F7',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F7',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000',
  },
  portfolioCard: {
    backgroundColor: '#FFFFFF',
    margin: 15,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  portfolioLabel: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 8,
  },
  portfolioValue: {
    fontSize: 36,
    fontWeight: '700',
    color: '#000',
    marginBottom: 10,
  },
  gainLossContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  gainLossValue: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 6,
  },
  quickStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
    paddingTop: 15,
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  tab: {
    flex: 1,
    paddingVertical: 15,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#007AFF',
  },
  tabText: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#007AFF',
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 15,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
    marginBottom: 15,
  },
  chartCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 15,
  },
  chart: {
    borderRadius: 8,
  },
  allocationCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  allocationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  allocationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 10,
  },
  allocationCategory: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  allocationValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#007AFF',
  },
  allocationBars: {
    gap: 8,
  },
  barContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  barLabel: {
    fontSize: 12,
    color: '#8E8E93',
    width: 50,
  },
  barBackground: {
    flex: 1,
    height: 8,
    backgroundColor: '#E5E5EA',
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
  barValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#000',
    width: 45,
    textAlign: 'right',
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    padding: 12,
    borderRadius: 8,
    marginBottom: 15,
  },
  warningText: {
    fontSize: 13,
    color: '#FF9500',
    fontWeight: '600',
    marginLeft: 8,
    flex: 1,
  },
  rebalanceCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  rebalanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rebalanceInfo: {
    marginLeft: 12,
  },
  rebalanceAction: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  rebalanceAmount: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 2,
  },
  rebalanceButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  rebalanceButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  taxHarvestCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  taxHarvestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  taxHarvestSymbol: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  taxHarvestLoss: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FF3B30',
  },
  taxHarvestSavings: {
    fontSize: 14,
    color: '#34C759',
    fontWeight: '600',
    marginBottom: 8,
  },
  washSaleBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    padding: 8,
    borderRadius: 6,
  },
  washSaleText: {
    fontSize: 12,
    color: '#FF9500',
    marginLeft: 6,
  },
  benchmarkCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
  },
  benchmarkName: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 12,
    textAlign: 'center',
  },
  benchmarkRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  benchmarkItem: {
    alignItems: 'center',
  },
  benchmarkLabel: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 4,
  },
  benchmarkValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  sortButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  sortButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#F5F5F7',
  },
  sortButtonActive: {
    backgroundColor: '#007AFF',
  },
  sortButtonText: {
    fontSize: 13,
    color: '#000',
    fontWeight: '500',
  },
  sortButtonTextActive: {
    color: '#FFFFFF',
  },
  holdingCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  holdingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  holdingSymbol: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
  },
  holdingName: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 2,
  },
  holdingSector: {
    fontSize: 12,
    color: '#007AFF',
    marginTop: 2,
  },
  holdingValueContainer: {
    alignItems: 'flex-end',
  },
  holdingValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
  },
  holdingGain: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2,
  },
  holdingDetails: {
    borderTopWidth: 1,
    borderTopColor: '#F5F5F7',
    paddingTop: 12,
  },
  holdingDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  holdingDetailLabel: {
    fontSize: 13,
    color: '#8E8E93',
  },
  holdingDetailValue: {
    fontSize: 13,
    fontWeight: '500',
    color: '#000',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricCard: {
    flex: 1,
    minWidth: '30%',
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 11,
    color: '#8E8E93',
    marginBottom: 6,
    textAlign: 'center',
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
  },
  dividendSummary: {
    flexDirection: 'row',
    backgroundColor: '#E8F5E9',
    padding: 16,
    borderRadius: 12,
    marginBottom: 15,
  },
  dividendSummaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  dividendSummaryLabel: {
    fontSize: 13,
    color: '#2E7D32',
    marginBottom: 4,
  },
  dividendSummaryValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#34C759',
  },
  dividendCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  dividendHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  dividendSymbol: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
  },
  dividendFrequency: {
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 2,
  },
  dividendAmounts: {
    alignItems: 'flex-end',
  },
  dividendAnnual: {
    fontSize: 16,
    fontWeight: '700',
    color: '#34C759',
  },
  dividendYield: {
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 2,
  },
  dividendFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F5F5F7',
    paddingTop: 12,
  },
  dividendNext: {
    fontSize: 13,
    color: '#8E8E93',
  },
  dripBadge: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  dripText: {
    fontSize: 11,
    color: '#007AFF',
    fontWeight: '600',
  },
  loadingText: {
    fontSize: 16,
    color: '#8E8E93',
    marginTop: 10,
  },
  errorText: {
    fontSize: 16,
    color: '#FF3B30',
    marginTop: 10,
  },
  retryButton: {
    marginTop: 20,
    backgroundColor: '#007AFF',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 16,
    color: '#8E8E93',
    marginTop: 10,
  },
});
