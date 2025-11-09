/**
 * Life Navigator - Learning Path Screen
 *
 * Personalized learning path and recommendations
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

export function LearningPathScreen() {
  return (
    <ScrollView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Learning Path</Text>
        <Text style={styles.description}>
          Get personalized course recommendations based on your goals and interests.
          Build a customized learning path to advance your career.
        </Text>

        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>Coming Soon</Text>
          <Text style={styles.placeholderSubtext}>
            AI-powered learning path recommendations will be available in a future update
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
