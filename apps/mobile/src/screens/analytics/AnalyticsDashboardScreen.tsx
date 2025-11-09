/**
 * Life Navigator - Analytics Dashboard Screen
 *
 * Comprehensive analytics dashboard with AI insights, charts, and predictions
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { getAnalyticsDashboard } from '../../api/analytics';
import { colors } from '../../utils/colors';
import { spacing } from '../../utils/spacing';

// Components
import { LifeScoreCircle } from '../../components/analytics/LifeScoreCircle';
import { DomainScoresCard } from '../../components/analytics/DomainScoresCard';
import { CrossDomainInsights } from '../../components/analytics/CrossDomainInsights';
import { TrendCharts } from '../../components/analytics/TrendCharts';
import { PeriodComparisons } from '../../components/analytics/PeriodComparisons';
import { PredictiveAnalytics } from '../../components/analytics/PredictiveAnalytics';
import { ExportReports } from '../../components/analytics/ExportReports';

export function AnalyticsDashboardScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    overview: true,
    insights: true,
    charts: true,
    comparisons: false,
    predictions: false,
    exports: false,
  });

  // Fetch analytics dashboard data
  const {
    data: analyticsData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['analyticsDashboard'],
    queryFn: () => getAnalyticsDashboard(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  // Loading state
  if (isLoading && !analyticsData) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary.blue} />
        <Text style={styles.loadingText}>Loading analytics...</Text>
      </View>
    );
  }

  // Error state
  if (error && !analyticsData) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorTitle}>Failed to Load Analytics</Text>
        <Text style={styles.errorMessage}>
          {(error as any)?.message || 'An error occurred while loading analytics data'}
        </Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Empty state
  if (!analyticsData) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyIcon}>📊</Text>
        <Text style={styles.emptyTitle}>No Analytics Data</Text>
        <Text style={styles.emptyMessage}>
          Start tracking your life goals to see analytics
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.primary.blue}
          colors={[colors.primary.blue]}
        />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Analytics Dashboard</Text>
          <Text style={styles.headerSubtitle}>
            Comprehensive insights across all life domains
          </Text>
        </View>
      </View>

      {/* Overview Section */}
      <View style={styles.section}>
        <TouchableOpacity
          style={styles.sectionHeader}
          onPress={() => toggleSection('overview')}
        >
          <Text style={styles.sectionTitle}>Overview</Text>
          <Text style={styles.sectionIcon}>
            {expandedSections.overview ? '▼' : '▶'}
          </Text>
        </TouchableOpacity>
        {expandedSections.overview && (
          <View style={styles.sectionContent}>
            <LifeScoreCircle lifeScore={analyticsData.lifeScore} />
            <View style={styles.divider} />
            <DomainScoresCard domainScores={analyticsData.domainScores} />
          </View>
        )}
      </View>

      {/* Cross-Domain Insights */}
      <View style={styles.section}>
        <TouchableOpacity
          style={styles.sectionHeader}
          onPress={() => toggleSection('insights')}
        >
          <Text style={styles.sectionTitle}>AI-Powered Insights</Text>
          <View style={styles.sectionHeaderRight}>
            <View style={styles.insightBadge}>
              <Text style={styles.insightBadgeText}>
                {analyticsData.insights.length}
              </Text>
            </View>
            <Text style={styles.sectionIcon}>
              {expandedSections.insights ? '▼' : '▶'}
            </Text>
          </View>
        </TouchableOpacity>
        {expandedSections.insights && (
          <View style={styles.sectionContent}>
            <CrossDomainInsights insights={analyticsData.insights} />
          </View>
        )}
      </View>

      {/* Interactive Charts */}
      <View style={styles.section}>
        <TouchableOpacity
          style={styles.sectionHeader}
          onPress={() => toggleSection('charts')}
        >
          <Text style={styles.sectionTitle}>Trend Analysis</Text>
          <Text style={styles.sectionIcon}>
            {expandedSections.charts ? '▼' : '▶'}
          </Text>
        </TouchableOpacity>
        {expandedSections.charts && (
          <View style={styles.sectionContent}>
            <TrendCharts
              trendData={analyticsData.trendData}
              timeAllocation={analyticsData.timeAllocation}
              goalCompletion={analyticsData.goalCompletion}
            />
          </View>
        )}
      </View>

      {/* Period Comparisons */}
      <View style={styles.section}>
        <TouchableOpacity
          style={styles.sectionHeader}
          onPress={() => toggleSection('comparisons')}
        >
          <Text style={styles.sectionTitle}>Period Comparisons</Text>
          <Text style={styles.sectionIcon}>
            {expandedSections.comparisons ? '▼' : '▶'}
          </Text>
        </TouchableOpacity>
        {expandedSections.comparisons && (
          <View style={styles.sectionContent}>
            <PeriodComparisons comparisons={analyticsData.comparisons} />
          </View>
        )}
      </View>

      {/* Predictive Analytics */}
      <View style={styles.section}>
        <TouchableOpacity
          style={styles.sectionHeader}
          onPress={() => toggleSection('predictions')}
        >
          <Text style={styles.sectionTitle}>Predictive Analytics</Text>
          <Text style={styles.sectionIcon}>
            {expandedSections.predictions ? '▼' : '▶'}
          </Text>
        </TouchableOpacity>
        {expandedSections.predictions && (
          <View style={styles.sectionContent}>
            <PredictiveAnalytics predictions={analyticsData.predictions} />
          </View>
        )}
      </View>

      {/* Export & Reports */}
      <View style={styles.section}>
        <TouchableOpacity
          style={styles.sectionHeader}
          onPress={() => toggleSection('exports')}
        >
          <Text style={styles.sectionTitle}>Export & Reports</Text>
          <Text style={styles.sectionIcon}>
            {expandedSections.exports ? '▼' : '▶'}
          </Text>
        </TouchableOpacity>
        {expandedSections.exports && (
          <View style={styles.sectionContent}>
            <ExportReports onExportComplete={() => refetch()} />
          </View>
        )}
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Last updated: {new Date(analyticsData.lifeScore.lastUpdated).toLocaleString()}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.light.primary,
  },
  contentContainer: {
    paddingBottom: spacing[8],
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[6],
    backgroundColor: colors.light.primary,
  },
  loadingText: {
    marginTop: spacing[4],
    fontSize: 16,
    color: colors.text.light.secondary,
  },
  errorIcon: {
    fontSize: 64,
    marginBottom: spacing[4],
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.light.primary,
    marginBottom: spacing[2],
  },
  errorMessage: {
    fontSize: 14,
    color: colors.text.light.secondary,
    textAlign: 'center',
    marginBottom: spacing[4],
  },
  retryButton: {
    backgroundColor: colors.primary.blue,
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[3],
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.light.inverse,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: spacing[4],
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.light.primary,
    marginBottom: spacing[2],
  },
  emptyMessage: {
    fontSize: 14,
    color: colors.text.light.secondary,
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing[4],
    backgroundColor: colors.light.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text.light.primary,
  },
  headerSubtitle: {
    fontSize: 14,
    color: colors.text.light.secondary,
    marginTop: spacing[1],
  },
  section: {
    marginTop: spacing[4],
    backgroundColor: colors.light.primary,
    borderRadius: 16,
    overflow: 'hidden',
    marginHorizontal: spacing[4],
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing[4],
    backgroundColor: colors.light.secondary,
  },
  sectionHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.light.primary,
  },
  sectionIcon: {
    fontSize: 14,
    color: colors.text.light.tertiary,
  },
  insightBadge: {
    backgroundColor: colors.semantic.info,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: 12,
    minWidth: 24,
    alignItems: 'center',
  },
  insightBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text.light.inverse,
  },
  sectionContent: {
    backgroundColor: colors.light.primary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.light.border,
    marginVertical: spacing[4],
    marginHorizontal: spacing[4],
  },
  footer: {
    padding: spacing[4],
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: colors.text.light.tertiary,
  },
});
