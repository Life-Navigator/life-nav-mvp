/**
 * Life Navigator - Career Analytics Screen
 *
 * Advanced career analytics with 9 comprehensive visualization types:
 * - Skills Growth, Network Growth, Application Success Rate, Salary Progression
 * - Interview Performance, Skills Gap Analysis, Career Trajectory
 * - Market Value Estimate, Learning ROI
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
import { LineChart, BarChart, ProgressChart, ContributionGraph } from 'react-native-chart-kit';
import { colors } from '../../utils/colors';
import { spacing } from '../../utils/spacing';

const screenWidth = Dimensions.get('window').width;

// Mock data - replace with real API calls
const generateCareerData = () => ({
  skills: {
    technical: [
      { name: 'JavaScript', level: 0.85 },
      { name: 'React', level: 0.90 },
      { name: 'Python', level: 0.75 },
      { name: 'SQL', level: 0.70 },
      { name: 'Cloud (AWS)', level: 0.65 },
      { name: 'Docker', level: 0.60 },
    ],
    growth: {
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
      data: [65, 68, 72, 75, 77, 80],
    },
  },
  network: {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    connections: [120, 135, 152, 168, 185, 204],
    engagements: [45, 52, 48, 60, 55, 68],
  },
  applications: {
    funnel: [
      { stage: 'Applied', count: 50, percentage: 1.0 },
      { stage: 'Screened', count: 30, percentage: 0.6 },
      { stage: 'Interviewed', count: 15, percentage: 0.3 },
      { stage: 'Offers', count: 5, percentage: 0.1 },
    ],
    successRate: 0.10,
  },
  salary: {
    labels: ['2020', '2021', '2022', '2023', '2024', '2025'],
    data: [65000, 72000, 85000, 95000, 110000, 125000],
  },
  interviews: {
    labels: ['Google', 'Amazon', 'Microsoft', 'Meta', 'Apple'],
    rounds: [4, 5, 3, 6, 4],
    success: [0.25, 0.20, 0.33, 0.17, 0.25],
  },
  skillsGap: [
    { skill: 'Machine Learning', current: 0.45, market: 0.85, gap: 0.40 },
    { skill: 'Kubernetes', current: 0.50, market: 0.80, gap: 0.30 },
    { skill: 'GraphQL', current: 0.60, market: 0.85, gap: 0.25 },
    { skill: 'TypeScript', current: 0.75, market: 0.90, gap: 0.15 },
    { skill: 'System Design', current: 0.65, market: 0.95, gap: 0.30 },
  ],
  trajectory: {
    labels: ['Current', '2 yrs', '4 yrs', '6 yrs', '8 yrs'],
    actual: [125000, 140000, 160000, 185000, 215000],
    target: [125000, 145000, 170000, 200000, 240000],
  },
  marketValue: {
    estimated: 128000,
    min: 115000,
    max: 145000,
    percentile: 72,
  },
  learningROI: {
    courses: [
      { name: 'AWS Certification', cost: 300, value: 15000, roi: 49 },
      { name: 'React Advanced', cost: 200, value: 8000, roi: 39 },
      { name: 'System Design', cost: 150, value: 12000, roi: 79 },
      { name: 'Leadership', cost: 500, value: 20000, roi: 39 },
    ],
    totalInvested: 1150,
    totalReturn: 55000,
  },
});

export function CareerAnalyticsScreen() {
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [timeRange, setTimeRange] = useState<'quarter' | 'year' | 'all'>('year');
  const data = generateCareerData();

  const chartConfig = {
    backgroundGradientFrom: '#ffffff',
    backgroundGradientTo: '#ffffff',
    color: (opacity = 1) => `rgba(139, 92, 246, ${opacity})`,
    strokeWidth: 2,
    barPercentage: 0.5,
    useShadowColorFromDataset: false,
    decimalPlaces: 0,
    propsForLabels: {
      fontSize: 10,
    },
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const exportData = `
Career Analytics Report
Generated: ${new Date().toLocaleDateString()}

SKILLS OVERVIEW
Overall Proficiency: ${data.skills.growth.data[data.skills.growth.data.length - 1]}%
${data.skills.technical.map(skill => `- ${skill.name}: ${Math.round(skill.level * 100)}%`).join('\n')}

NETWORK GROWTH
Total Connections: ${data.network.connections[data.network.connections.length - 1]}
Monthly Engagements: ${data.network.engagements[data.network.engagements.length - 1]}

APPLICATION SUCCESS RATE: ${Math.round(data.applications.successRate * 100)}%
Applied: ${data.applications.funnel[0].count}
Offers Received: ${data.applications.funnel[data.applications.funnel.length - 1].count}

CURRENT SALARY: ${formatCurrency(data.salary.data[data.salary.data.length - 1])}

MARKET VALUE ESTIMATE: ${formatCurrency(data.marketValue.estimated)}
Range: ${formatCurrency(data.marketValue.min)} - ${formatCurrency(data.marketValue.max)}
Percentile: ${data.marketValue.percentile}th

SKILLS GAP ANALYSIS
${data.skillsGap.map(gap => `- ${gap.skill}: ${Math.round(gap.gap * 100)}% gap`).join('\n')}

LEARNING ROI
Total Invested: ${formatCurrency(data.learningROI.totalInvested)}
Total Return: ${formatCurrency(data.learningROI.totalReturn)}
Overall ROI: ${Math.round((data.learningROI.totalReturn / data.learningROI.totalInvested - 1) * 100)}x
      `.trim();

      await Share.share({
        message: exportData,
        title: 'Career Analytics Report',
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
        <ActivityIndicator size="large" color={colors.domains.career} />
        <Text style={styles.loadingText}>Loading analytics...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Career Analytics</Text>
        <View style={styles.timeRangeSelector}>
          {(['quarter', 'year', 'all'] as const).map((range) => (
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

      {/* 1. Skills Growth - Radar Chart Alternative */}
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>Skills Proficiency Levels</Text>
        <Text style={styles.chartSubtitle}>Current Skill Set</Text>
        {data.skills.technical.map((skill, index) => (
          <View key={index} style={styles.skillItem}>
            <View style={styles.skillHeader}>
              <Text style={styles.skillName}>{skill.name}</Text>
              <Text style={styles.skillLevel}>{Math.round(skill.level * 100)}%</Text>
            </View>
            <View style={styles.skillBar}>
              <View
                style={[
                  styles.skillBarFill,
                  {
                    width: `${skill.level * 100}%`,
                    backgroundColor:
                      skill.level >= 0.8
                        ? colors.semantic.success
                        : skill.level >= 0.6
                        ? colors.domains.career
                        : colors.semantic.warning,
                  },
                ]}
              />
            </View>
          </View>
        ))}
        <Text style={styles.chartSubtitle}>Overall Growth Trend</Text>
        <LineChart
          data={{
            labels: data.skills.growth.labels,
            datasets: [
              {
                data: data.skills.growth.data,
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
        <View style={styles.insightBox}>
          <Text style={styles.insightText}>
            Overall Proficiency: {data.skills.growth.data[data.skills.growth.data.length - 1]}%
          </Text>
          <Text style={styles.insightText}>
            Growth (6 months): +{data.skills.growth.data[data.skills.growth.data.length - 1] - data.skills.growth.data[0]}%
          </Text>
        </View>
      </View>

      {/* 2. Network Growth */}
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>Network Growth</Text>
        <Text style={styles.chartSubtitle}>Connections Over Time</Text>
        <LineChart
          data={{
            labels: data.network.labels,
            datasets: [
              {
                data: data.network.connections,
                color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
                strokeWidth: 2,
              },
              {
                data: data.network.engagements,
                color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`,
                strokeWidth: 2,
              },
            ],
            legend: ['Connections', 'Engagements'],
          }}
          width={screenWidth - 40}
          height={220}
          chartConfig={chartConfig}
          bezier
          style={styles.chart}
        />
        <View style={styles.networkStats}>
          <View style={styles.networkItem}>
            <Text style={styles.networkValue}>{data.network.connections[data.network.connections.length - 1]}</Text>
            <Text style={styles.networkLabel}>Total Connections</Text>
          </View>
          <View style={styles.networkItem}>
            <Text style={styles.networkValue}>
              +{data.network.connections[data.network.connections.length - 1] - data.network.connections[0]}
            </Text>
            <Text style={styles.networkLabel}>6-Month Growth</Text>
          </View>
          <View style={styles.networkItem}>
            <Text style={styles.networkValue}>{data.network.engagements[data.network.engagements.length - 1]}</Text>
            <Text style={styles.networkLabel}>Monthly Engagements</Text>
          </View>
        </View>
      </View>

      {/* 3. Application Success Rate - Conversion Funnel */}
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>Application Success Rate</Text>
        <Text style={styles.chartSubtitle}>Conversion Funnel</Text>
        <View style={styles.funnelContainer}>
          {data.applications.funnel.map((stage, index) => (
            <View key={index} style={styles.funnelStage}>
              <View
                style={[
                  styles.funnelBar,
                  {
                    width: `${stage.percentage * 100}%`,
                    backgroundColor:
                      index === 0
                        ? colors.primary.blue
                        : index === 1
                        ? colors.domains.career
                        : index === 2
                        ? colors.semantic.warning
                        : colors.semantic.success,
                  },
                ]}
              >
                <Text style={styles.funnelLabel}>{stage.stage}</Text>
              </View>
              <View style={styles.funnelStats}>
                <Text style={styles.funnelCount}>{stage.count}</Text>
                <Text style={styles.funnelPercentage}>{Math.round(stage.percentage * 100)}%</Text>
              </View>
            </View>
          ))}
        </View>
        <View style={styles.successRateBox}>
          <Text style={styles.successRateLabel}>Overall Success Rate</Text>
          <Text style={styles.successRateValue}>{Math.round(data.applications.successRate * 100)}%</Text>
          <Text style={styles.successRateNote}>
            {data.applications.funnel[data.applications.funnel.length - 1].count} offers from{' '}
            {data.applications.funnel[0].count} applications
          </Text>
        </View>
      </View>

      {/* 4. Salary Progression */}
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>Salary Progression</Text>
        <Text style={styles.chartSubtitle}>6-Year Growth Trajectory</Text>
        <LineChart
          data={{
            labels: data.salary.labels,
            datasets: [
              {
                data: data.salary.data,
                color: (opacity = 1) => `rgba(16, 185, 129, ${opacity})`,
                strokeWidth: 3,
              },
            ],
          }}
          width={screenWidth - 40}
          height={220}
          chartConfig={chartConfig}
          bezier
          style={styles.chart}
        />
        <View style={styles.salaryStats}>
          <View style={styles.salaryItem}>
            <Text style={styles.salaryLabel}>Starting</Text>
            <Text style={styles.salaryValue}>{formatCurrency(data.salary.data[0])}</Text>
          </View>
          <View style={styles.salaryItem}>
            <Text style={styles.salaryLabel}>Current</Text>
            <Text style={styles.salaryValue}>{formatCurrency(data.salary.data[data.salary.data.length - 1])}</Text>
          </View>
          <View style={styles.salaryItem}>
            <Text style={styles.salaryLabel}>Total Growth</Text>
            <Text style={[styles.salaryValue, styles.growthText]}>
              +{Math.round(((data.salary.data[data.salary.data.length - 1] - data.salary.data[0]) / data.salary.data[0]) * 100)}%
            </Text>
          </View>
        </View>
      </View>

      {/* 5. Interview Performance */}
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>Interview Performance</Text>
        <Text style={styles.chartSubtitle}>By Company</Text>
        <BarChart
          data={{
            labels: data.interviews.labels,
            datasets: [{ data: data.interviews.rounds }],
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
        <View style={styles.interviewList}>
          {data.interviews.labels.map((company, index) => (
            <View key={index} style={styles.interviewItem}>
              <Text style={styles.interviewCompany}>{company}</Text>
              <View style={styles.interviewDetails}>
                <Text style={styles.interviewRounds}>{data.interviews.rounds[index]} rounds</Text>
                <Text
                  style={[
                    styles.interviewSuccess,
                    {
                      color:
                        data.interviews.success[index] >= 0.3
                          ? colors.semantic.success
                          : data.interviews.success[index] >= 0.2
                          ? colors.semantic.warning
                          : colors.semantic.error,
                    },
                  ]}
                >
                  {Math.round(data.interviews.success[index] * 100)}% success
                </Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* 6. Skills Gap Analysis */}
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>Skills Gap Analysis</Text>
        <Text style={styles.chartSubtitle}>Current vs Market Demand</Text>
        {data.skillsGap.map((gap, index) => (
          <View key={index} style={styles.gapItem}>
            <Text style={styles.gapSkill}>{gap.skill}</Text>
            <View style={styles.gapBars}>
              <View style={styles.gapBarContainer}>
                <Text style={styles.gapBarLabel}>Current</Text>
                <View style={styles.gapBar}>
                  <View
                    style={[
                      styles.gapBarFill,
                      { width: `${gap.current * 100}%`, backgroundColor: colors.primary.blue },
                    ]}
                  />
                </View>
                <Text style={styles.gapBarValue}>{Math.round(gap.current * 100)}%</Text>
              </View>
              <View style={styles.gapBarContainer}>
                <Text style={styles.gapBarLabel}>Market</Text>
                <View style={styles.gapBar}>
                  <View
                    style={[
                      styles.gapBarFill,
                      { width: `${gap.market * 100}%`, backgroundColor: colors.semantic.success },
                    ]}
                  />
                </View>
                <Text style={styles.gapBarValue}>{Math.round(gap.market * 100)}%</Text>
              </View>
            </View>
            <View
              style={[
                styles.gapBadge,
                {
                  backgroundColor:
                    gap.gap <= 0.2
                      ? colors.semantic.success
                      : gap.gap <= 0.3
                      ? colors.semantic.warning
                      : colors.semantic.error,
                },
              ]}
            >
              <Text style={styles.gapBadgeText}>{Math.round(gap.gap * 100)}% gap</Text>
            </View>
          </View>
        ))}
      </View>

      {/* 7. Career Trajectory */}
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>Career Trajectory</Text>
        <Text style={styles.chartSubtitle}>8-Year Projection</Text>
        <LineChart
          data={{
            labels: data.trajectory.labels,
            datasets: [
              {
                data: data.trajectory.actual,
                color: (opacity = 1) => `rgba(139, 92, 246, ${opacity})`,
                strokeWidth: 2,
              },
              {
                data: data.trajectory.target,
                color: (opacity = 1) => `rgba(209, 213, 219, ${opacity})`,
                strokeWidth: 2,
                withDots: false,
              },
            ],
            legend: ['Projected', 'Target'],
          }}
          width={screenWidth - 40}
          height={220}
          chartConfig={chartConfig}
          bezier
          style={styles.chart}
        />
        <View style={styles.trajectoryStats}>
          <View style={styles.trajectoryItem}>
            <Text style={styles.trajectoryLabel}>8-Year Target</Text>
            <Text style={styles.trajectoryValue}>
              {formatCurrency(data.trajectory.target[data.trajectory.target.length - 1])}
            </Text>
          </View>
          <View style={styles.trajectoryItem}>
            <Text style={styles.trajectoryLabel}>Projected</Text>
            <Text style={styles.trajectoryValue}>
              {formatCurrency(data.trajectory.actual[data.trajectory.actual.length - 1])}
            </Text>
          </View>
          <View style={styles.trajectoryItem}>
            <Text style={styles.trajectoryLabel}>On Track</Text>
            <Text style={[styles.trajectoryValue, { color: colors.semantic.warning }]}>90%</Text>
          </View>
        </View>
      </View>

      {/* 8. Market Value Estimate */}
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>Market Value Estimate</Text>
        <Text style={styles.chartSubtitle}>AI-Powered Assessment</Text>
        <View style={styles.marketValueContainer}>
          <View style={styles.marketValueMain}>
            <Text style={styles.marketValueLabel}>Estimated Market Value</Text>
            <Text style={styles.marketValueEstimate}>{formatCurrency(data.marketValue.estimated)}</Text>
            <Text style={styles.marketValueRange}>
              Range: {formatCurrency(data.marketValue.min)} - {formatCurrency(data.marketValue.max)}
            </Text>
          </View>
          <View style={styles.percentileContainer}>
            <Text style={styles.percentileLabel}>Market Percentile</Text>
            <View style={styles.percentileCircle}>
              <Text style={styles.percentileValue}>{data.marketValue.percentile}th</Text>
            </View>
            <Text style={styles.percentileNote}>
              You earn more than {data.marketValue.percentile}% of professionals in your field
            </Text>
          </View>
        </View>
        <View style={styles.marketValueBar}>
          <View style={styles.marketValueBarTrack}>
            <View
              style={[
                styles.marketValueBarFill,
                {
                  width: `${((data.marketValue.estimated - data.marketValue.min) / (data.marketValue.max - data.marketValue.min)) * 100}%`,
                },
              ]}
            />
            <View
              style={[
                styles.marketValueIndicator,
                {
                  left: `${((data.marketValue.estimated - data.marketValue.min) / (data.marketValue.max - data.marketValue.min)) * 100}%`,
                },
              ]}
            />
          </View>
          <View style={styles.marketValueLabels}>
            <Text style={styles.marketValueMin}>{formatCurrency(data.marketValue.min)}</Text>
            <Text style={styles.marketValueMax}>{formatCurrency(data.marketValue.max)}</Text>
          </View>
        </View>
      </View>

      {/* 9. Learning ROI */}
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>Learning ROI</Text>
        <Text style={styles.chartSubtitle}>Investment vs Outcomes</Text>
        <View style={styles.roiSummary}>
          <View style={styles.roiItem}>
            <Text style={styles.roiLabel}>Total Invested</Text>
            <Text style={styles.roiValue}>{formatCurrency(data.learningROI.totalInvested)}</Text>
          </View>
          <View style={styles.roiItem}>
            <Text style={styles.roiLabel}>Total Return</Text>
            <Text style={[styles.roiValue, styles.returnText]}>{formatCurrency(data.learningROI.totalReturn)}</Text>
          </View>
          <View style={styles.roiItem}>
            <Text style={styles.roiLabel}>Overall ROI</Text>
            <Text style={[styles.roiValue, styles.returnText]}>
              {Math.round((data.learningROI.totalReturn / data.learningROI.totalInvested - 1) * 100)}x
            </Text>
          </View>
        </View>
        <View style={styles.coursesList}>
          {data.learningROI.courses.map((course, index) => (
            <View key={index} style={styles.courseItem}>
              <View style={styles.courseHeader}>
                <Text style={styles.courseName}>{course.name}</Text>
                <Text style={[styles.courseROI, styles.returnText]}>{course.roi}x ROI</Text>
              </View>
              <View style={styles.courseDetails}>
                <Text style={styles.courseDetail}>Cost: {formatCurrency(course.cost)}</Text>
                <Text style={styles.courseSeparator}>→</Text>
                <Text style={styles.courseDetail}>Value: {formatCurrency(course.value)}</Text>
              </View>
              <View style={styles.courseBar}>
                <View
                  style={[
                    styles.courseBarFill,
                    {
                      width: `${Math.min((course.roi / 80) * 100, 100)}%`,
                      backgroundColor:
                        course.roi >= 50
                          ? colors.semantic.success
                          : course.roi >= 30
                          ? colors.domains.career
                          : colors.semantic.warning,
                    },
                  ]}
                />
              </View>
            </View>
          ))}
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
    backgroundColor: colors.domains.career,
    borderColor: colors.domains.career,
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
    backgroundColor: colors.domains.career,
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
  skillItem: {
    marginBottom: spacing[3],
  },
  skillHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing[2],
  },
  skillName: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text.light.primary,
  },
  skillLevel: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.domains.career,
  },
  skillBar: {
    height: 12,
    backgroundColor: colors.light.tertiary,
    borderRadius: 6,
    overflow: 'hidden',
  },
  skillBarFill: {
    height: '100%',
    borderRadius: 6,
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
  networkStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: spacing[3],
    gap: spacing[2],
  },
  networkItem: {
    flex: 1,
    alignItems: 'center',
    padding: spacing[2],
    backgroundColor: colors.light.tertiary,
    borderRadius: 8,
  },
  networkValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.domains.career,
    marginBottom: spacing[1],
  },
  networkLabel: {
    fontSize: 12,
    color: colors.text.light.secondary,
    textAlign: 'center',
  },
  funnelContainer: {
    gap: spacing[3],
    marginVertical: spacing[3],
  },
  funnelStage: {
    gap: spacing[2],
  },
  funnelBar: {
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[3],
    borderRadius: 8,
    alignItems: 'center',
  },
  funnelLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  funnelStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[2],
  },
  funnelCount: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.light.primary,
  },
  funnelPercentage: {
    fontSize: 14,
    color: colors.text.light.secondary,
  },
  successRateBox: {
    marginTop: spacing[3],
    padding: spacing[3],
    backgroundColor: colors.light.tertiary,
    borderRadius: 8,
    alignItems: 'center',
  },
  successRateLabel: {
    fontSize: 14,
    color: colors.text.light.secondary,
    marginBottom: spacing[2],
  },
  successRateValue: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.semantic.success,
    marginBottom: spacing[2],
  },
  successRateNote: {
    fontSize: 12,
    color: colors.text.light.secondary,
    textAlign: 'center',
  },
  salaryStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: spacing[3],
    gap: spacing[2],
  },
  salaryItem: {
    flex: 1,
    alignItems: 'center',
    padding: spacing[2],
    backgroundColor: colors.light.tertiary,
    borderRadius: 8,
  },
  salaryLabel: {
    fontSize: 12,
    color: colors.text.light.secondary,
    marginBottom: spacing[1],
  },
  salaryValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text.light.primary,
  },
  growthText: {
    color: colors.semantic.success,
  },
  interviewList: {
    marginTop: spacing[3],
    gap: spacing[2],
  },
  interviewItem: {
    padding: spacing[3],
    backgroundColor: colors.light.tertiary,
    borderRadius: 8,
  },
  interviewCompany: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.light.primary,
    marginBottom: spacing[2],
  },
  interviewDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  interviewRounds: {
    fontSize: 14,
    color: colors.text.light.secondary,
  },
  interviewSuccess: {
    fontSize: 14,
    fontWeight: '600',
  },
  gapItem: {
    marginBottom: spacing[4],
    padding: spacing[3],
    backgroundColor: colors.light.tertiary,
    borderRadius: 8,
  },
  gapSkill: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.light.primary,
    marginBottom: spacing[3],
  },
  gapBars: {
    gap: spacing[2],
    marginBottom: spacing[2],
  },
  gapBarContainer: {
    gap: spacing[1],
  },
  gapBarLabel: {
    fontSize: 12,
    color: colors.text.light.secondary,
  },
  gapBar: {
    height: 8,
    backgroundColor: colors.light.primary,
    borderRadius: 4,
    overflow: 'hidden',
  },
  gapBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  gapBarValue: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.light.primary,
  },
  gapBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: 16,
  },
  gapBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  trajectoryStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: spacing[3],
    gap: spacing[2],
  },
  trajectoryItem: {
    flex: 1,
    alignItems: 'center',
    padding: spacing[2],
    backgroundColor: colors.light.tertiary,
    borderRadius: 8,
  },
  trajectoryLabel: {
    fontSize: 12,
    color: colors.text.light.secondary,
    marginBottom: spacing[1],
    textAlign: 'center',
  },
  trajectoryValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text.light.primary,
  },
  marketValueContainer: {
    gap: spacing[4],
    marginVertical: spacing[3],
  },
  marketValueMain: {
    alignItems: 'center',
    padding: spacing[4],
    backgroundColor: colors.light.tertiary,
    borderRadius: 8,
  },
  marketValueLabel: {
    fontSize: 14,
    color: colors.text.light.secondary,
    marginBottom: spacing[2],
  },
  marketValueEstimate: {
    fontSize: 36,
    fontWeight: '700',
    color: colors.domains.career,
    marginBottom: spacing[2],
  },
  marketValueRange: {
    fontSize: 14,
    color: colors.text.light.secondary,
  },
  percentileContainer: {
    alignItems: 'center',
    padding: spacing[3],
  },
  percentileLabel: {
    fontSize: 14,
    color: colors.text.light.secondary,
    marginBottom: spacing[2],
  },
  percentileCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.semantic.success,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing[2],
  },
  percentileValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  percentileNote: {
    fontSize: 12,
    color: colors.text.light.secondary,
    textAlign: 'center',
  },
  marketValueBar: {
    marginTop: spacing[3],
  },
  marketValueBarTrack: {
    height: 8,
    backgroundColor: colors.light.tertiary,
    borderRadius: 4,
    position: 'relative',
  },
  marketValueBarFill: {
    height: '100%',
    backgroundColor: colors.domains.career,
    borderRadius: 4,
  },
  marketValueIndicator: {
    position: 'absolute',
    top: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.domains.career,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  marketValueLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing[2],
  },
  marketValueMin: {
    fontSize: 12,
    color: colors.text.light.secondary,
  },
  marketValueMax: {
    fontSize: 12,
    color: colors.text.light.secondary,
  },
  roiSummary: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: spacing[4],
    gap: spacing[2],
  },
  roiItem: {
    flex: 1,
    alignItems: 'center',
    padding: spacing[2],
    backgroundColor: colors.light.tertiary,
    borderRadius: 8,
  },
  roiLabel: {
    fontSize: 12,
    color: colors.text.light.secondary,
    marginBottom: spacing[1],
    textAlign: 'center',
  },
  roiValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.light.primary,
  },
  returnText: {
    color: colors.semantic.success,
  },
  coursesList: {
    gap: spacing[3],
  },
  courseItem: {
    padding: spacing[3],
    backgroundColor: colors.light.tertiary,
    borderRadius: 8,
  },
  courseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing[2],
  },
  courseName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.light.primary,
  },
  courseROI: {
    fontSize: 16,
    fontWeight: '700',
  },
  courseDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginBottom: spacing[2],
  },
  courseDetail: {
    fontSize: 14,
    color: colors.text.light.secondary,
  },
  courseSeparator: {
    fontSize: 14,
    color: colors.text.light.secondary,
  },
  courseBar: {
    height: 8,
    backgroundColor: colors.light.primary,
    borderRadius: 4,
    overflow: 'hidden',
  },
  courseBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  bottomPadding: {
    height: spacing[4],
  },
});
