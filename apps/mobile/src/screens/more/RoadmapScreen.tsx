/**
 * Life Navigator - Roadmap Screen
 *
 * Life planning roadmap and milestones
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

export function RoadmapScreen() {
  return (
    <ScrollView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Life Roadmap</Text>
        <Text style={styles.description}>
          Visualize your life journey with milestones, goals, and achievements over time.
        </Text>

        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>Coming Soon</Text>
          <Text style={styles.placeholderSubtext}>
            Interactive life roadmap will be available in a future update
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
