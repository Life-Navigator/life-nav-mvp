/**
 * Life Navigator - AI Insights Screen
 *
 * Elite-level AI-powered insights and recommendations
 * Personalized action items, pattern detection, and predictive analytics
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { colors } from '../../utils/colors';
import { spacing, borderRadius, shadows } from '../../utils/spacing';
import { textStyles } from '../../utils/typography';
import { Card } from '../../components/common/Card';

// Types
interface AIInsight {
  id: string;
  type: 'recommendation' | 'pattern' | 'anomaly' | 'optimization' | 'goal' | 'integration' | 'prediction' | 'risk' | 'benchmark' | 'reminder';
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  confidence: number;
  domain: string[];
  actionItems?: ActionItem[];
  metadata?: {
    trend?: 'up' | 'down' | 'stable';
    impact?: string;
    timeframe?: string;
    prediction?: number;
  };
  createdAt: string;
}

interface ActionItem {
  id: string;
  title: string;
  completed: boolean;
}

interface Pattern {
  id: string;
  name: string;
  description: string;
  frequency: string;
  lastOccurrence: string;
  trend: 'improving' | 'declining' | 'stable';
}

interface Prediction {
  id: string;
  goalId: string;
  goalName: string;
  successProbability: number;
  estimatedCompletion: string;
  factors: string[];
}

export function AIInsightsScreen() {
  const [selectedTab, setSelectedTab] = useState<'all' | 'recommendations' | 'patterns' | 'predictions'>('all');
  const [refreshing, setRefreshing] = useState(false);

  // Fetch AI insights
  const { data: insights, isLoading, refetch } = useQuery<AIInsight[]>({
    queryKey: ['ai-insights', selectedTab],
    queryFn: async () => {
      // TODO: Replace with actual API call
      return mockInsights;
    },
  });

  // Fetch patterns
  const { data: patterns } = useQuery<Pattern[]>({
    queryKey: ['ai-patterns'],
    queryFn: async () => {
      return mockPatterns;
    },
  });

  // Fetch predictions
  const { data: predictions } = useQuery<Prediction[]>({
    queryKey: ['ai-predictions'],
    queryFn: async () => {
      return mockPredictions;
    },
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return colors.error;
      case 'medium':
        return colors.warning;
      case 'low':
        return colors.info;
      default:
        return colors.gray[500];
    }
  };

  const getInsightIcon = (type: string) => {
    const icons: Record<string, string> = {
      recommendation: '💡',
      pattern: '📊',
      anomaly: '⚠️',
      optimization: '⚡',
      goal: '🎯',
      integration: '🔗',
      prediction: '🔮',
      risk: '⛔',
      benchmark: '📈',
      reminder: '🔔',
    };
    return icons[type] || '📌';
  };

  const renderInsightCard = (insight: AIInsight) => (
    <Card key={insight.id} style={styles.insightCard} shadow="sm">
      <View style={styles.insightHeader}>
        <View style={styles.insightTitle}>
          <Text style={styles.insightIcon}>{getInsightIcon(insight.type)}</Text>
          <View style={styles.insightTitleText}>
            <Text style={styles.insightType}>{insight.type.toUpperCase()}</Text>
            <Text style={styles.title}>{insight.title}</Text>
          </View>
        </View>
        <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(insight.priority) + '20' }]}>
          <Text style={[styles.priorityText, { color: getPriorityColor(insight.priority) }]}>
            {insight.priority}
          </Text>
        </View>
      </View>

      <Text style={styles.description}>{insight.description}</Text>

      <View style={styles.insightMeta}>
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>Confidence</Text>
          <View style={styles.confidenceBar}>
            <View
              style={[
                styles.confidenceFill,
                { width: `${insight.confidence}%`, backgroundColor: colors.primary },
              ]}
            />
          </View>
          <Text style={styles.metaValue}>{insight.confidence}%</Text>
        </View>
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>Domains</Text>
          <View style={styles.domainTags}>
            {insight.domain.map((d) => (
              <View key={d} style={styles.domainTag}>
                <Text style={styles.domainText}>{d}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      {insight.actionItems && insight.actionItems.length > 0 && (
        <View style={styles.actionItems}>
          <Text style={styles.actionItemsTitle}>Action Items</Text>
          {insight.actionItems.map((action) => (
            <TouchableOpacity key={action.id} style={styles.actionItem}>
              <View style={[styles.checkbox, action.completed && styles.checkboxCompleted]}>
                {action.completed && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={[styles.actionText, action.completed && styles.actionTextCompleted]}>
                {action.title}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </Card>
  );

  const renderPatternCard = (pattern: Pattern) => (
    <Card key={pattern.id} style={styles.patternCard} shadow="sm">
      <View style={styles.patternHeader}>
        <Text style={styles.patternIcon}>📊</Text>
        <View style={styles.patternInfo}>
          <Text style={styles.patternName}>{pattern.name}</Text>
          <Text style={styles.patternFrequency}>{pattern.frequency}</Text>
        </View>
        <View style={[styles.trendBadge, { backgroundColor: getTrendColor(pattern.trend) + '20' }]}>
          <Text style={[styles.trendText, { color: getTrendColor(pattern.trend) }]}>
            {getTrendIcon(pattern.trend)} {pattern.trend}
          </Text>
        </View>
      </View>
      <Text style={styles.patternDescription}>{pattern.description}</Text>
      <Text style={styles.patternMeta}>Last seen: {pattern.lastOccurrence}</Text>
    </Card>
  );

  const renderPredictionCard = (prediction: Prediction) => (
    <Card key={prediction.id} style={styles.predictionCard} shadow="sm">
      <View style={styles.predictionHeader}>
        <Text style={styles.predictionIcon}>🔮</Text>
        <View style={styles.predictionInfo}>
          <Text style={styles.predictionGoal}>{prediction.goalName}</Text>
          <Text style={styles.predictionCompletion}>Est. completion: {prediction.estimatedCompletion}</Text>
        </View>
      </View>

      <View style={styles.probabilitySection}>
        <Text style={styles.probabilityLabel}>Success Probability</Text>
        <View style={styles.probabilityBar}>
          <View
            style={[
              styles.probabilityFill,
              {
                width: `${prediction.successProbability}%`,
                backgroundColor: getProbabilityColor(prediction.successProbability),
              },
            ]}
          />
        </View>
        <Text style={[styles.probabilityValue, { color: getProbabilityColor(prediction.successProbability) }]}>
          {prediction.successProbability}%
        </Text>
      </View>

      <View style={styles.factorsList}>
        <Text style={styles.factorsTitle}>Key Factors</Text>
        {prediction.factors.map((factor, index) => (
          <Text key={index} style={styles.factorItem}>
            • {factor}
          </Text>
        ))}
      </View>
    </Card>
  );

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'improving':
        return colors.success;
      case 'declining':
        return colors.error;
      default:
        return colors.gray[500];
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving':
        return '↗';
      case 'declining':
        return '↘';
      default:
        return '→';
    }
  };

  const getProbabilityColor = (probability: number) => {
    if (probability >= 70) return colors.success;
    if (probability >= 40) return colors.warning;
    return colors.error;
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Analyzing your data...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>AI Insights</Text>
        <Text style={styles.headerSubtitle}>Personalized recommendations powered by AI</Text>
      </View>

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabs}>
        {['all', 'recommendations', 'patterns', 'predictions'].map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, selectedTab === tab && styles.tabActive]}
            onPress={() => setSelectedTab(tab as any)}
          >
            <Text style={[styles.tabText, selectedTab === tab && styles.tabTextActive]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Content */}
      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Insights Section */}
        {(selectedTab === 'all' || selectedTab === 'recommendations') && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Smart Recommendations</Text>
            {insights?.map(renderInsightCard)}
          </View>
        )}

        {/* Patterns Section */}
        {(selectedTab === 'all' || selectedTab === 'patterns') && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Detected Patterns</Text>
            {patterns?.map(renderPatternCard)}
          </View>
        )}

        {/* Predictions Section */}
        {(selectedTab === 'all' || selectedTab === 'predictions') && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Success Predictions</Text>
            {predictions?.map(renderPredictionCard)}
          </View>
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
}

