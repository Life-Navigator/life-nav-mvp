/**
 * Life Navigator - Health Analytics Screen
 *
 * Advanced health analytics with 10 comprehensive visualization types:
 * - Vital Signs Trends, Wellness Score, Activity Patterns, Sleep Analysis
 * - Medication Adherence, Appointment Frequency, Health Goals, Risk Assessment
 * - Health Predictions, Metric Correlations
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
import { LineChart, BarChart, PieChart, ProgressChart } from 'react-native-chart-kit';
import { colors } from '../../utils/colors';
import { spacing } from '../../utils/spacing';

const screenWidth = Dimensions.get('window').width;

// Mock data - replace with real API calls
const generateHealthData = () => ({
  vitalSigns: {
    bloodPressure: [
      { date: 'Jan', systolic: 125, diastolic: 82 },
      { date: 'Feb', systolic: 122, diastolic: 80 },
      { date: 'Mar', systolic: 120, diastolic: 79 },
      { date: 'Apr', systolic: 118, diastolic: 78 },
      { date: 'May', systolic: 120, diastolic: 80 },
      { date: 'Jun', systolic: 119, diastolic: 79 },
    ],
    heartRate: [72, 70, 68, 71, 69, 70],
    weight: [180, 179, 178, 176, 175, 174],
  },
  wellnessScore: {
    physical: 0.85,
    mental: 0.78,
    nutrition: 0.82,
    sleep: 0.75,
  },
  activityPatterns: {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    data: [45, 60, 30, 75, 50, 90, 120],
  },
  sleepAnalysis: {
    labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
    data: [7.2, 7.5, 6.8, 7.8],
    quality: [0.75, 0.82, 0.70, 0.88],
  },
  medicationAdherence: 0.92,
  appointments: {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    data: [2, 1, 3, 2, 1, 2],
  },
  healthGoals: [
    { name: 'Weight Loss', progress: 0.75, target: '20 lbs', current: '15 lbs' },
    { name: 'Exercise', progress: 0.88, target: '150 min/week', current: '132 min' },
    { name: 'Sleep', progress: 0.65, target: '8 hrs/night', current: '7.2 hrs' },
    { name: 'Water Intake', progress: 0.95, target: '8 glasses', current: '7.6 glasses' },
  ],
  riskAssessment: {
    cardiovascular: 'low',
    diabetes: 'low',
    mental: 'moderate',
    overall: 'low',
  },
  predictions: {
    labels: ['Current', '30 days', '60 days', '90 days'],
    weight: [174, 172, 170, 168],
    wellness: [0.80, 0.82, 0.85, 0.87],
  },
  correlations: [
    { metric1: 'Exercise', metric2: 'Sleep Quality', correlation: 0.78, strength: 'Strong' },
    { metric1: 'Stress', metric2: 'Heart Rate', correlation: -0.65, strength: 'Moderate' },
    { metric1: 'Diet', metric2: 'Energy', correlation: 0.72, strength: 'Strong' },
  ],
});

export function HealthAnalyticsScreen() {
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'year'>('month');
  const data = generateHealthData();

  const chartConfig = {
    backgroundGradientFrom: '#ffffff',
    backgroundGradientTo: '#ffffff',
    color: (opacity = 1) => `rgba(37, 99, 235, ${opacity})`,
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
      const exportData = `
Health Analytics Report
Generated: ${new Date().toLocaleDateString()}

VITAL SIGNS
- Latest Blood Pressure: 119/79 mmHg
- Heart Rate: 70 bpm
- Weight: 174 lbs

WELLNESS SCORE
- Physical: 85%
- Mental: 78%
- Nutrition: 82%
- Sleep: 75%

MEDICATION ADHERENCE: 92%

HEALTH GOALS PROGRESS
${data.healthGoals.map(goal => `- ${goal.name}: ${Math.round(goal.progress * 100)}% (${goal.current}/${goal.target})`).join('\n')}

RISK ASSESSMENT
- Cardiovascular: ${data.riskAssessment.cardiovascular}
- Diabetes: ${data.riskAssessment.diabetes}
- Mental Health: ${data.riskAssessment.mental}
- Overall: ${data.riskAssessment.overall}
      `.trim();

      await Share.share({
        message: exportData,
        title: 'Health Analytics Report',
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
        <Text style={styles.title}>Health Analytics</Text>
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

      {/* 1. Vital Signs Trends */}
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>Vital Signs Trends</Text>
        <Text style={styles.chartSubtitle}>Blood Pressure (mmHg)</Text>
        <LineChart
          data={{
            labels: data.vitalSigns.bloodPressure.map(d => d.date),
            datasets: [
              {
                data: data.vitalSigns.bloodPressure.map(d => d.systolic),
                color: (opacity = 1) => `rgba(239, 68, 68, ${opacity})`,
                strokeWidth: 2,
              },
              {
                data: data.vitalSigns.bloodPressure.map(d => d.diastolic),
                color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
                strokeWidth: 2,
              },
            ],
            legend: ['Systolic', 'Diastolic'],
          }}
          width={screenWidth - 40}
          height={220}
          chartConfig={chartConfig}
          bezier
          style={styles.chart}
        />
        <View style={styles.metricRow}>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Heart Rate</Text>
            <Text style={styles.metricValue}>70 bpm</Text>
          </View>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Weight</Text>
            <Text style={styles.metricValue}>174 lbs</Text>
          </View>
        </View>
      </View>

      {/* 2. Wellness Score Breakdown */}
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>Wellness Score Breakdown</Text>
        <ProgressChart
          data={{
            labels: ['Physical', 'Mental', 'Nutrition', 'Sleep'],
            data: [
              data.wellnessScore.physical,
              data.wellnessScore.mental,
              data.wellnessScore.nutrition,
              data.wellnessScore.sleep,
            ],
          }}
          width={screenWidth - 40}
          height={220}
          chartConfig={{
            ...chartConfig,
            color: (opacity = 1, index = 0) => {
              const colors = ['rgba(239, 68, 68, ', 'rgba(139, 92, 246, ', 'rgba(16, 185, 129, ', 'rgba(59, 130, 246, '];
              return `${colors[index]}${opacity})`;
            },
          }}
          hideLegend={false}
          style={styles.chart}
        />
        <View style={styles.scoreGrid}>
          {Object.entries(data.wellnessScore).map(([key, value]) => (
            <View key={key} style={styles.scoreItem}>
              <Text style={styles.scoreLabel}>{key.charAt(0).toUpperCase() + key.slice(1)}</Text>
              <Text style={styles.scoreValue}>{Math.round(value * 100)}%</Text>
            </View>
          ))}
        </View>
      </View>

      {/* 3. Activity Patterns */}
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>Weekly Activity Patterns</Text>
        <Text style={styles.chartSubtitle}>Minutes of Exercise</Text>
        <BarChart
          data={{
            labels: data.activityPatterns.labels,
            datasets: [{ data: data.activityPatterns.data }],
          }}
          width={screenWidth - 40}
          height={220}
          chartConfig={{
            ...chartConfig,
            color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`,
          }}
          style={styles.chart}
          showValuesOnTopOfBars
        />
        <View style={styles.insightBox}>
          <Text style={styles.insightText}>
            Weekly Average: {Math.round(data.activityPatterns.data.reduce((a, b) => a + b) / 7)} minutes
          </Text>
          <Text style={styles.insightText}>
            Goal: 150 minutes/week | Progress: 88%
          </Text>
        </View>
      </View>

      {/* 4. Sleep Analysis */}
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>Sleep Analysis</Text>
        <Text style={styles.chartSubtitle}>Hours per Night</Text>
        <LineChart
          data={{
            labels: data.sleepAnalysis.labels,
            datasets: [
              {
                data: data.sleepAnalysis.data,
                color: (opacity = 1) => `rgba(139, 92, 246, ${opacity})`,
                strokeWidth: 2,
              },
            ],
          }}
          width={screenWidth - 40}
          height={220}
          chartConfig={chartConfig}
          bezier
          style={styles.chart}
        />
        <View style={styles.qualityRow}>
          {data.sleepAnalysis.quality.map((quality, index) => (
            <View key={index} style={styles.qualityItem}>
              <Text style={styles.qualityLabel}>{data.sleepAnalysis.labels[index]}</Text>
              <View style={styles.qualityBar}>
                <View
                  style={[
                    styles.qualityBarFill,
                    { width: `${quality * 100}%`, backgroundColor: quality > 0.8 ? colors.semantic.success : quality > 0.7 ? colors.semantic.warning : colors.semantic.error },
                  ]}
                />
              </View>
              <Text style={styles.qualityValue}>{Math.round(quality * 100)}%</Text>
            </View>
          ))}
        </View>
      </View>

      {/* 5. Medication Adherence */}
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>Medication Adherence</Text>
        <View style={styles.adherenceContainer}>
          <View style={styles.adherenceCircle}>
            <Text style={styles.adherencePercentage}>
              {Math.round(data.medicationAdherence * 100)}%
            </Text>
            <Text style={styles.adherenceLabel}>Compliance</Text>
          </View>
          <View style={styles.adherenceStats}>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Doses Taken:</Text>
              <Text style={styles.statValue}>138/150</Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Streak:</Text>
              <Text style={styles.statValue}>12 days</Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Missed:</Text>
              <Text style={[styles.statValue, styles.statMissed]}>12 doses</Text>
            </View>
          </View>
        </View>
        <ProgressChart
          data={{
            labels: ['Adherence'],
            data: [data.medicationAdherence],
          }}
          width={screenWidth - 40}
          height={180}
          chartConfig={{
            ...chartConfig,
            color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`,
          }}
          hideLegend
          style={styles.chart}
        />
      </View>

      {/* 6. Appointment Frequency */}
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>Appointment Frequency</Text>
        <Text style={styles.chartSubtitle}>Visits per Month</Text>
        <BarChart
          data={{
            labels: data.appointments.labels,
            datasets: [{ data: data.appointments.data }],
          }}
          width={screenWidth - 40}
          height={220}
          chartConfig={{
            ...chartConfig,
            color: (opacity = 1) => `rgba(239, 68, 68, ${opacity})`,
          }}
          style={styles.chart}
          showValuesOnTopOfBars
        />
        <View style={styles.insightBox}>
          <Text style={styles.insightText}>
            Total Appointments: {data.appointments.data.reduce((a, b) => a + b, 0)}
          </Text>
          <Text style={styles.insightText}>
            Next Scheduled: Cardiology - Dec 15, 2025
          </Text>
        </View>
      </View>

      {/* 7. Health Goals Progress */}
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>Health Goals Progress</Text>
        {data.healthGoals.map((goal, index) => (
          <View key={index} style={styles.goalItem}>
            <View style={styles.goalHeader}>
              <Text style={styles.goalName}>{goal.name}</Text>
              <Text style={styles.goalPercentage}>{Math.round(goal.progress * 100)}%</Text>
            </View>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressBarFill,
                  {
                    width: `${goal.progress * 100}%`,
                    backgroundColor: goal.progress >= 0.8 ? colors.semantic.success : goal.progress >= 0.5 ? colors.semantic.warning : colors.semantic.error,
                  },
                ]}
              />
            </View>
            <Text style={styles.goalProgress}>
              {goal.current} / {goal.target}
            </Text>
          </View>
        ))}
      </View>

      {/* 8. Risk Assessment */}
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>Health Risk Assessment</Text>
        <View style={styles.riskGrid}>
          {Object.entries(data.riskAssessment).map(([key, value]) => (
            <View key={key} style={styles.riskItem}>
              <Text style={styles.riskLabel}>{key.charAt(0).toUpperCase() + key.slice(1)}</Text>
              <View
                style={[
                  styles.riskBadge,
                  {
                    backgroundColor:
                      value === 'low'
                        ? colors.semantic.success
                        : value === 'moderate'
                        ? colors.semantic.warning
                        : colors.semantic.error,
                  },
                ]}
              >
                <Text style={styles.riskBadgeText}>{value.toUpperCase()}</Text>
              </View>
            </View>
          ))}
        </View>
        <View style={styles.riskNote}>
          <Text style={styles.riskNoteText}>
            Based on your health metrics, lifestyle, and family history. Consult your healthcare provider for personalized advice.
          </Text>
        </View>
      </View>

      {/* 9. 90-Day Health Predictions */}
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>90-Day Health Trend Forecast</Text>
        <Text style={styles.chartSubtitle}>Predicted Weight Trajectory</Text>
        <LineChart
          data={{
            labels: data.predictions.labels,
            datasets: [
              {
                data: data.predictions.weight,
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
          withDots
          withInnerLines
          withOuterLines
        />
        <View style={styles.predictionBox}>
          <Text style={styles.predictionText}>
            Predicted 90-day wellness score: {Math.round(data.predictions.wellness[3] * 100)}%
          </Text>
          <Text style={styles.predictionNote}>
            Predictions based on current trends and AI modeling
          </Text>
        </View>
      </View>

      {/* 10. Metric Correlations */}
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>Health Metric Correlations</Text>
        <Text style={styles.chartSubtitle}>Relationships Between Key Metrics</Text>
        {data.correlations.map((corr, index) => (
          <View key={index} style={styles.correlationItem}>
            <View style={styles.correlationHeader}>
              <Text style={styles.correlationMetrics}>
                {corr.metric1} ↔ {corr.metric2}
              </Text>
              <Text
                style={[
                  styles.correlationStrength,
                  {
                    color:
                      corr.strength === 'Strong'
                        ? colors.semantic.success
                        : corr.strength === 'Moderate'
                        ? colors.semantic.warning
                        : colors.semantic.error,
                  },
                ]}
              >
                {corr.strength}
              </Text>
            </View>
            <View style={styles.correlationBar}>
              <View
                style={[
                  styles.correlationBarFill,
                  {
                    width: `${Math.abs(corr.correlation) * 100}%`,
                    backgroundColor: corr.correlation > 0 ? colors.semantic.success : colors.semantic.error,
                  },
                ]}
              />
            </View>
            <Text style={styles.correlationValue}>
              Correlation: {corr.correlation > 0 ? '+' : ''}{corr.correlation.toFixed(2)}
            </Text>
          </View>
        ))}
        <View style={styles.correlationNote}>
          <Text style={styles.correlationNoteText}>
            Positive correlations indicate metrics that increase together. Negative correlations indicate inverse relationships.
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
  },
  chart: {
    marginVertical: spacing[2],
    borderRadius: 8,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: spacing[3],
  },
  metricItem: {
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 12,
    color: colors.text.light.secondary,
    marginBottom: spacing[1],
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.primary.blue,
  },
  scoreGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[3],
    marginTop: spacing[3],
  },
  scoreItem: {
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
    padding: spacing[2],
    backgroundColor: colors.light.tertiary,
    borderRadius: 8,
  },
  scoreLabel: {
    fontSize: 12,
    color: colors.text.light.secondary,
    marginBottom: spacing[1],
  },
  scoreValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary.blue,
  },
  insightBox: {
    marginTop: spacing[3],
    padding: spacing[3],
    backgroundColor: colors.light.tertiary,
    borderRadius: 8,
  },
  insightText: {
    fontSize: 14,
    color: colors.text.light.primary,
    marginBottom: spacing[1],
  },
  qualityRow: {
    marginTop: spacing[3],
    gap: spacing[2],
  },
  qualityItem: {
    marginBottom: spacing[2],
  },
  qualityLabel: {
    fontSize: 12,
    color: colors.text.light.secondary,
    marginBottom: spacing[1],
  },
  qualityBar: {
    height: 8,
    backgroundColor: colors.light.tertiary,
    borderRadius: 4,
    overflow: 'hidden',
  },
  qualityBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  qualityValue: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.light.primary,
    marginTop: spacing[1],
  },
  adherenceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[4],
    gap: spacing[4],
  },
  adherenceCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.semantic.success,
    justifyContent: 'center',
    alignItems: 'center',
  },
  adherencePercentage: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  adherenceLabel: {
    fontSize: 12,
    color: '#FFFFFF',
    marginTop: spacing[1],
  },
  adherenceStats: {
    flex: 1,
    gap: spacing[2],
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statLabel: {
    fontSize: 14,
    color: colors.text.light.secondary,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.light.primary,
  },
  statMissed: {
    color: colors.semantic.error,
  },
  goalItem: {
    marginBottom: spacing[4],
  },
  goalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing[2],
  },
  goalName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.light.primary,
  },
  goalPercentage: {
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
  goalProgress: {
    fontSize: 12,
    color: colors.text.light.secondary,
    marginTop: spacing[1],
  },
  riskGrid: {
    gap: spacing[3],
    marginTop: spacing[2],
  },
  riskItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing[3],
    backgroundColor: colors.light.tertiary,
    borderRadius: 8,
  },
  riskLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text.light.primary,
  },
  riskBadge: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: 16,
  },
  riskBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  riskNote: {
    marginTop: spacing[3],
    padding: spacing[3],
    backgroundColor: colors.light.tertiary,
    borderRadius: 8,
  },
  riskNoteText: {
    fontSize: 12,
    color: colors.text.light.secondary,
    lineHeight: 18,
  },
  predictionBox: {
    marginTop: spacing[3],
    padding: spacing[3],
    backgroundColor: colors.light.tertiary,
    borderRadius: 8,
  },
  predictionText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.light.primary,
    marginBottom: spacing[2],
  },
  predictionNote: {
    fontSize: 12,
    color: colors.text.light.secondary,
    fontStyle: 'italic',
  },
  correlationItem: {
    marginBottom: spacing[4],
    padding: spacing[3],
    backgroundColor: colors.light.tertiary,
    borderRadius: 8,
  },
  correlationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing[2],
  },
  correlationMetrics: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.light.primary,
  },
  correlationStrength: {
    fontSize: 14,
    fontWeight: '700',
  },
  correlationBar: {
    height: 8,
    backgroundColor: colors.light.primary,
    borderRadius: 4,
    overflow: 'hidden',
  },
  correlationBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  correlationValue: {
    fontSize: 12,
    color: colors.text.light.secondary,
    marginTop: spacing[1],
  },
  correlationNote: {
    marginTop: spacing[3],
    padding: spacing[3],
    backgroundColor: colors.light.tertiary,
    borderRadius: 8,
  },
  correlationNoteText: {
    fontSize: 12,
    color: colors.text.light.secondary,
    lineHeight: 18,
  },
  bottomPadding: {
    height: spacing[4],
  },
});
