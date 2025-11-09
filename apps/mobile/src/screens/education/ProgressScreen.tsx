/**
 * Life Navigator - Learning Progress Screen
 *
 * Learning progress dashboard with charts and milestones
 */

import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useLearningProgress } from '../../hooks/useEducation';
import { colors } from '../../utils/colors';
import { spacing, borderRadius, shadows } from '../../utils/spacing';
import { textStyles } from '../../utils/typography';
import { formatDate } from '../../utils/formatters';

const { width } = Dimensions.get('window');

export function ProgressScreen() {
  const { data: progress, isLoading, error } = useLearningProgress();

  const renderStreakCalendar = (currentStreak: number, longestStreak: number) => {
    return (
      <View style={styles.streakContainer}>
        <View style={styles.streakCard}>
          <Text style={styles.streakValue}>{currentStreak}</Text>
          <Text style={styles.streakLabel}>Current Streak</Text>
          <Text style={styles.streakSubtext}>days</Text>
        </View>
        <View style={styles.streakDivider} />
        <View style={styles.streakCard}>
          <Text style={[styles.streakValue, { color: colors.charts.yellow }]}>
            {longestStreak}
          </Text>
          <Text style={styles.streakLabel}>Longest Streak</Text>
          <Text style={styles.streakSubtext}>days</Text>
        </View>
      </View>
    );
  };

  const renderWeeklyChart = (weeklyHours: number[]) => {
    const maxHours = Math.max(...weeklyHours, 1);
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    return (
      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>Weekly Learning Hours</Text>
        <View style={styles.barChart}>
          {weeklyHours.map((hours, index) => (
            <View key={index} style={styles.barContainer}>
              <View style={styles.barColumn}>
                <View
                  style={[
                    styles.bar,
                    {
                      height: `${(hours / maxHours) * 100}%`,
                      backgroundColor: colors.primary.blue,
                    },
                  ]}
                />
              </View>
              <Text style={styles.barLabel}>{days[index]}</Text>
              <Text style={styles.barValue}>{hours}h</Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  const renderMonthlyChart = (monthlyHours: number[]) => {
    const maxHours = Math.max(...monthlyHours, 1);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];

    return (
      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>Monthly Learning Hours</Text>
        <View style={styles.barChart}>
          {monthlyHours.slice(0, 6).map((hours, index) => (
            <View key={index} style={styles.barContainer}>
              <View style={styles.barColumn}>
                <View
                  style={[
                    styles.bar,
                    {
                      height: `${(hours / maxHours) * 100}%`,
                      backgroundColor: colors.charts.green,
                    },
                  ]}
                />
              </View>
              <Text style={styles.barLabel}>{months[index]}</Text>
              <Text style={styles.barValue}>{hours}h</Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary.blue} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Failed to load progress data</Text>
      </View>
    );
  }

  if (!progress) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>No progress data available</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Header Stats */}
      <View style={styles.headerStats}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{progress.totalHoursLearned}</Text>
          <Text style={styles.statLabel}>Total Hours</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: colors.semantic.success }]}>
            {progress.completedCourses}
          </Text>
          <Text style={styles.statLabel}>Completed</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: colors.charts.blue }]}>
            {progress.inProgressCourses}
          </Text>
          <Text style={styles.statLabel}>In Progress</Text>
        </View>
      </View>

      {/* Course Progress Overview */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Course Overview</Text>
        <View style={styles.progressOverview}>
          <View style={styles.progressRow}>
            <Text style={styles.progressLabel}>Total Courses:</Text>
            <Text style={styles.progressValue}>{progress.totalCourses}</Text>
          </View>
          <View style={styles.progressRow}>
            <Text style={styles.progressLabel}>Completed:</Text>
            <Text style={[styles.progressValue, { color: colors.semantic.success }]}>
              {progress.completedCourses}
            </Text>
          </View>
          <View style={styles.progressRow}>
            <Text style={styles.progressLabel}>In Progress:</Text>
            <Text style={[styles.progressValue, { color: colors.charts.blue }]}>
              {progress.inProgressCourses}
            </Text>
          </View>
          <View style={styles.progressRow}>
            <Text style={styles.progressLabel}>Completion Rate:</Text>
            <Text style={[styles.progressValue, { color: colors.primary.blue }]}>
              {progress.totalCourses > 0
                ? Math.round((progress.completedCourses / progress.totalCourses) * 100)
                : 0}
              %
            </Text>
          </View>
        </View>
      </View>

      {/* Certifications Overview */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Certifications</Text>
        <View style={styles.progressOverview}>
          <View style={styles.progressRow}>
            <Text style={styles.progressLabel}>Total Certifications:</Text>
            <Text style={styles.progressValue}>{progress.totalCertifications}</Text>
          </View>
          <View style={styles.progressRow}>
            <Text style={styles.progressLabel}>Active:</Text>
            <Text style={[styles.progressValue, { color: colors.semantic.success }]}>
              {progress.activeCertifications}
            </Text>
          </View>
        </View>
      </View>

      {/* Study Streak */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Study Streak</Text>
        {renderStreakCalendar(progress.currentStreak, progress.longestStreak)}
      </View>

      {/* Weekly Chart */}
      {progress.weeklyHours && progress.weeklyHours.length > 0 && (
        <View style={styles.section}>
          {renderWeeklyChart(progress.weeklyHours)}
        </View>
      )}

      {/* Monthly Chart */}
      {progress.monthlyHours && progress.monthlyHours.length > 0 && (
        <View style={styles.section}>
          {renderMonthlyChart(progress.monthlyHours)}
        </View>
      )}

      {/* Achievements */}
      {progress.achievements && progress.achievements.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Achievements</Text>
          {progress.achievements.map((achievement) => (
            <View key={achievement.id} style={styles.achievementCard}>
              <View style={styles.achievementIcon}>
                <Text style={styles.achievementIconText}>
                  {achievement.icon || '🏆'}
                </Text>
              </View>
              <View style={styles.achievementInfo}>
                <Text style={styles.achievementTitle}>{achievement.title}</Text>
                <Text style={styles.achievementDescription}>
                  {achievement.description}
                </Text>
                <Text style={styles.achievementDate}>
                  {formatDate(achievement.earnedDate)}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Milestones */}
      {progress.milestones && progress.milestones.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Learning Milestones</Text>
          {progress.milestones.map((milestone) => (
            <View key={milestone.id} style={styles.milestoneCard}>
              <View style={styles.milestoneHeader}>
                <Text style={styles.milestoneTitle}>{milestone.title}</Text>
                {milestone.achieved && (
                  <Text style={styles.milestoneAchieved}>✓</Text>
                )}
              </View>
              <Text style={styles.milestoneDescription}>
                {milestone.description}
              </Text>
              <View style={styles.milestoneProgress}>
                <View style={styles.milestoneProgressBar}>
                  <View
                    style={[
                      styles.milestoneProgressFill,
                      {
                        width: `${Math.min(
                          (milestone.current / milestone.target) * 100,
                          100
                        )}%`,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.milestoneProgressText}>
                  {milestone.current}/{milestone.target} {milestone.unit}
                </Text>
              </View>
              {milestone.achievedDate && (
                <Text style={styles.milestoneDate}>
                  Achieved: {formatDate(milestone.achievedDate)}
                </Text>
              )}
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.light.secondary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.light.secondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.light.secondary,
    padding: spacing[6],
  },
  errorText: {
    ...textStyles.body,
    color: colors.semantic.error,
    textAlign: 'center',
  },
  headerStats: {
    flexDirection: 'row',
    padding: spacing[4],
    gap: spacing[3],
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.light.primary,
    padding: spacing[4],
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    ...shadows.sm,
  },
  statValue: {
    ...textStyles.h2,
    color: colors.primary.blue,
    marginBottom: spacing[1],
  },
  statLabel: {
    ...textStyles.caption,
    color: colors.text.light.tertiary,
    textAlign: 'center',
  },
  section: {
    backgroundColor: colors.light.primary,
    margin: spacing[4],
    padding: spacing[4],
    borderRadius: borderRadius.lg,
    ...shadows.sm,
  },
  sectionTitle: {
    ...textStyles.h4,
    color: colors.text.light.primary,
    marginBottom: spacing[3],
  },
  progressOverview: {
    gap: spacing[2],
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing[1],
  },
  progressLabel: {
    ...textStyles.body,
    color: colors.text.light.secondary,
  },
  progressValue: {
    ...textStyles.body,
    color: colors.text.light.primary,
    fontWeight: '600',
  },
  streakContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  streakCard: {
    flex: 1,
    alignItems: 'center',
    padding: spacing[3],
  },
  streakValue: {
    ...textStyles.h1,
    color: colors.semantic.success,
    marginBottom: spacing[1],
  },
  streakLabel: {
    ...textStyles.label,
    color: colors.text.light.secondary,
    marginBottom: spacing[1],
  },
  streakSubtext: {
    ...textStyles.caption,
    color: colors.text.light.tertiary,
  },
  streakDivider: {
    width: 1,
    height: '80%',
    backgroundColor: colors.light.border,
  },
  chartContainer: {
    marginTop: spacing[2],
  },
  chartTitle: {
    ...textStyles.label,
    color: colors.text.light.secondary,
    marginBottom: spacing[3],
  },
  barChart: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: 150,
    paddingTop: spacing[2],
  },
  barContainer: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: spacing[1],
  },
  barColumn: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-end',
    marginBottom: spacing[2],
  },
  bar: {
    width: '100%',
    minHeight: 4,
    borderRadius: borderRadius.sm,
  },
  barLabel: {
    ...textStyles.caption,
    color: colors.text.light.tertiary,
    marginTop: spacing[1],
  },
  barValue: {
    ...textStyles.labelSmall,
    color: colors.text.light.secondary,
  },
  achievementCard: {
    flexDirection: 'row',
    padding: spacing[3],
    backgroundColor: colors.light.tertiary,
    borderRadius: borderRadius.md,
    marginBottom: spacing[2],
  },
  achievementIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.full,
    backgroundColor: colors.charts.yellow,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[3],
  },
  achievementIconText: {
    fontSize: 24,
  },
  achievementInfo: {
    flex: 1,
  },
  achievementTitle: {
    ...textStyles.h4,
    color: colors.text.light.primary,
    marginBottom: spacing[1],
  },
  achievementDescription: {
    ...textStyles.bodySmall,
    color: colors.text.light.secondary,
    marginBottom: spacing[1],
  },
  achievementDate: {
    ...textStyles.caption,
    color: colors.text.light.tertiary,
  },
  milestoneCard: {
    padding: spacing[3],
    backgroundColor: colors.light.tertiary,
    borderRadius: borderRadius.md,
    marginBottom: spacing[2],
  },
  milestoneHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[2],
  },
  milestoneTitle: {
    ...textStyles.h4,
    color: colors.text.light.primary,
    flex: 1,
  },
  milestoneAchieved: {
    fontSize: 24,
    color: colors.semantic.success,
  },
  milestoneDescription: {
    ...textStyles.bodySmall,
    color: colors.text.light.secondary,
    marginBottom: spacing[2],
  },
  milestoneProgress: {
    marginBottom: spacing[2],
  },
  milestoneProgressBar: {
    height: 8,
    backgroundColor: colors.gray[200],
    borderRadius: borderRadius.full,
    overflow: 'hidden',
    marginBottom: spacing[1],
  },
  milestoneProgressFill: {
    height: '100%',
    backgroundColor: colors.primary.blue,
    borderRadius: borderRadius.full,
  },
  milestoneProgressText: {
    ...textStyles.caption,
    color: colors.text.light.tertiary,
  },
  milestoneDate: {
    ...textStyles.caption,
    color: colors.semantic.success,
  },
});

export default ProgressScreen;
