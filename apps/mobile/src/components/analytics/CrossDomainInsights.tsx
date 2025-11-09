/**
 * Life Navigator - Cross-Domain Insights Component
 *
 * AI-powered recommendations and insights across all domains
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors } from '../../utils/colors';
import { spacing } from '../../utils/spacing';
import { CrossDomainInsight } from '../../types/analytics';

interface CrossDomainInsightsProps {
  insights: CrossDomainInsight[];
}

export const CrossDomainInsights: React.FC<CrossDomainInsightsProps> = ({ insights }) => {
  const getPriorityColor = (priority: string) => {
    const priorityColors: Record<string, string> = {
      high: colors.semantic.error,
      medium: colors.semantic.warning,
      low: colors.semantic.info,
    };
    return priorityColors[priority] || colors.gray[500];
  };

  const getTypeIcon = (type: string) => {
    const typeIcons: Record<string, string> = {
      recommendation: '💡',
      risk: '⚠️',
      opportunity: '🎯',
    };
    return typeIcons[type] || '📊';
  };

  const getTypeColor = (type: string) => {
    const typeColors: Record<string, string> = {
      recommendation: colors.charts.blue,
      risk: colors.semantic.error,
      opportunity: colors.semantic.success,
    };
    return typeColors[type] || colors.gray[500];
  };

  const renderImpactScore = (score: number) => {
    const bars = Math.ceil(score / 20);
    return (
      <View style={styles.impactBars}>
        {[1, 2, 3, 4, 5].map((bar) => (
          <View
            key={bar}
            style={[
              styles.impactBar,
              {
                backgroundColor: bar <= bars ? colors.semantic.success : colors.gray[300],
              },
            ]}
          />
        ))}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Cross-Domain Insights</Text>
      <Text style={styles.subtitle}>AI-powered recommendations across all life areas</Text>

      <View style={styles.insightsList}>
        {insights.map((insight) => (
          <TouchableOpacity key={insight.id} style={styles.insightCard}>
            <View style={styles.insightHeader}>
              <View style={styles.typeContainer}>
                <Text style={styles.typeIcon}>{getTypeIcon(insight.type)}</Text>
                <View
                  style={[
                    styles.typeBadge,
                    { backgroundColor: getTypeColor(insight.type) },
                  ]}
                >
                  <Text style={styles.typeText}>{insight.type}</Text>
                </View>
              </View>
              <View
                style={[
                  styles.priorityBadge,
                  { backgroundColor: getPriorityColor(insight.priority) },
                ]}
              >
                <Text style={styles.priorityText}>{insight.priority}</Text>
              </View>
            </View>

            <Text style={styles.insightTitle}>{insight.title}</Text>
            <Text style={styles.insightDescription}>{insight.description}</Text>

            <View style={styles.insightFooter}>
              <View style={styles.domainsContainer}>
                {insight.domains.map((domain) => (
                  <View key={domain} style={styles.domainTag}>
                    <Text style={styles.domainTagText}>{domain}</Text>
                  </View>
                ))}
              </View>
              <View style={styles.impactContainer}>
                <Text style={styles.impactLabel}>Impact</Text>
                {renderImpactScore(insight.impactScore)}
              </View>
            </View>

            {insight.actionable && (
              <View style={styles.actionableContainer}>
                <Text style={styles.actionableText}>✓ Actionable</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: spacing[4],
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.light.primary,
    marginBottom: spacing[1],
  },
  subtitle: {
    fontSize: 14,
    color: colors.text.light.secondary,
    marginBottom: spacing[4],
  },
  insightsList: {
    gap: spacing[3],
  },
  insightCard: {
    backgroundColor: colors.light.secondary,
    borderRadius: 12,
    padding: spacing[4],
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  insightHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[3],
  },
  typeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  typeIcon: {
    fontSize: 20,
  },
  typeBadge: {
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: 8,
  },
  typeText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.text.light.inverse,
    textTransform: 'uppercase',
  },
  priorityBadge: {
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: 8,
  },
  priorityText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.text.light.inverse,
    textTransform: 'uppercase',
  },
  insightTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.light.primary,
    marginBottom: spacing[2],
  },
  insightDescription: {
    fontSize: 14,
    color: colors.text.light.secondary,
    lineHeight: 20,
    marginBottom: spacing[3],
  },
  insightFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  domainsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[1],
    flex: 1,
  },
  domainTag: {
    backgroundColor: colors.light.tertiary,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: 6,
  },
  domainTagText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.text.light.secondary,
    textTransform: 'capitalize',
  },
  impactContainer: {
    alignItems: 'flex-end',
  },
  impactLabel: {
    fontSize: 10,
    color: colors.text.light.tertiary,
    marginBottom: spacing[1],
  },
  impactBars: {
    flexDirection: 'row',
    gap: 2,
  },
  impactBar: {
    width: 4,
    height: 16,
    borderRadius: 2,
  },
  actionableContainer: {
    marginTop: spacing[3],
    paddingTop: spacing[3],
    borderTopWidth: 1,
    borderTopColor: colors.light.border,
  },
  actionableText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.semantic.success,
  },
});
