/**
 * Life Navigator - Career Screen
 *
 * Career development and job tracking
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
import { api } from '../../api/client';
import { colors } from '../../utils/colors';
import { spacing } from '../../utils/spacing';

export function CareerScreen() {
  const { data, isLoading } = useQuery({
    queryKey: ['career'],
    queryFn: () => api.get('/career/profile'),
  });

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Career Profile */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Current Position</Text>
        <Text style={styles.positionTitle}>
          {data?.title || 'No position set'}
        </Text>
        <Text style={styles.company}>{data?.company || 'Add company'}</Text>
      </View>

      {/* Skills */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Skills</Text>
        <View style={styles.skillsContainer}>
          {data?.skills?.length > 0 ? (
            data.skills.map((skill: string, index: number) => (
              <View key={index} style={styles.skillChip}>
                <Text style={styles.skillText}>{skill}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>No skills added yet</Text>
          )}
        </View>
      </View>

      {/* Job Applications */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Active Applications</Text>
        <Text style={styles.emptyText}>No active job applications</Text>
      </View>

      {/* Network */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Professional Network</Text>
        <View style={styles.stat}>
          <Text style={styles.statValue}>
            {data?.networkSize || 0}
          </Text>
          <Text style={styles.statLabel}>Connections</Text>
        </View>
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
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.md,
  },
  positionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  company: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  skillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  skillChip: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 16,
  },
  skillText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
  stat: {
    alignItems: 'center',
    padding: spacing.md,
  },
  statValue: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  statLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    padding: spacing.md,
  },
});
