/**
 * Life Navigator - Education Overview Screen
 *
 * Education and learning progress overview
 */

import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { EducationStackParamList } from '../../navigation/types';
import { colors } from '../../utils/colors';
import { spacing, borderRadius, shadows } from '../../utils/spacing';
import { textStyles } from '../../utils/typography';

type NavigationProp = NativeStackNavigationProp<EducationStackParamList>;

export function EducationOverview() {
  const navigation = useNavigation<NavigationProp>();

  const stats = [
    { label: 'Active Courses', value: '3', color: colors.primary.blue },
    { label: 'Certifications', value: '5', color: colors.semantic.success },
    { label: 'Hours Learned', value: '127', color: colors.domains.career },
    { label: 'Completion Rate', value: '78%', color: colors.semantic.warning },
  ];

  const quickActions = [
    { label: 'My Courses', screen: 'Courses' as const, icon: '\uD83D\uDCDA' },
    { label: 'Certifications', screen: 'Certifications' as const, icon: '\uD83C\uDF93' },
    { label: 'Progress', screen: 'Progress' as const, icon: '\uD83D\uDCC8' },
    { label: 'Learning Path', screen: 'LearningPath' as const, icon: '\uD83D\uDEE4\uFE0F' },
  ];

  return (
    <ScrollView style={styles.container}>
      {/* Header Summary */}
      <View style={styles.headerCard}>
        <Text style={styles.headerTitle}>My Learning Journey</Text>
        <Text style={styles.headerSubtitle}>
          Track your educational progress and achievements
        </Text>
      </View>

      {/* Stats Grid */}
      <View style={styles.statsContainer}>
        <Text style={styles.sectionTitle}>Overview</Text>
        <View style={styles.statsGrid}>
          {stats.map((stat, index) => (
            <View key={index} style={styles.statCard}>
              <Text style={[styles.statValue, { color: stat.color }]}>
                {stat.value}
              </Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.actionsContainer}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsGrid}>
          {quickActions.map((action, index) => (
            <TouchableOpacity
              key={index}
              style={styles.actionCard}
              onPress={() => navigation.navigate(action.screen)}
            >
              <Text style={styles.actionIcon}>{action.icon}</Text>
              <Text style={styles.actionLabel}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Recent Activity */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Recent Activity</Text>
        <View style={styles.activityItem}>
          <Text style={styles.activityText}>
            Completed: Introduction to React Native
          </Text>
          <Text style={styles.activityDate}>2 days ago</Text>
        </View>
        <View style={styles.activityItem}>
          <Text style={styles.activityText}>
            Started: Advanced TypeScript Patterns
          </Text>
          <Text style={styles.activityDate}>5 days ago</Text>
        </View>
        <View style={styles.activityItem}>
          <Text style={styles.activityText}>
            Earned: AWS Solutions Architect Certification
          </Text>
          <Text style={styles.activityDate}>1 week ago</Text>
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
  headerCard: {
    backgroundColor: colors.primary.blue,
    padding: spacing[6],
    marginBottom: spacing[4],
  },
  headerTitle: {
    ...textStyles.h2,
    color: colors.light.primary,
    marginBottom: spacing[2],
  },
  headerSubtitle: {
    ...textStyles.body,
    color: colors.light.primary,
    opacity: 0.9,
  },
  statsContainer: {
    padding: spacing[4],
  },
  sectionTitle: {
    ...textStyles.h4,
    color: colors.gray[900],
    marginBottom: spacing[3],
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[3],
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.light.primary,
    padding: spacing[4],
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    ...shadows.sm,
  },
  statValue: {
    ...textStyles.h2,
    marginBottom: spacing[1],
  },
  statLabel: {
    ...textStyles.bodySmall,
    color: colors.gray[600],
    textAlign: 'center',
  },
  actionsContainer: {
    padding: spacing[4],
    paddingTop: 0,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[3],
  },
  actionCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.light.primary,
    padding: spacing[4],
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    ...shadows.sm,
  },
  actionIcon: {
    fontSize: 32,
    marginBottom: spacing[2],
  },
  actionLabel: {
    ...textStyles.label,
    color: colors.gray[900],
    textAlign: 'center',
  },
  card: {
    backgroundColor: colors.light.primary,
    margin: spacing[4],
    marginTop: 0,
    padding: spacing[4],
    borderRadius: borderRadius.lg,
    ...shadows.sm,
  },
  cardTitle: {
    ...textStyles.h4,
    color: colors.gray[900],
    marginBottom: spacing[3],
  },
  activityItem: {
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
  },
  activityText: {
    ...textStyles.body,
    color: colors.gray[900],
    marginBottom: spacing[1],
  },
  activityDate: {
    ...textStyles.caption,
    color: colors.gray[500],
  },
});
