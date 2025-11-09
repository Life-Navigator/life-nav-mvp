/**
 * Life Navigator - Education Analytics Screen
 *
 * Advanced education analytics with 9 comprehensive visualization types:
 * - Learning Hours, Course Completion Rate, Study Streak, Progress by Subject
 * - Time per Course, Grade Trends, Certifications Timeline
 * - Learning Velocity, Knowledge Retention
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Dimensions,
  Share,
  Alert,
} from 'react-native';
import { LineChart, BarChart, PieChart, ProgressChart, ContributionGraph } from 'react-native-chart-kit';
import { colors } from '../../utils/colors';
import { spacing } from '../../utils/spacing';

const screenWidth = Dimensions.get('window').width;

// Mock data - replace with real API calls
const generateEducationData = () => ({
  learningHours: {
    weekly: {
      labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
      data: [12, 15, 18, 14],
    },
    monthly: {
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
      data: [48, 52, 60, 56, 65, 58],
    },
  },
  completionRate: {
    completed: 24,
    inProgress: 8,
    notStarted: 4,
    total: 36,
    percentage: 0.67,
  },
  studyStreak: {
    current: 42,
    longest: 68,
    data: [
      { date: '2025-01-01', count: 2 },
      { date: '2025-01-08', count: 3 },
      { date: '2025-01-15', count: 1 },
      { date: '2025-01-22', count: 4 },
      { date: '2025-02-01', count: 2 },
      { date: '2025-02-08', count: 3 },
      { date: '2025-02-15', count: 5 },
      { date: '2025-02-22', count: 2 },
      { date: '2025-03-01', count: 4 },
      { date: '2025-03-08', count: 3 },
    ],
  },
  progressBySubject: [
    { subject: 'Computer Science', progress: 0.85, hours: 120, target: 150 },
    { subject: 'Mathematics', progress: 0.72, hours: 86, target: 120 },
    { subject: 'Data Science', progress: 0.68, hours: 68, target: 100 },
    { subject: 'Business', progress: 0.90, hours: 54, target: 60 },
    { subject: 'Design', progress: 0.55, hours: 33, target: 60 },
  ],
  timePerCourse: [
    { name: 'Advanced Algorithms', hours: 45, percentage: 0.30, color: '#3B82F6' },
    { name: 'Machine Learning', hours: 38, percentage: 0.25, color: '#8B5CF6' },
    { name: 'System Design', hours: 28, percentage: 0.19, color: '#10B981' },
    { name: 'Leadership', hours: 22, percentage: 0.15, color: '#F59E0B' },
    { name: 'Others', hours: 17, percentage: 0.11, color: '#6B7280' },
  ],
  gradeTrends: {
    labels: ['Course 1', 'Course 2', 'Course 3', 'Course 4', 'Course 5', 'Course 6'],
    grades: [88, 92, 85, 95, 90, 94],
    average: 90.67,
  },
  certifications: [
    { name: 'AWS Solutions Architect', date: '2024-03-15', status: 'completed', score: 920 },
    { name: 'Google Cloud Professional', date: '2024-06-22', status: 'completed', score: 885 },
    { name: 'Azure Developer', date: '2024-09-10', status: 'completed', score: 850 },
    { name: 'Kubernetes Admin', date: '2024-12-05', status: 'completed', score: 910 },
    { name: 'Data Science Professional', date: '2025-03-01', status: 'in_progress', score: null },
    { name: 'ML Engineering', date: '2025-06-01', status: 'planned', score: null },
  ],
  learningVelocity: {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    completedCourses: [2, 3, 2, 4, 3, 5],
    hoursPerCourse: [24, 22, 28, 20, 23, 19],
  },
  knowledgeRetention: {
    subjects: [
      { name: 'Algorithms', initial: 0.85, current: 0.78, retention: 0.92 },
      { name: 'ML Basics', initial: 0.90, current: 0.88, retention: 0.98 },
      { name: 'Cloud Computing', initial: 0.82, current: 0.72, retention: 0.88 },
      { name: 'System Design', initial: 0.88, current: 0.82, retention: 0.93 },
      { name: 'Data Structures', initial: 0.92, current: 0.90, retention: 0.98 },
    ],
    averageRetention: 0.94,
  },
});

export function EducationAnalyticsScreen() {
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'year'>('month');
  const data = generateEducationData();

  const chartConfig = {
    backgroundGradientFrom: '#ffffff',
    backgroundGradientTo: '#ffffff',
    color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
    strokeWidth: 2,
    barPercentage: 0.5,
    useShadowColorFromDataset: false,
    decimalPlaces: 0,
    propsForLabels: {
      fontSize: 10,
    },
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const totalHours = data.learningHours.monthly.data.reduce((a, b) => a + b, 0);
      const avgHoursPerMonth = totalHours / data.learningHours.monthly.data.length;

      const exportData = `
Education Analytics Report
Generated: ${new Date().toLocaleDateString()}

LEARNING HOURS
- Total (6 months): ${totalHours} hours
- Average per month: ${avgHoursPerMonth.toFixed(1)} hours
- Average per week: ${(avgHoursPerMonth / 4).toFixed(1)} hours

COURSE COMPLETION
- Completed: ${data.completionRate.completed}
- In Progress: ${data.completionRate.inProgress}
- Not Started: ${data.completionRate.notStarted}
- Completion Rate: ${Math.round(data.completionRate.percentage * 100)}%

STUDY STREAK
- Current: ${data.studyStreak.current} days
- Longest: ${data.studyStreak.longest} days

PROGRESS BY SUBJECT
${data.progressBySubject.map(s => `- ${s.subject}: ${Math.round(s.progress * 100)}% (${s.hours}/${s.target} hours)`).join('\n')}

GRADE TRENDS
- Average Grade: ${data.gradeTrends.average.toFixed(1)}%
- Latest Grade: ${data.gradeTrends.grades[data.gradeTrends.grades.length - 1]}%

CERTIFICATIONS
${data.certifications.filter(c => c.status === 'completed').map(c => `- ${c.name} (Score: ${c.score})`).join('\n')}

KNOWLEDGE RETENTION: ${Math.round(data.knowledgeRetention.averageRetention * 100)}%
      `.trim();

      await Share.share({
        message: exportData,
        title: 'Education Analytics Report',
      });
    } catch (error) {
      Alert.alert('Export Error', 'Failed to export analytics data');
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary.blue} />
        <Text style={styles.loadingText}>Loading analytics...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Education Analytics</Text>
        <View style={styles.timeRangeSelector}>
          {(['week', 'month', 'year'] as const).map((range) => (
            <TouchableOpacity
              key={range}
              style={[styles.timeButton, timeRange === range && styles.timeButtonActive]}
              onPress={() => setTimeRange(range)}
            >
              <Text style={[styles.timeButtonText, timeRange === range && styles.timeButtonTextActive]}>
                {range.charAt(0).toUpperCase() + range.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity
          style={styles.exportButton}
          onPress={handleExport}
          disabled={isExporting}
        >
          <Text style={styles.exportButtonText}>
            {isExporting ? 'Exporting...' : 'Export Report'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* 1. Learning Hours */}
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>Learning Hours</Text>
        <Text style={styles.chartSubtitle}>Monthly Breakdown</Text>
        <BarChart
          data={{
            labels: data.learningHours.monthly.labels,
            datasets: [{ data: data.learningHours.monthly.data }],
          }}
          width={screenWidth - 40}
          height={220}
          chartConfig={{
            ...chartConfig,
            color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
          }}
          style={styles.chart}
          showValuesOnTopOfBars
        />
        <View style={styles.hoursStats}>
          <View style={styles.hoursStat}>
            <Text style={styles.hoursStatValue}>
              {data.learningHours.monthly.data.reduce((a, b) => a + b, 0)}
            </Text>
            <Text style={styles.hoursStatLabel}>Total Hours</Text>
          </View>
          <View style={styles.hoursStat}>
            <Text style={styles.hoursStatValue}>
              {(data.learningHours.monthly.data.reduce((a, b) => a + b, 0) / data.learningHours.monthly.data.length).toFixed(1)}
            </Text>
            <Text style={styles.hoursStatLabel}>Avg/Month</Text>
          </View>
          <View style={styles.hoursStat}>
            <Text style={styles.hoursStatValue}>
              {data.learningHours.monthly.data[data.learningHours.monthly.data.length - 1]}
            </Text>
            <Text style={styles.hoursStatLabel}>This Month</Text>
          </View>
        </View>
        <Text style={styles.chartSubtitle}>Weekly Breakdown</Text>
        <BarChart
          data={{
            labels: data.learningHours.weekly.labels,
            datasets: [{ data: data.learningHours.weekly.data }],
          }}
          width={screenWidth - 40}
          height={200}
          chartConfig={{
            ...chartConfig,
            color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`,
          }}
          style={styles.chart}
          showValuesOnTopOfBars
        />
      </View>

      {/* 2. Course Completion Rate */}
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>Course Completion Rate</Text>
        <View style={styles.completionContainer}>
          <View style={styles.completionCircle}>
            <Text style={styles.completionPercentage}>
              {Math.round(data.completionRate.percentage * 100)}%
            </Text>
            <Text style={styles.completionLabel}>Completed</Text>
          </View>
          <View style={styles.completionStats}>
            <View style={styles.completionStat}>
              <Text style={styles.completionStatLabel}>Completed</Text>
              <Text style={[styles.completionStatValue, { color: colors.semantic.success }]}>
                {data.completionRate.completed}
              </Text>
            </View>
            <View style={styles.completionStat}>
              <Text style={styles.completionStatLabel}>In Progress</Text>
              <Text style={[styles.completionStatValue, { color: colors.semantic.warning }]}>
                {data.completionRate.inProgress}
              </Text>
            </View>
            <View style={styles.completionStat}>
              <Text style={styles.completionStatLabel}>Not Started</Text>
              <Text style={[styles.completionStatValue, { color: colors.text.light.secondary }]}>
                {data.completionRate.notStarted}
              </Text>
            </View>
          </View>
        </View>
        <PieChart
          data={[
            {
              name: 'Completed',
              population: data.completionRate.completed,
              color: colors.semantic.success,
              legendFontColor: colors.text.light.primary,
              legendFontSize: 12,
            },
            {
              name: 'In Progress',
              population: data.completionRate.inProgress,
              color: colors.semantic.warning,
              legendFontColor: colors.text.light.primary,
              legendFontSize: 12,
            },
            {
              name: 'Not Started',
              population: data.completionRate.notStarted,
              color: colors.gray[400],
              legendFontColor: colors.text.light.primary,
              legendFontSize: 12,
            },
          ]}
          width={screenWidth - 40}
          height={200}
          chartConfig={chartConfig}
          accessor="population"
          backgroundColor="transparent"
          paddingLeft="15"
          style={styles.chart}
        />
      </View>

      {/* 3. Study Streak - Calendar Heatmap */}
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>Study Streak</Text>
        <View style={styles.streakStats}>
          <View style={styles.streakStat}>
            <Text style={styles.streakStatValue}>{data.studyStreak.current}</Text>
            <Text style={styles.streakStatLabel}>Current Streak</Text>
          </View>
          <View style={styles.streakStat}>
            <Text style={[styles.streakStatValue, { color: colors.semantic.success }]}>
              {data.studyStreak.longest}
            </Text>
            <Text style={styles.streakStatLabel}>Longest Streak</Text>
          </View>
        </View>
        <Text style={styles.chartSubtitle}>Study Activity Heatmap</Text>
        <ContributionGraph
          values={data.studyStreak.data}
          endDate={new Date('2025-03-15')}
          numDays={70}
          width={screenWidth - 40}
          height={220}
          chartConfig={{
            ...chartConfig,
            color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
          }}
        />
        <View style={styles.streakNote}>
          <Text style={styles.streakNoteText}>
            Keep your streak alive! Consistency is key to effective learning.
          </Text>
        </View>
      </View>

      {/* 4. Progress by Subject */}
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>Progress by Subject</Text>
        {data.progressBySubject.map((subject, index) => (
          <View key={index} style={styles.subjectItem}>
            <View style={styles.subjectHeader}>
              <Text style={styles.subjectName}>{subject.subject}</Text>
              <Text style={styles.subjectPercentage}>{Math.round(subject.progress * 100)}%</Text>
            </View>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressBarFill,
                  {
                    width: `${subject.progress * 100}%`,
                    backgroundColor:
                      subject.progress >= 0.8
                        ? colors.semantic.success
                        : subject.progress >= 0.6
                        ? colors.primary.blue
                        : colors.semantic.warning,
                  },
                ]}
              />
            </View>
            <Text style={styles.subjectHours}>
              {subject.hours} / {subject.target} hours
            </Text>
          </View>
        ))}
      </View>

      {/* 5. Time per Course */}
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>Time per Course</Text>
        <Text style={styles.chartSubtitle}>Distribution of Learning Hours</Text>
        <PieChart
          data={data.timePerCourse.map(course => ({
            name: course.name,
            population: course.hours,
            color: course.color,
            legendFontColor: colors.text.light.primary,
            legendFontSize: 12,
          }))}
          width={screenWidth - 40}
          height={220}
          chartConfig={chartConfig}
          accessor="population"
          backgroundColor="transparent"
          paddingLeft="15"
          style={styles.chart}
        />
        <View style={styles.courseList}>
          {data.timePerCourse.map((course, index) => (
            <View key={index} style={styles.courseListItem}>
              <View style={styles.courseListHeader}>
                <View style={[styles.courseDot, { backgroundColor: course.color }]} />
                <Text style={styles.courseName}>{course.name}</Text>
              </View>
              <View style={styles.courseListDetails}>
                <Text style={styles.courseHours}>{course.hours}h</Text>
                <Text style={styles.coursePercentage}>{Math.round(course.percentage * 100)}%</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* 6. Grade Trends */}
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>Grade Trends</Text>
        <Text style={styles.chartSubtitle}>Performance Over Time</Text>
        <LineChart
          data={{
            labels: data.gradeTrends.labels,
            datasets: [
              {
                data: data.gradeTrends.grades,
                color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`,
                strokeWidth: 2,
              },
            ],
          }}
          width={screenWidth - 40}
          height={220}
          chartConfig={chartConfig}
          bezier
          style={styles.chart}
          fromZero
        />
        <View style={styles.gradeStats}>
          <View style={styles.gradeStat}>
            <Text style={styles.gradeStatLabel}>Average</Text>
            <Text style={styles.gradeStatValue}>{data.gradeTrends.average.toFixed(1)}%</Text>
          </View>
          <View style={styles.gradeStat}>
            <Text style={styles.gradeStatLabel}>Highest</Text>
            <Text style={[styles.gradeStatValue, { color: colors.semantic.success }]}>
              {Math.max(...data.gradeTrends.grades)}%
            </Text>
          </View>
          <View style={styles.gradeStat}>
            <Text style={styles.gradeStatLabel}>Latest</Text>
            <Text style={styles.gradeStatValue}>
              {data.gradeTrends.grades[data.gradeTrends.grades.length - 1]}%
            </Text>
          </View>
        </View>
      </View>

      {/* 7. Certifications Timeline */}
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>Certifications Timeline</Text>
        <Text style={styles.chartSubtitle}>Milestone Progress</Text>
        <View style={styles.timeline}>
          {data.certifications.map((cert, index) => (
            <View key={index} style={styles.timelineItem}>
              <View
                style={[
                  styles.timelineDot,
                  {
                    backgroundColor:
                      cert.status === 'completed'
                        ? colors.semantic.success
                        : cert.status === 'in_progress'
                        ? colors.semantic.warning
                        : colors.gray[400],
                  },
                ]}
              />
              <View style={styles.timelineContent}>
                <Text style={styles.timelineTitle}>{cert.name}</Text>
                <Text style={styles.timelineDate}>
                  {new Date(cert.date).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </Text>
                <View
                  style={[
                    styles.timelineBadge,
                    {
                      backgroundColor:
                        cert.status === 'completed'
                          ? colors.semantic.success
                          : cert.status === 'in_progress'
                          ? colors.semantic.warning
                          : colors.gray[400],
                    },
                  ]}
                >
                  <Text style={styles.timelineBadgeText}>
                    {cert.status === 'completed'
                      ? `Score: ${cert.score}`
                      : cert.status === 'in_progress'
                      ? 'In Progress'
                      : 'Planned'}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* 8. Learning Velocity */}
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>Learning Velocity</Text>
        <Text style={styles.chartSubtitle}>Courses Completed per Month</Text>
        <BarChart
          data={{
            labels: data.learningVelocity.labels,
            datasets: [{ data: data.learningVelocity.completedCourses }],
          }}
          width={screenWidth - 40}
          height={220}
          chartConfig={{
            ...chartConfig,
            color: (opacity = 1) => `rgba(139, 92, 246, ${opacity})`,
          }}
          style={styles.chart}
          showValuesOnTopOfBars
        />
        <Text style={styles.chartSubtitle}>Average Hours per Course</Text>
        <LineChart
          data={{
            labels: data.learningVelocity.labels,
            datasets: [
              {
                data: data.learningVelocity.hoursPerCourse,
                color: (opacity = 1) => `rgba(245, 158, 11, ${opacity})`,
                strokeWidth: 2,
              },
            ],
          }}
          width={screenWidth - 40}
          height={200}
          chartConfig={chartConfig}
          bezier
          style={styles.chart}
        />
        <View style={styles.velocityStats}>
          <View style={styles.velocityStat}>
            <Text style={styles.velocityStatValue}>
              {data.learningVelocity.completedCourses.reduce((a, b) => a + b, 0)}
            </Text>
            <Text style={styles.velocityStatLabel}>Total Courses</Text>
          </View>
          <View style={styles.velocityStat}>
            <Text style={styles.velocityStatValue}>
              {(
                data.learningVelocity.completedCourses.reduce((a, b) => a + b, 0) /
                data.learningVelocity.completedCourses.length
              ).toFixed(1)}
            </Text>
            <Text style={styles.velocityStatLabel}>Avg/Month</Text>
          </View>
          <View style={styles.velocityStat}>
            <Text style={styles.velocityStatValue}>
              {(
                data.learningVelocity.hoursPerCourse.reduce((a, b) => a + b, 0) /
                data.learningVelocity.hoursPerCourse.length
              ).toFixed(1)}
            </Text>
            <Text style={styles.velocityStatLabel}>Avg Hours/Course</Text>
          </View>
        </View>
      </View>

      {/* 9. Knowledge Retention */}
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>Knowledge Retention</Text>
        <Text style={styles.chartSubtitle}>Spaced Repetition Analysis</Text>
        <View style={styles.retentionOverview}>
          <View style={styles.retentionCircle}>
            <Text style={styles.retentionPercentage}>
              {Math.round(data.knowledgeRetention.averageRetention * 100)}%
            </Text>
            <Text style={styles.retentionLabel}>Avg Retention</Text>
          </View>
        </View>
        {data.knowledgeRetention.subjects.map((subject, index) => (
          <View key={index} style={styles.retentionItem}>
            <Text style={styles.retentionSubject}>{subject.name}</Text>
            <View style={styles.retentionBars}>
              <View style={styles.retentionBarRow}>
                <Text style={styles.retentionBarLabel}>Initial</Text>
                <View style={styles.retentionBar}>
                  <View
                    style={[
                      styles.retentionBarFill,
                      { width: `${subject.initial * 100}%`, backgroundColor: colors.gray[400] },
                    ]}
                  />
                </View>
                <Text style={styles.retentionBarValue}>{Math.round(subject.initial * 100)}%</Text>
              </View>
              <View style={styles.retentionBarRow}>
                <Text style={styles.retentionBarLabel}>Current</Text>
                <View style={styles.retentionBar}>
                  <View
                    style={[
                      styles.retentionBarFill,
                      { width: `${subject.current * 100}%`, backgroundColor: colors.primary.blue },
                    ]}
                  />
                </View>
                <Text style={styles.retentionBarValue}>{Math.round(subject.current * 100)}%</Text>
              </View>
            </View>
            <View
              style={[
                styles.retentionBadge,
                {
                  backgroundColor:
                    subject.retention >= 0.95
                      ? colors.semantic.success
                      : subject.retention >= 0.90
                      ? colors.primary.blue
                      : colors.semantic.warning,
                },
              ]}
            >
              <Text style={styles.retentionBadgeText}>
                {Math.round(subject.retention * 100)}% retained
              </Text>
            </View>
          </View>
        ))}
        <View style={styles.retentionNote}>
          <Text style={styles.retentionNoteText}>
            Knowledge retention is measured through spaced repetition exercises and periodic assessments.
            Review subjects with lower retention rates to maintain mastery.
          </Text>
        </View>
      </View>

      <View style={styles.bottomPadding} />
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
  loadingText: {
    marginTop: spacing[3],
    fontSize: 16,
    color: colors.text.light.secondary,
  },
  header: {
    backgroundColor: colors.light.primary,
    padding: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text.light.primary,
    marginBottom: spacing[3],
  },
  timeRangeSelector: {
    flexDirection: 'row',
    gap: spacing[2],
    marginBottom: spacing[3],
  },
  timeButton: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: 8,
    backgroundColor: colors.light.tertiary,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  timeButtonActive: {
    backgroundColor: colors.primary.blue,
    borderColor: colors.primary.blue,
  },
  timeButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text.light.secondary,
  },
  timeButtonTextActive: {
    color: '#FFFFFF',
  },
  exportButton: {
    backgroundColor: colors.primary.blue,
    paddingVertical: spacing[3],
    borderRadius: 8,
    alignItems: 'center',
  },
  exportButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  chartCard: {
    backgroundColor: colors.light.primary,
    margin: spacing[3],
    padding: spacing[4],
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  chartTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.light.primary,
    marginBottom: spacing[2],
  },
  chartSubtitle: {
    fontSize: 14,
    color: colors.text.light.secondary,
    marginBottom: spacing[3],
    marginTop: spacing[3],
  },
  chart: {
    marginVertical: spacing[2],
    borderRadius: 8,
  },
  hoursStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: spacing[3],
    gap: spacing[2],
  },
  hoursStat: {
    flex: 1,
    alignItems: 'center',
    padding: spacing[2],
    backgroundColor: colors.light.tertiary,
    borderRadius: 8,
  },
  hoursStatValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.primary.blue,
    marginBottom: spacing[1],
  },
  hoursStatLabel: {
    fontSize: 12,
    color: colors.text.light.secondary,
    textAlign: 'center',
  },
  completionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing[4],
    gap: spacing[4],
  },
  completionCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.semantic.success,
    justifyContent: 'center',
    alignItems: 'center',
  },
  completionPercentage: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  completionLabel: {
    fontSize: 12,
    color: '#FFFFFF',
    marginTop: spacing[1],
  },
  completionStats: {
    flex: 1,
    gap: spacing[2],
  },
  completionStat: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  completionStatLabel: {
    fontSize: 14,
    color: colors.text.light.secondary,
  },
  completionStatValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  streakStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: spacing[3],
    gap: spacing[2],
  },
  streakStat: {
    flex: 1,
    alignItems: 'center',
    padding: spacing[3],
    backgroundColor: colors.light.tertiary,
    borderRadius: 8,
  },
  streakStatValue: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.primary.blue,
    marginBottom: spacing[1],
  },
  streakStatLabel: {
    fontSize: 12,
    color: colors.text.light.secondary,
    textAlign: 'center',
  },
  streakNote: {
    marginTop: spacing[3],
    padding: spacing[3],
    backgroundColor: colors.light.tertiary,
    borderRadius: 8,
  },
  streakNoteText: {
    fontSize: 12,
    color: colors.text.light.secondary,
    lineHeight: 18,
  },
  subjectItem: {
    marginBottom: spacing[4],
  },
  subjectHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing[2],
  },
  subjectName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.light.primary,
  },
  subjectPercentage: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary.blue,
  },
  progressBar: {
    height: 12,
    backgroundColor: colors.light.tertiary,
    borderRadius: 6,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 6,
  },
  subjectHours: {
    fontSize: 12,
    color: colors.text.light.secondary,
    marginTop: spacing[1],
  },
  courseList: {
    marginTop: spacing[3],
    gap: spacing[2],
  },
  courseListItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing[2],
    backgroundColor: colors.light.tertiary,
    borderRadius: 8,
  },
  courseListHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  courseDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  courseName: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text.light.primary,
  },
  courseListDetails: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  courseHours: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.light.primary,
  },
  coursePercentage: {
    fontSize: 14,
    color: colors.text.light.secondary,
  },
  gradeStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: spacing[3],
    gap: spacing[2],
  },
  gradeStat: {
    flex: 1,
    alignItems: 'center',
    padding: spacing[2],
    backgroundColor: colors.light.tertiary,
    borderRadius: 8,
  },
  gradeStatLabel: {
    fontSize: 12,
    color: colors.text.light.secondary,
    marginBottom: spacing[1],
  },
  gradeStatValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.light.primary,
  },
  timeline: {
    marginTop: spacing[3],
  },
  timelineItem: {
    flexDirection: 'row',
    gap: spacing[3],
    marginBottom: spacing[4],
  },
  timelineDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginTop: spacing[1],
  },
  timelineContent: {
    flex: 1,
    gap: spacing[1],
  },
  timelineTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.light.primary,
  },
  timelineDate: {
    fontSize: 12,
    color: colors.text.light.secondary,
  },
  timelineBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: 12,
    marginTop: spacing[1],
  },
  timelineBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  velocityStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: spacing[3],
    gap: spacing[2],
  },
  velocityStat: {
    flex: 1,
    alignItems: 'center',
    padding: spacing[2],
    backgroundColor: colors.light.tertiary,
    borderRadius: 8,
  },
  velocityStatValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.primary.blue,
    marginBottom: spacing[1],
  },
  velocityStatLabel: {
    fontSize: 11,
    color: colors.text.light.secondary,
    textAlign: 'center',
  },
  retentionOverview: {
    alignItems: 'center',
    marginVertical: spacing[3],
  },
  retentionCircle: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: colors.semantic.success,
    justifyContent: 'center',
    alignItems: 'center',
  },
  retentionPercentage: {
    fontSize: 48,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  retentionLabel: {
    fontSize: 14,
    color: '#FFFFFF',
    marginTop: spacing[1],
  },
  retentionItem: {
    marginBottom: spacing[4],
    padding: spacing[3],
    backgroundColor: colors.light.tertiary,
    borderRadius: 8,
  },
  retentionSubject: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.light.primary,
    marginBottom: spacing[3],
  },
  retentionBars: {
    gap: spacing[2],
    marginBottom: spacing[2],
  },
  retentionBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  retentionBarLabel: {
    width: 50,
    fontSize: 12,
    color: colors.text.light.secondary,
  },
  retentionBar: {
    flex: 1,
    height: 8,
    backgroundColor: colors.light.primary,
    borderRadius: 4,
    overflow: 'hidden',
  },
  retentionBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  retentionBarValue: {
    width: 40,
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.light.primary,
    textAlign: 'right',
  },
  retentionBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: 16,
  },
  retentionBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  retentionNote: {
    marginTop: spacing[3],
    padding: spacing[3],
    backgroundColor: colors.light.tertiary,
    borderRadius: 8,
  },
  retentionNoteText: {
    fontSize: 12,
    color: colors.text.light.secondary,
    lineHeight: 18,
  },
  bottomPadding: {
    height: spacing[4],
  },
});