// Mock data (TODO: Replace with real API data)
const mockInsights: AIInsight[] = [
  {
    id: '1',
    type: 'recommendation',
    title: 'Optimize your medication schedule',
    description: 'Based on your daily routine, taking medications at 8 AM and 8 PM would improve adherence by 35%.',
    priority: 'high',
    confidence: 92,
    domain: ['healthcare'],
    actionItems: [
      { id: 'a1', title: 'Set morning medication reminder for 8 AM', completed: false },
      { id: 'a2', title: 'Set evening medication reminder for 8 PM', completed: false },
    ],
    createdAt: new Date().toISOString(),
  },
  {
    id: '2',
    type: 'anomaly',
    title: 'Unusual spending pattern detected',
    description: 'Your grocery spending is 45% higher than usual this month. Consider reviewing your budget.',
    priority: 'medium',
    confidence: 87,
    domain: ['finance'],
    createdAt: new Date().toISOString(),
  },
  {
    id: '3',
    type: 'optimization',
    title: 'Consolidate your appointments',
    description: 'You have 3 medical appointments next week. Scheduling them on the same day could save 2 hours of travel time.',
    priority: 'low',
    confidence: 78,
    domain: ['healthcare'],
    actionItems: [
      { id: 'a3', title: 'Call Dr. Smith to reschedule', completed: false },
      { id: 'a4', title: 'Update calendar', completed: false },
    ],
    createdAt: new Date().toISOString(),
  },
  {
    id: '4',
    type: 'goal',
    title: 'New goal recommendation: Emergency fund',
    description: 'Based on your income and expenses, we recommend building an emergency fund of $12,000.',
    priority: 'high',
    confidence: 95,
    domain: ['finance'],
    createdAt: new Date().toISOString(),
  },
  {
    id: '5',
    type: 'integration',
    title: 'Connect health and fitness data',
    description: 'Linking your fitness tracker would provide better insights on your wellness goals.',
    priority: 'low',
    confidence: 82,
    domain: ['healthcare', 'goals'],
    createdAt: new Date().toISOString(),
  },
];

