/**
 * Life Navigator - Network Analytics Screen
 *
 * Comprehensive network analytics with charts and metrics
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  Alert,
} from 'react-native';
import { LineChart, PieChart, BarChart } from 'react-native-chart-kit';
import { colors } from '../../utils/colors';
import { spacing, borderRadius, shadows } from '../../utils/spacing';
import { textStyles } from '../../utils/typography';
import { NetworkAnalytics, SocialPlatformType } from '../../types/career';
import { getNetworkAnalytics } from '../../api/career';
import { formatNumber } from '../../utils/formatters';

const screenWidth = Dimensions.get('window').width;
const chartWidth = screenWidth - spacing[8];

export function NetworkAnalyticsScreen() {
  const [analytics, setAnalytics] = useState<NetworkAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<30 | 60 | 90>(30);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    setIsLoading(true);
    try {
      const data = await getNetworkAnalytics();
      setAnalytics(data);
    } catch (error) {
      console.error('Error loading analytics:', error);
      Alert.alert('Error', 'Failed to load network analytics');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadAnalytics();
    setIsRefreshing(false);
  };

  const getInfluenceColor = (score: number): string => {
    if (score >= 80) return colors.semantic.success;
    if (score >= 60) return colors.charts.blue;
    if (score >= 40) return colors.semantic.warning;
    return colors.semantic.error;
  };

  const getInfluenceRankLabel = (rank: string): string => {
    const labels: Record<string, string> = {
      novice: 'Novice',
      emerging: 'Emerging Influencer',
      established: 'Established',
      influencer: 'Influencer',
      thought_leader: 'Thought Leader',
    };
    return labels[rank] || rank;
  };

  const getPlatformColor = (platform: string): string => {
    const colorMap: Record<string, string> = {
      linkedin: '#0077B5',
      twitter: '#1DA1F2',
      instagram: '#E4405F',
      tiktok: '#000000',
    };
    return colorMap[platform] || colors.gray[500];
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.domains.career} />
      </View>
    );
  }

  if (!analytics) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>No analytics data available</Text>
      </View>
    );
  }

  // Prepare chart data
  const networkGrowthData = {
    labels: analytics.growthMetrics.historical
      .slice(-6)
      .map((d) => new Date(d.date).toLocaleDateString('en-US', { month: 'short' })),
    datasets: [
      {
        data: analytics.growthMetrics.historical.slice(-6).map((d) => d.total),
        color: (opacity = 1) => `rgba(0, 119, 181, ${opacity})`,
        strokeWidth: 2,
      },
    ],
  };

  const platformDistributionData = analytics.platformBreakdown.map((p) => ({
    name: p.platform.charAt(0).toUpperCase() + p.platform.slice(1),
    population: p.size,
    color: getPlatformColor(p.platform),
    legendFontColor: colors.text.light.secondary,
    legendFontSize: 12,
  }));

  const engagementData = {
    labels: analytics.engagementMetrics.byPlatform.map(
      (p) => p.platform.charAt(0).toUpperCase() + p.platform.slice(1)
    ),
    datasets: [
      {
        data: analytics.engagementMetrics.byPlatform.map((p) => p.engagementRate),
      },
    ],
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Network Analytics</Text>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Summary Cards */}
        <View style={styles.summaryCards}>
          <View style={[styles.summaryCard, { flex: 1 }]}>
            <Text style={styles.summaryLabel}>Total Network</Text>
            <Text style={styles.summaryValue}>
              {formatNumber(analytics.totalNetworkSize)}
            </Text>
            <Text style={styles.summaryChange}>
              +{analytics.growthMetrics.periods.last30Days} this month
            </Text>
          </View>
          <View style={[styles.summaryCard, { flex: 1 }]}>
            <Text style={styles.summaryLabel}>Growth Rate</Text>
            <Text style={styles.summaryValue}>
              {analytics.growthMetrics.currentPeriod.growthRate.toFixed(1)}%
            </Text>
            <Text style={styles.summaryChange}>Last 30 days</Text>
          </View>
        </View>

        {/* Influence Score Gauge */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Influence Score</Text>
          <View style={styles.influenceCard}>
            <View style={styles.influenceGauge}>
              <View style={styles.influenceCircle}>
                <Text
                  style={[
                    styles.influenceScore,
                    { color: getInfluenceColor(analytics.influenceScore.overall) },
                  ]}
                >
                  {analytics.influenceScore.overall}
                </Text>
                <Text style={styles.influenceMax}>/ 100</Text>
              </View>
            </View>
            <View style={styles.influenceDetails}>
              <Text style={styles.influenceRank}>
                {getInfluenceRankLabel(analytics.influenceScore.rank)}
              </Text>
              <Text style={styles.influencePercentile}>
                Top {100 - analytics.influenceScore.percentile}% of users
              </Text>
              <View style={styles.influenceBreakdown}>
                <View style={styles.influenceBreakdownItem}>
                  <Text style={styles.breakdownLabel}>Network Size</Text>
                  <Text style={styles.breakdownValue}>
                    {analytics.influenceScore.breakdown.networkSize}
                  </Text>
                </View>
                <View style={styles.influenceBreakdownItem}>
                  <Text style={styles.breakdownLabel}>Engagement</Text>
                  <Text style={styles.breakdownValue}>
                    {analytics.influenceScore.breakdown.engagement}
                  </Text>
                </View>
                <View style={styles.influenceBreakdownItem}>
                  <Text style={styles.breakdownLabel}>Content Quality</Text>
                  <Text style={styles.breakdownValue}>
                    {analytics.influenceScore.breakdown.contentQuality}
                  </Text>
                </View>
                <View style={styles.influenceBreakdownItem}>
                  <Text style={styles.breakdownLabel}>Consistency</Text>
                  <Text style={styles.breakdownValue}>
                    {analytics.influenceScore.breakdown.consistency}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Reach Metrics */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Reach Metrics</Text>
          <View style={styles.reachCard}>
            <View style={styles.reachRow}>
              <View style={styles.reachItem}>
                <Text style={styles.reachValue}>
                  {formatNumber(analytics.reachMetrics.totalReach)}
                </Text>
                <Text style={styles.reachLabel}>Total Reach</Text>
              </View>
              <View style={styles.reachItem}>
                <Text style={styles.reachValue}>
                  {formatNumber(analytics.reachMetrics.potentialReach)}
                </Text>
                <Text style={styles.reachLabel}>Potential Reach</Text>
              </View>
            </View>
            <View style={styles.impressions}>
              <Text style={styles.impressionsTitle}>Estimated Impressions</Text>
              <View style={styles.impressionsRow}>
                <View style={styles.impressionItem}>
                  <Text style={styles.impressionValue}>
                    {formatNumber(analytics.reachMetrics.estimatedImpressions.daily)}
                  </Text>
                  <Text style={styles.impressionLabel}>Daily</Text>
                </View>
                <View style={styles.impressionItem}>
                  <Text style={styles.impressionValue}>
                    {formatNumber(analytics.reachMetrics.estimatedImpressions.weekly)}
                  </Text>
                  <Text style={styles.impressionLabel}>Weekly</Text>
                </View>
                <View style={styles.impressionItem}>
                  <Text style={styles.impressionValue}>
                    {formatNumber(analytics.reachMetrics.estimatedImpressions.monthly)}
                  </Text>
                  <Text style={styles.impressionLabel}>Monthly</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Network Growth Chart */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Network Growth</Text>
          <View style={styles.chartCard}>
            <LineChart
              data={networkGrowthData}
              width={chartWidth}
              height={220}
              chartConfig={{
                backgroundColor: colors.light.primary,
                backgroundGradientFrom: colors.light.primary,
                backgroundGradientTo: colors.light.primary,
                decimalPlaces: 0,
                color: (opacity = 1) => `rgba(0, 119, 181, ${opacity})`,
                labelColor: (opacity = 1) => colors.text.light.secondary,
                style: {
                  borderRadius: borderRadius.lg,
                },
                propsForDots: {
                  r: '4',
                  strokeWidth: '2',
                  stroke: colors.domains.career,
                },
              }}
              bezier
              style={styles.chart}
            />
          </View>
        </View>

        {/* Platform Distribution */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Platform Distribution</Text>
          <View style={styles.chartCard}>
            <PieChart
              data={platformDistributionData}
              width={chartWidth}
              height={220}
              chartConfig={{
                color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
              }}
              accessor="population"
              backgroundColor="transparent"
              paddingLeft="15"
              absolute
            />
          </View>
        </View>

        {/* Engagement by Platform */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Engagement by Platform</Text>
          <View style={styles.chartCard}>
            <BarChart
              data={engagementData}
              width={chartWidth}
              height={220}
              chartConfig={{
                backgroundColor: colors.light.primary,
                backgroundGradientFrom: colors.light.primary,
                backgroundGradientTo: colors.light.primary,
                decimalPlaces: 1,
                color: (opacity = 1) => `rgba(0, 119, 181, ${opacity})`,
                labelColor: (opacity = 1) => colors.text.light.secondary,
              }}
              style={styles.chart}
              yAxisSuffix="%"
            />
          </View>
        </View>

        {/* Top Connections */}
        {analytics.topConnections.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Top Connections</Text>
            {analytics.topConnections.slice(0, 5).map((connection, index) => (
              <View key={connection.id} style={styles.connectionCard}>
                <View style={styles.connectionRank}>
                  <Text style={styles.connectionRankText}>{index + 1}</Text>
                </View>
                <View style={styles.connectionInfo}>
                  <Text style={styles.connectionName}>{connection.name}</Text>
                  <Text style={styles.connectionPlatform}>
                    {connection.platform.charAt(0).toUpperCase() +
                      connection.platform.slice(1)}
                  </Text>
                </View>
                <View style={styles.connectionStats}>
                  <Text style={styles.connectionScore}>
                    {connection.influenceScore}
                  </Text>
                  <Text style={styles.connectionScoreLabel}>Influence</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Geographic Distribution */}
        {analytics.geographicDistribution.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Geographic Distribution</Text>
            <View style={styles.listCard}>
              {analytics.geographicDistribution.slice(0, 5).map((geo, index) => (
                <View key={index} style={styles.listItem}>
                  <Text style={styles.listItemLabel}>
                    {geo.city ? `${geo.city}, ${geo.country}` : geo.country}
                  </Text>
                  <View style={styles.listItemValue}>
                    <Text style={styles.listItemCount}>{formatNumber(geo.count)}</Text>
                    <Text style={styles.listItemPercentage}>
                      {geo.percentage.toFixed(1)}%
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Industry Distribution */}
        {analytics.industryDistribution.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Industry Distribution</Text>
            <View style={styles.listCard}>
              {analytics.industryDistribution.slice(0, 5).map((industry, index) => (
                <View key={index} style={styles.listItem}>
                  <Text style={styles.listItemLabel}>{industry.industry}</Text>
                  <View style={styles.listItemValue}>
                    <Text style={styles.listItemCount}>
                      {formatNumber(industry.count)}
                    </Text>
                    <Text style={styles.listItemPercentage}>
                      {industry.percentage.toFixed(1)}%
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.light.secondary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.light.secondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.light.secondary,
  },
  errorText: {
    ...textStyles.body,
    color: colors.semantic.error,
  },
  header: {
    padding: spacing[4],
    backgroundColor: colors.light.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
  },
  title: {
    ...textStyles.h3,
    color: colors.text.light.primary,
  },
  content: {
    flex: 1,
    padding: spacing[4],
  },
  summaryCards: {
    flexDirection: 'row',
    gap: spacing[3],
    marginBottom: spacing[4],
  },
  summaryCard: {
    backgroundColor: colors.light.primary,
    padding: spacing[4],
    borderRadius: borderRadius.lg,
    ...shadows.sm,
  },
  summaryLabel: {
    ...textStyles.caption,
    color: colors.text.light.tertiary,
    marginBottom: spacing[1],
  },
  summaryValue: {
    ...textStyles.h2,
    color: colors.domains.career,
    marginBottom: spacing[1],
  },
  summaryChange: {
    ...textStyles.caption,
    color: colors.semantic.success,
  },
  section: {
    marginBottom: spacing[4],
  },
  sectionTitle: {
    ...textStyles.h4,
    color: colors.text.light.primary,
    marginBottom: spacing[3],
  },
  influenceCard: {
    backgroundColor: colors.light.primary,
    padding: spacing[4],
    borderRadius: borderRadius.lg,
    ...shadows.sm,
  },
  influenceGauge: {
    alignItems: 'center',
    marginBottom: spacing[4],
  },
  influenceCircle: {
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 8,
    borderColor: colors.light.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  influenceScore: {
    ...textStyles.h1,
    fontSize: 48,
  },
  influenceMax: {
    ...textStyles.caption,
    color: colors.text.light.tertiary,
  },
  influenceDetails: {
    alignItems: 'center',
  },
  influenceRank: {
    ...textStyles.h4,
    color: colors.text.light.primary,
    marginBottom: spacing[1],
  },
  influencePercentile: {
    ...textStyles.body,
    color: colors.text.light.secondary,
    marginBottom: spacing[3],
  },
  influenceBreakdown: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[3],
    justifyContent: 'center',
  },
  influenceBreakdownItem: {
    alignItems: 'center',
    minWidth: 80,
  },
  breakdownLabel: {
    ...textStyles.caption,
    color: colors.text.light.tertiary,
    marginBottom: spacing[1],
  },
  breakdownValue: {
    ...textStyles.h4,
    color: colors.domains.career,
  },
  reachCard: {
    backgroundColor: colors.light.primary,
    padding: spacing[4],
    borderRadius: borderRadius.lg,
    ...shadows.sm,
  },
  reachRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: spacing[4],
    paddingBottom: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
  },
  reachItem: {
    alignItems: 'center',
  },
  reachValue: {
    ...textStyles.h2,
    color: colors.domains.career,
    marginBottom: spacing[1],
  },
  reachLabel: {
    ...textStyles.caption,
    color: colors.text.light.tertiary,
  },
  impressions: {
    alignItems: 'center',
  },
  impressionsTitle: {
    ...textStyles.label,
    color: colors.text.light.secondary,
    marginBottom: spacing[2],
  },
  impressionsRow: {
    flexDirection: 'row',
    gap: spacing[4],
  },
  impressionItem: {
    alignItems: 'center',
  },
  impressionValue: {
    ...textStyles.h4,
    color: colors.text.light.primary,
    marginBottom: spacing[1],
  },
  impressionLabel: {
    ...textStyles.caption,
    color: colors.text.light.tertiary,
  },
  chartCard: {
    backgroundColor: colors.light.primary,
    padding: spacing[4],
    borderRadius: borderRadius.lg,
    ...shadows.sm,
  },
  chart: {
    borderRadius: borderRadius.lg,
  },
  connectionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.light.primary,
    padding: spacing[3],
    borderRadius: borderRadius.md,
    marginBottom: spacing[2],
    ...shadows.sm,
  },
  connectionRank: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.full,
    backgroundColor: colors.domains.career,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[3],
  },
  connectionRankText: {
    ...textStyles.label,
    color: colors.text.light.inverse,
  },
  connectionInfo: {
    flex: 1,
  },
  connectionName: {
    ...textStyles.body,
    color: colors.text.light.primary,
    marginBottom: spacing[1],
  },
  connectionPlatform: {
    ...textStyles.caption,
    color: colors.text.light.tertiary,
  },
  connectionStats: {
    alignItems: 'center',
  },
  connectionScore: {
    ...textStyles.h4,
    color: colors.domains.career,
  },
  connectionScoreLabel: {
    ...textStyles.caption,
    color: colors.text.light.tertiary,
  },
  listCard: {
    backgroundColor: colors.light.primary,
    padding: spacing[4],
    borderRadius: borderRadius.lg,
    ...shadows.sm,
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
  },
  listItemLabel: {
    ...textStyles.body,
    color: colors.text.light.primary,
    flex: 1,
  },
  listItemValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  listItemCount: {
    ...textStyles.body,
    color: colors.text.light.secondary,
  },
  listItemPercentage: {
    ...textStyles.label,
    color: colors.domains.career,
    minWidth: 50,
    textAlign: 'right',
  },
});

export default NetworkAnalyticsScreen;
