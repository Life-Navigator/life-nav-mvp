/**
 * Life Navigator - Insights Screen
 *
 * Analytics, reports, and data insights
 */

import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { colors } from '../../utils/colors';
import { spacing, borderRadius, shadows } from '../../utils/spacing';
import { textStyles } from '../../utils/typography';

export function InsightsScreen() {
  return (
    <ScrollView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Insights & Analytics</Text>
        <Text style={styles.description}>
          Get detailed analytics and insights about your health, finances, career progress, and more.
        </Text>

        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>Coming Soon</Text>
          <Text style={styles.placeholderSubtext}>
            Advanced analytics and insights will be available in a future update
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.gray[50],
  },
  card: {
    backgroundColor: colors.light.primary,
    margin: spacing[4],
    padding: spacing[4],
    borderRadius: borderRadius.lg,
    ...shadows.md,
  },
  title: {
    ...textStyles.h3,
    color: colors.gray[900],
    marginBottom: spacing[2],
  },
  description: {
    ...textStyles.body,
    color: colors.gray[600],
    marginBottom: spacing[4],
  },
  placeholder: {
    alignItems: 'center',
    padding: spacing[8],
    backgroundColor: colors.gray[50],
    borderRadius: borderRadius.lg,
  },
  placeholderText: {
    ...textStyles.h4,
    color: colors.gray[700],
    marginBottom: spacing[2],
  },
  placeholderSubtext: {
    ...textStyles.body,
    color: colors.gray[500],
    textAlign: 'center',
  },
});