const mockPatterns: Pattern[] = [
  {
    id: 'p1',
    name: 'Weekly Exercise Routine',
    description: 'You consistently exercise on Monday, Wednesday, and Friday mornings.',
    frequency: '3x per week',
    lastOccurrence: '2 days ago',
    trend: 'improving',
  },
  {
    id: 'p2',
    name: 'Weekend Spending Spike',
    description: 'Your spending typically increases by 40% on weekends, primarily on dining and entertainment.',
    frequency: 'Weekly',
    lastOccurrence: '3 days ago',
    trend: 'stable',
  },
  {
    id: 'p3',
    name: 'Evening Productivity Dip',
    description: 'Your task completion rate drops significantly after 6 PM.',
    frequency: 'Daily',
    lastOccurrence: 'Today',
    trend: 'declining',
  },
];

const mockPredictions: Prediction[] = [
  {
    id: 'pred1',
    goalId: 'g1',
    goalName: 'Save $10,000 for vacation',
    successProbability: 85,
    estimatedCompletion: 'August 2026',
    factors: [
      'Current savings rate: $450/month',
      'Consistent income stream',
      'Low debt-to-income ratio',
      'Historical savings behavior',
    ],
  },
  {
    id: 'pred2',
    goalId: 'g2',
    goalName: 'Complete AWS certification',
    successProbability: 62,
    estimatedCompletion: 'March 2026',
    factors: [
      'Study time: 3 hours/week (below recommended 5 hours)',
      'Current progress: 45%',
      'Exam scheduled in 4 months',
      'Previous certification success rate',
    ],
  },
  {
    id: 'pred3',
    goalId: 'g3',
    goalName: 'Reduce medication count',
    successProbability: 78,
    estimatedCompletion: 'June 2026',
    factors: [
      'Current adherence: 92%',
      'Regular doctor visits scheduled',
      'Improving health metrics',
      'Lifestyle modifications in progress',
    ],
  },
];

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.gray[50],
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.gray[50],
  },
  loadingText: {
    ...textStyles.body,
    color: colors.gray[600],
    marginTop: spacing[2],
  },
  header: {
    backgroundColor: colors.light.primary,
    padding: spacing[4],
    paddingTop: spacing[6],
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
  },
  headerTitle: {
    ...textStyles.h2,
    color: colors.gray[900],
  },
  headerSubtitle: {
    ...textStyles.body,
    color: colors.gray[600],
    marginTop: spacing[1],
  },
  tabs: {
    backgroundColor: colors.light.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[2],
  },
  tab: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    marginRight: spacing[2],
    borderRadius: borderRadius.full,
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    ...textStyles.body,
    color: colors.gray[600],
    fontWeight: '600',
  },
  tabTextActive: {
    color: colors.light.primary,
  },
  content: {
    flex: 1,
  },
  section: {
    padding: spacing[4],
  },
  sectionTitle: {
    ...textStyles.h3,
    color: colors.gray[900],
    marginBottom: spacing[3],
  },
  insightCard: {
    marginBottom: spacing[3],
  },
  insightHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing[3],
  },
  insightTitle: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
  },
  insightIcon: {
    fontSize: 24,
    marginRight: spacing[2],
  },
  insightTitleText: {
    flex: 1,
  },
  insightType: {
    ...textStyles.caption,
    color: colors.primary,
    fontWeight: '700',
    marginBottom: spacing[1],
  },
  title: {
    ...textStyles.h4,
    color: colors.gray[900],
  },
  priorityBadge: {
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.md,
  },
  priorityText: {
    ...textStyles.caption,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  description: {
    ...textStyles.body,
    color: colors.gray[700],
    marginBottom: spacing[3],
    lineHeight: 22,
  },
  insightMeta: {
    marginBottom: spacing[3],
  },
  metaItem: {
    marginBottom: spacing[2],
  },
  metaLabel: {
    ...textStyles.caption,
    color: colors.gray[600],
    marginBottom: spacing[1],
  },
  confidenceBar: {
    height: 8,
    backgroundColor: colors.gray[200],
    borderRadius: borderRadius.full,
    marginBottom: spacing[1],
    overflow: 'hidden',
  },
  confidenceFill: {
    height: '100%',
    borderRadius: borderRadius.full,
  },
  metaValue: {
    ...textStyles.caption,
    color: colors.gray[900],
    fontWeight: '600',
  },
  domainTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  domainTag: {
    backgroundColor: colors.gray[100],
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.md,
    marginRight: spacing[2],
    marginTop: spacing[1],
  },
  domainText: {
    ...textStyles.caption,
    color: colors.gray[700],
    textTransform: 'capitalize',
  },
  actionItems: {
    borderTopWidth: 1,
    borderTopColor: colors.gray[200],
    paddingTop: spacing[3],
  },
  actionItemsTitle: {
    ...textStyles.body,
    color: colors.gray[900],
    fontWeight: '600',
    marginBottom: spacing[2],
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[2],
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: colors.gray[400],
    borderRadius: borderRadius.sm,
    marginRight: spacing[2],
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxCompleted: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  checkmark: {
    color: colors.light.primary,
    fontSize: 12,
    fontWeight: 'bold',
  },
  actionText: {
    ...textStyles.body,
    color: colors.gray[700],
    flex: 1,
  },
  actionTextCompleted: {
    textDecorationLine: 'line-through',
    color: colors.gray[500],
  },
  patternCard: {
    marginBottom: spacing[3],
  },
  patternHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[2],
  },
  patternIcon: {
    fontSize: 32,
    marginRight: spacing[3],
  },
  patternInfo: {
    flex: 1,
  },
  patternName: {
    ...textStyles.h4,
    color: colors.gray[900],
    marginBottom: spacing[1],
  },
  patternFrequency: {
    ...textStyles.caption,
    color: colors.gray[600],
  },
  trendBadge: {
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.md,
  },
  trendText: {
    ...textStyles.caption,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  patternDescription: {
    ...textStyles.body,
    color: colors.gray[700],
    marginBottom: spacing[2],
    lineHeight: 22,
  },
  patternMeta: {
    ...textStyles.caption,
    color: colors.gray[500],
  },
  predictionCard: {
    marginBottom: spacing[3],
  },
  predictionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing[3],
  },
  predictionIcon: {
    fontSize: 32,
    marginRight: spacing[3],
  },
  predictionInfo: {
    flex: 1,
  },
  predictionGoal: {
    ...textStyles.h4,
    color: colors.gray[900],
    marginBottom: spacing[1],
  },
  predictionCompletion: {
    ...textStyles.caption,
    color: colors.gray[600],
  },
  probabilitySection: {
    marginBottom: spacing[3],
  },
  probabilityLabel: {
    ...textStyles.body,
    color: colors.gray[900],
    fontWeight: '600',
    marginBottom: spacing[2],
  },
  probabilityBar: {
    height: 12,
    backgroundColor: colors.gray[200],
    borderRadius: borderRadius.full,
    marginBottom: spacing[1],
    overflow: 'hidden',
  },
  probabilityFill: {
    height: '100%',
    borderRadius: borderRadius.full,
  },
  probabilityValue: {
    ...textStyles.h3,
    fontWeight: '700',
  },
  factorsList: {
    borderTopWidth: 1,
    borderTopColor: colors.gray[200],
    paddingTop: spacing[3],
  },
  factorsTitle: {
    ...textStyles.body,
    color: colors.gray[900],
    fontWeight: '600',
    marginBottom: spacing[2],
  },
  factorItem: {
    ...textStyles.body,
    color: colors.gray[700],
    marginBottom: spacing[1],
    lineHeight: 22,
  },
  bottomPadding: {
    height: spacing[8],
  },
});
