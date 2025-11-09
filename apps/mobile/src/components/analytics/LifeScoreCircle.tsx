/**
 * Life Navigator - Life Score Circle Component
 *
 * Circular progress chart for overall life score
 */

import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { ProgressChart } from 'react-native-chart-kit';
import { colors } from '../../utils/colors';
import { spacing } from '../../utils/spacing';
import { LifeScore } from '../../types/analytics';

interface LifeScoreCircleProps {
  lifeScore: LifeScore;
}

export const LifeScoreCircle: React.FC<LifeScoreCircleProps> = ({ lifeScore }) => {
  const screenWidth = Dimensions.get('window').width;

  const data = {
    labels: ['Life Score'],
    data: [lifeScore.overall / 100],
  };

  const chartConfig = {
    backgroundGradientFrom: colors.light.primary,
    backgroundGradientTo: colors.light.primary,
    color: (opacity = 1) => {
      const score = lifeScore.overall;
      if (score >= 80) return `rgba(16, 185, 129, ${opacity})`; // green
      if (score >= 60) return `rgba(59, 130, 246, ${opacity})`; // blue
      if (score >= 40) return `rgba(245, 158, 11, ${opacity})`; // yellow
      return `rgba(239, 68, 68, ${opacity})`; // red
    },
    strokeWidth: 2,
    barPercentage: 0.5,
  };

  const getTrendIcon = () => {
    switch (lifeScore.trend) {
      case 'up':
        return '↑';
      case 'down':
        return '↓';
      default:
        return '→';
    }
  };

  const getTrendColor = () => {
    switch (lifeScore.trend) {
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
      <View style={styles.chartContainer}>
        <ProgressChart
          data={data}
          width={screenWidth - spacing[8]}
          height={220}
          strokeWidth={16}
          radius={80}
          chartConfig={chartConfig}
          hideLegend={true}
        />
        <View style={styles.scoreOverlay}>
          <Text style={styles.scoreValue}>{lifeScore.overall}</Text>
          <Text style={styles.scoreLabel}>Life Score</Text>
          <View style={styles.trendContainer}>
            <Text style={[styles.trendIcon, { color: getTrendColor() }]}>
              {getTrendIcon()}
            </Text>
            <Text style={[styles.trendValue, { color: getTrendColor() }]}>
              {Math.abs(lifeScore.change)}%
            </Text>
          </View>
        </View>
      </View>
      <Text style={styles.lastUpdated}>
        Last updated: {new Date(lifeScore.lastUpdated).toLocaleDateString()}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  chartContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreOverlay: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreValue: {
    fontSize: 48,
    fontWeight: '700',
    color: colors.text.light.primary,
  },
  scoreLabel: {
    fontSize: 14,
    color: colors.text.light.secondary,
    marginTop: spacing[1],
  },
  trendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing[2],
  },
  trendIcon: {
    fontSize: 20,
    fontWeight: '700',
  },
  trendValue: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: spacing[1],
  },
  lastUpdated: {
    fontSize: 12,
    color: colors.text.light.tertiary,
    marginTop: spacing[3],
  },
});
