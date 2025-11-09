/**
 * Life Navigator - Health Screen
 *
 * Health and wellness tracking
 */

import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useHealthcare } from '../../hooks/useHealthcare';
import { colors } from '../../utils/colors';
import { spacing } from '../../utils/spacing';

export function HealthScreen() {
  const { data, isLoading } = useHealthcare();

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Health Summary */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Health Overview</Text>
        <View style={styles.metricsGrid}>
          <View style={styles.metric}>
            <Text style={styles.metricValue}>120/80</Text>
            <Text style={styles.metricLabel}>Blood Pressure</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricValue}>72</Text>
            <Text style={styles.metricLabel}>Heart Rate</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricValue}>7.5</Text>
            <Text style={styles.metricLabel}>Hours Sleep</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricValue}>8,432</Text>
            <Text style={styles.metricLabel}>Steps</Text>
          </View>
        </View>
      </View>

      {/* Upcoming Appointments */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Upcoming Appointments</Text>
        {data?.appointments?.length > 0 ? (
          data.appointments.map((apt: any) => (
            <View key={apt.id} style={styles.appointmentItem}>
              <Text style={styles.appointmentTitle}>{apt.title}</Text>
              <Text style={styles.appointmentDate}>
                {new Date(apt.date).toLocaleDateString()}
              </Text>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>No upcoming appointments</Text>
        )}
      </View>

      {/* Medications */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Medications</Text>
        <Text style={styles.emptyText}>No medications tracked yet</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  card: {
    backgroundColor: colors.surface,
    margin: spacing.md,
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.md,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  metric: {
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
    padding: spacing.sm,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  metricLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  appointmentItem: {
    padding: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  appointmentTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  appointmentDate: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    padding: spacing.md,
  },
});
