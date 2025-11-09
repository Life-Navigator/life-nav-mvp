/**
 * Life Navigator - Courses Screen
 *
 * Course management and progress tracking
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  ProgressBarAndroid,
  ProgressViewIOS,
  Platform,
} from 'react-native';
import { useCourses, useUpdateCourse } from '../../hooks/useEducation';
import { colors } from '../../utils/colors';
import { spacing, borderRadius, shadows } from '../../utils/spacing';
import { textStyles } from '../../utils/typography';
import { formatDate } from '../../utils/formatters';
import { Course } from '../../types';

const ProgressBar = Platform.OS === 'ios' ? ProgressViewIOS : ProgressBarAndroid;

export function CoursesScreen() {
  const { data: courses, isLoading, error } = useCourses();
  const updateCourse = useUpdateCourse();

  const [selectedStatus, setSelectedStatus] = useState<string>('All');

  const statuses = ['All', 'In Progress', 'Not Started', 'Completed'];

  const filteredCourses = courses?.filter((course) => {
    if (selectedStatus === 'All') return true;
    return course.status === selectedStatus.toLowerCase().replace(' ', '_');
  });

  const getStatusColor = (status: string) => {
    const colorMap: Record<string, string> = {
      not_started: colors.gray[400],
      in_progress: colors.charts.blue,
      completed: colors.semantic.success,
    };
    return colorMap[status] || colors.gray[400];
  };

  const isDueSoon = (deadline?: string) => {
    if (!deadline) return false;
    const daysUntilDeadline = Math.floor(
      (new Date(deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysUntilDeadline >= 0 && daysUntilDeadline <= 7;
  };

  const isOverdue = (deadline?: string) => {
    if (!deadline) return false;
    return new Date(deadline) < new Date();
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
        <Text style={styles.errorText}>Failed to load courses</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>My Courses</Text>
        <TouchableOpacity style={styles.addButton}>
          <Text style={styles.addButtonText}>+ Add Course</Text>
        </TouchableOpacity>
      </View>

      {/* Status Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.statusFilter}
      >
        {statuses.map((status) => (
          <TouchableOpacity
            key={status}
            style={[
              styles.statusChip,
              selectedStatus === status && styles.statusChipActive,
            ]}
            onPress={() => setSelectedStatus(status)}
          >
            <Text
              style={[
                styles.statusChipText,
                selectedStatus === status && styles.statusChipTextActive,
              ]}
            >
              {status}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Summary Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>
            {courses?.filter((c) => c.status === 'in_progress').length || 0}
          </Text>
          <Text style={styles.statLabel}>Active</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: colors.semantic.success }]}>
            {courses?.filter((c) => c.status === 'completed').length || 0}
          </Text>
          <Text style={styles.statLabel}>Completed</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: colors.semantic.warning }]}>
            {courses?.filter((c) => c.deadline && isDueSoon(c.deadline)).length || 0}
          </Text>
          <Text style={styles.statLabel}>Due Soon</Text>
        </View>
      </View>

      {/* Courses List */}
      <ScrollView style={styles.coursesList}>
        {filteredCourses?.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No courses found</Text>
            <Text style={styles.emptySubtext}>
              Add courses to start tracking your learning journey
            </Text>
          </View>
        ) : (
          filteredCourses?.map((course) => (
            <TouchableOpacity key={course.id} style={styles.courseCard}>
              {/* Course Header */}
              <View style={styles.courseHeader}>
                <View style={styles.courseInfo}>
                  <Text style={styles.courseTitle}>{course.title}</Text>
                  <Text style={styles.platformText}>{course.platform}</Text>
                  {course.instructor && (
                    <Text style={styles.instructorText}>
                      by {course.instructor}
                    </Text>
                  )}
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: getStatusColor(course.status) },
                  ]}
                >
                  <Text style={styles.statusText}>
                    {course.status.replace('_', ' ')}
                  </Text>
                </View>
              </View>

              {/* Progress Bar */}
              <View style={styles.progressSection}>
                <View style={styles.progressHeader}>
                  <Text style={styles.progressLabel}>Progress</Text>
                  <Text style={styles.progressPercentage}>{course.progress}%</Text>
                </View>
                <View style={styles.progressBarContainer}>
                  <View
                    style={[
                      styles.progressBarFill,
                      {
                        width: `${course.progress}%`,
                        backgroundColor: getStatusColor(course.status),
                      },
                    ]}
                  />
                </View>
              </View>

              {/* Dates */}
              <View style={styles.datesContainer}>
                {course.startDate && (
                  <Text style={styles.dateText}>
                    Started: {formatDate(course.startDate)}
                  </Text>
                )}
                {course.deadline && (
                  <Text
                    style={[
                      styles.dateText,
                      isOverdue(course.deadline) && { color: colors.semantic.error },
                      isDueSoon(course.deadline) && { color: colors.semantic.warning },
                    ]}
                  >
                    {isOverdue(course.deadline) ? 'Overdue: ' : 'Deadline: '}
                    {formatDate(course.deadline)}
                  </Text>
                )}
                {course.completionDate && (
                  <Text style={[styles.dateText, { color: colors.semantic.success }]}>
                    Completed: {formatDate(course.completionDate)}
                  </Text>
                )}
              </View>

              {/* Materials Summary */}
              {course.materials && course.materials.length > 0 && (
                <View style={styles.materialsContainer}>
                  <Text style={styles.materialsTitle}>Course Materials:</Text>
                  <View style={styles.materialsSummary}>
                    <Text style={styles.materialsText}>
                      {course.materials.filter((m) => m.completed).length}/
                      {course.materials.length} completed
                    </Text>
                  </View>
                </View>
              )}

              {/* Grade */}
              {course.grade && (
                <Text style={styles.gradeText}>Grade: {course.grade}</Text>
              )}

              {/* Certificate */}
              {course.certificateUrl && (
                <View style={styles.certificateContainer}>
                  <Text style={styles.certificateText}>Certificate Available</Text>
                </View>
              )}
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing[4],
    backgroundColor: colors.light.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
  },
  title: {
    ...textStyles.h3,
    color: colors.text.light.primary,
  },
  addButton: {
    backgroundColor: colors.primary.blue,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: borderRadius.md,
  },
  addButtonText: {
    ...textStyles.label,
    color: colors.text.light.inverse,
  },
  statusFilter: {
    backgroundColor: colors.light.primary,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
  },
  statusChip: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    marginRight: spacing[2],
    borderRadius: borderRadius.full,
    backgroundColor: colors.gray[100],
    borderWidth: 1,
    borderColor: colors.gray[300],
  },
  statusChipActive: {
    backgroundColor: colors.primary.blue,
    borderColor: colors.primary.blue,
  },
  statusChipText: {
    ...textStyles.label,
    color: colors.text.light.secondary,
  },
  statusChipTextActive: {
    color: colors.text.light.inverse,
  },
  statsContainer: {
    flexDirection: 'row',
    padding: spacing[4],
    gap: spacing[3],
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.light.primary,
    padding: spacing[3],
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
  coursesList: {
    flex: 1,
    padding: spacing[4],
  },
  emptyContainer: {
    alignItems: 'center',
    padding: spacing[8],
  },
  emptyText: {
    ...textStyles.h4,
    color: colors.text.light.secondary,
    marginBottom: spacing[2],
  },
  emptySubtext: {
    ...textStyles.body,
    color: colors.text.light.tertiary,
    textAlign: 'center',
  },
  courseCard: {
    backgroundColor: colors.light.primary,
    padding: spacing[4],
    borderRadius: borderRadius.lg,
    marginBottom: spacing[3],
    ...shadows.sm,
  },
  courseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing[3],
  },
  courseInfo: {
    flex: 1,
    marginRight: spacing[2],
  },
  courseTitle: {
    ...textStyles.h4,
    color: colors.text.light.primary,
    marginBottom: spacing[1],
  },
  platformText: {
    ...textStyles.bodySmall,
    color: colors.primary.blue,
    marginBottom: spacing[1],
  },
  instructorText: {
    ...textStyles.caption,
    color: colors.text.light.tertiary,
  },
  statusBadge: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.md,
  },
  statusText: {
    ...textStyles.label,
    color: colors.text.light.inverse,
    textTransform: 'capitalize',
  },
  progressSection: {
    marginBottom: spacing[3],
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing[2],
  },
  progressLabel: {
    ...textStyles.label,
    color: colors.text.light.secondary,
  },
  progressPercentage: {
    ...textStyles.label,
    color: colors.primary.blue,
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: colors.gray[200],
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: borderRadius.full,
  },
  datesContainer: {
    marginBottom: spacing[2],
  },
  dateText: {
    ...textStyles.caption,
    color: colors.text.light.tertiary,
    marginBottom: spacing[1],
  },
  materialsContainer: {
    marginTop: spacing[2],
    paddingTop: spacing[2],
    borderTopWidth: 1,
    borderTopColor: colors.light.border,
  },
  materialsTitle: {
    ...textStyles.label,
    color: colors.text.light.secondary,
    marginBottom: spacing[1],
  },
  materialsSummary: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  materialsText: {
    ...textStyles.bodySmall,
    color: colors.text.light.primary,
  },
  gradeText: {
    ...textStyles.body,
    color: colors.semantic.success,
    fontWeight: '600',
    marginTop: spacing[2],
  },
  certificateContainer: {
    marginTop: spacing[2],
    padding: spacing[2],
    backgroundColor: colors.charts.green,
    borderRadius: borderRadius.md,
  },
  certificateText: {
    ...textStyles.label,
    color: colors.text.light.inverse,
    textAlign: 'center',
  },
});

export default CoursesScreen;
