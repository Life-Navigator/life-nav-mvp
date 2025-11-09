/**
 * Life Navigator - Domain Scores Card Component
 *
 * Display scores for all 4 domains with color-coded status
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../utils/colors';
import { spacing } from '../../utils/spacing';
import { DomainScore } from '../../types/analytics';

interface DomainScoresCardProps {
  domainScores: DomainScore[];
}

export const DomainScoresCard: React.FC<DomainScoresCardProps> = ({ domainScores }) => {
  const getDomainColor = (domain: string) => {
    const domainColors: Record<string, string> = {
      health: colors.domains.healthcare,
      finance: colors.domains.finance,
      career: colors.domains.career,
      education: '#3B82F6', // blue for education
    };
    return domainColors[domain] || colors.primary.blue;
  };

  const getStatusColor = (status: string) => {
    const statusColors: Record<string, string> = {
      excellent: colors.semantic.success,
      good: colors.charts.blue,
      fair: colors.semantic.warning,
      poor: colors.semantic.error,
    };
    return statusColors[status] || colors.gray[500];
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return '↑';
      case 'down':
        return '↓';
      default:
        return '→';
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'up':
        return colors.semantic.success;
      case 'down':
        return colors.semantic.error;
      default:
        return colors.gray[500];
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Domain Scores</Text>
      <View style={styles.scoresGrid}>
        {domainScores.map((item) => (
          <View key={item.domain} style={styles.scoreCard}>
            <View style={styles.scoreHeader}>
              <View
                style={[
                  styles.domainIndicator,
                  { backgroundColor: getDomainColor(item.domain) },
                ]}
              />
              <Text style={styles.domainName}>
                {item.domain.charAt(0).toUpperCase() + item.domain.slice(1)}
              </Text>
            </View>
            <View style={styles.scoreContent}>
              <Text style={styles.scoreValue}>{item.score}</Text>
              <View style={styles.scoreDetails}>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: getStatusColor(item.status) },
                  ]}
                >
                  <Text style={styles.statusText}>{item.status}</Text>
                </View>
                <View style={styles.trendContainer}>
                  <Text style={[styles.trendIcon, { color: getTrendColor(item.trend) }]}>
                    {getTrendIcon(item.trend)}
                  </Text>
                  <Text style={[styles.trendValue, { color: getTrendColor(item.trend) }]}>
                    {Math.abs(item.change)}%
                  </Text>
                </View>
              </View>
            </View>
          </View>
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
    marginBottom: spacing[4],
  },
  scoresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[3],
  },
  scoreCard: {
    width: '48%',
    backgroundColor: colors.light.secondary,
    borderRadius: 12,
    padding: spacing[4],
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  scoreHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[3],
  },
  domainIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing[2],
  },
  domainName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.light.secondary,
  },
  scoreContent: {
    alignItems: 'flex-start',
  },
  scoreValue: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.text.light.primary,
    marginBottom: spacing[2],
  },
  scoreDetails: {
    width: '100%',
  },
  statusBadge: {
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: spacing[2],
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.text.light.inverse,
    textTransform: 'uppercase',
  },
  trendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trendIcon: {
    fontSize: 16,
    fontWeight: '700',
  },
  trendValue: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: spacing[1],
  },
});
