/**
 * Life Navigator - Loading Skeleton Component
 *
 * Skeleton loading state for analytics dashboard
 */

import React from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { colors } from '../../utils/colors';
import { spacing } from '../../utils/spacing';

export const LoadingSkeleton: React.FC = () => {
  const shimmerAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const opacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <View style={styles.container}>
      {/* Life Score Circle Skeleton */}
      <View style={styles.section}>
        <Animated.View style={[styles.circleSkeleton, { opacity }]} />
      </View>

      {/* Domain Scores Skeleton */}
      <View style={styles.section}>
        <View style={styles.gridContainer}>
          {[1, 2, 3, 4].map((i) => (
            <Animated.View key={i} style={[styles.cardSkeleton, { opacity }]} />
          ))}
        </View>
      </View>

      {/* Insights Skeleton */}
      <View style={styles.section}>
        {[1, 2, 3].map((i) => (
          <Animated.View key={i} style={[styles.insightSkeleton, { opacity }]} />
        ))}
      </View>

      {/* Chart Skeleton */}
      <View style={styles.section}>
        <Animated.View style={[styles.chartSkeleton, { opacity }]} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: spacing[4],
    backgroundColor: colors.light.primary,
  },
  section: {
    marginBottom: spacing[6],
  },
  circleSkeleton: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: colors.gray[200],
    alignSelf: 'center',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[3],
  },
  cardSkeleton: {
    width: '48%',
    height: 120,
    borderRadius: 12,
    backgroundColor: colors.gray[200],
  },
  insightSkeleton: {
    height: 140,
    borderRadius: 12,
    backgroundColor: colors.gray[200],
    marginBottom: spacing[3],
  },
  chartSkeleton: {
    height: 220,
    borderRadius: 16,
    backgroundColor: colors.gray[200],
  },
});
