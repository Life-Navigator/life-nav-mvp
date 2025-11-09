/**
 * Life Navigator - Wellness Tracking Screen
 *
 * Daily wellness tracking with metrics and trends
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Modal,
  Alert,
  RefreshControl,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import { colors } from '../../utils/colors';
import { spacing, borderRadius, shadows } from '../../utils/spacing';
import { textStyles, typography } from '../../utils/typography';

interface WellnessMetric {
  id: string;
  type: 'weight' | 'blood-pressure' | 'heart-rate' | 'sleep' | 'steps' | 'mood' | 'water' | 'exercise';
  value: string | number;
  unit: string;
  date: string;
  notes?: string;
}

interface MetricSummary {
  type: WellnessMetric['type'];
  current?: number | string;
  average?: number;
  trend?: 'up' | 'down' | 'stable';
  goal?: number;
}

interface LogFormData {
  type: WellnessMetric['type'];
  value: string;
  notes: string;
}

export function WellnessScreen() {
  const queryClient = useQueryClient();
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'year'>('week');
  const [logModalVisible, setLogModalVisible] = useState(false);
  const [selectedMetricType, setSelectedMetricType] = useState<WellnessMetric['type'] | null>(null);
  const [formData, setFormData] = useState<LogFormData>({
    type: 'weight',
    value: '',
    notes: '',
  });

  // Fetch wellness metrics
  const {
    data: metrics,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['wellness-metrics', timeRange],
    queryFn: async () => {
      const response = await api.get<WellnessMetric[]>('/api/v1/health/metrics', {
        params: { range: timeRange },
      });
      return response;
    },
  });

  // Fetch metric summaries
  const { data: summaries } = useQuery({
    queryKey: ['wellness-summaries'],
    queryFn: async () => {
      const response = await api.get<MetricSummary[]>('/api/v1/health/metrics/summary');
      return response;
    },
  });

  // Log metric mutation
  const logMutation = useMutation({
    mutationFn: async (data: { type: string; value: string; notes?: string }) => {
      return await api.post('/api/v1/health/metrics', {
        ...data,
        date: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wellness-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['wellness-summaries'] });
      setLogModalVisible(false);
      resetForm();
      Alert.alert('Success', 'Metric logged successfully');
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Failed to log metric');
    },
  });

  const metricTypes = [
    { type: 'weight', label: 'Weight', icon: '⚖️', unit: 'lbs', color: colors.charts.blue },
    { type: 'blood-pressure', label: 'Blood Pressure', icon: '🩺', unit: 'mmHg', color: colors.charts.red },
    { type: 'heart-rate', label: 'Heart Rate', icon: '❤️', unit: 'bpm', color: colors.charts.pink },
    { type: 'sleep', label: 'Sleep', icon: '😴', unit: 'hours', color: colors.charts.purple },
    { type: 'steps', label: 'Steps', icon: '👟', unit: 'steps', color: colors.charts.green },
    { type: 'mood', label: 'Mood', icon: '😊', unit: 'score', color: colors.charts.yellow },
    { type: 'water', label: 'Water', icon: '💧', unit: 'oz', color: colors.charts.teal },
    { type: 'exercise', label: 'Exercise', icon: '🏃', unit: 'minutes', color: colors.charts.indigo },
  ];

  const resetForm = () => {
    setFormData({
      type: 'weight',
      value: '',
      notes: '',
    });
    setSelectedMetricType(null);
  };

  const handleLogMetric = (type: WellnessMetric['type']) => {
    setSelectedMetricType(type);
    setFormData({
      type,
      value: '',
      notes: '',
    });
    setLogModalVisible(true);
  };

  const handleSaveMetric = () => {
    if (!formData.value) {
      Alert.alert('Validation Error', 'Please enter a value');
      return;
    }

    logMutation.mutate({
      type: formData.type,
      value: formData.value,
      notes: formData.notes || undefined,
    });
  };

  const getMetricInfo = (type: WellnessMetric['type']) => {
    return metricTypes.find(m => m.type === type);
  };

  const getSummary = (type: WellnessMetric['type']) => {
    return summaries?.find(s => s.type === type);
  };

  const getTrendIcon = (trend?: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return '📈';
      case 'down':
        return '📉';
      case 'stable':
        return '➡️';
      default:
        return '—';
    }
  };

  const renderMetricCard = (metricType: typeof metricTypes[0]) => {
    const summary = getSummary(metricType.type as WellnessMetric['type']);

    return (
      <TouchableOpacity
        key={metricType.type}
        style={[styles.metricCard, { borderLeftColor: metricType.color }]}
        onPress={() => handleLogMetric(metricType.type as WellnessMetric['type'])}
        activeOpacity={0.7}
      >
        <View style={styles.metricHeader}>
          <Text style={styles.metricIcon}>{metricType.icon}</Text>
          <View style={styles.metricTitleContainer}>
            <Text style={styles.metricTitle}>{metricType.label}</Text>
            {summary?.trend && (
              <Text style={styles.trendIcon}>{getTrendIcon(summary.trend)}</Text>
            )}
          </View>
        </View>

        <View style={styles.metricBody}>
          {summary?.current !== undefined ? (
            <>
              <Text style={[styles.metricValue, { color: metricType.color }]}>
                {summary.current}
              </Text>
              <Text style={styles.metricUnit}>{metricType.unit}</Text>
            </>
          ) : (
            <Text style={styles.metricNoData}>No data</Text>
          )}
        </View>

        {summary?.average !== undefined && (
          <View style={styles.metricFooter}>
            <Text style={styles.metricAverage}>
              Avg: {summary.average} {metricType.unit}
            </Text>
            {summary.goal && (
              <Text style={styles.metricGoal}>
                Goal: {summary.goal} {metricType.unit}
              </Text>
            )}
          </View>
        )}

        <View style={styles.logButton}>
          <Text style={styles.logButtonText}>+ Log</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderTrendChart = () => {
    // Simple placeholder for trend visualization
    // In production, use a charting library like react-native-chart-kit or Victory Native
    return (
      <View style={styles.trendSection}>
        <View style={styles.trendHeader}>
          <Text style={styles.trendTitle}>Activity Trends</Text>
          <View style={styles.timeRangeButtons}>
            {(['week', 'month', 'year'] as const).map(range => (
              <TouchableOpacity
                key={range}
                style={[
                  styles.timeRangeButton,
                  timeRange === range && styles.timeRangeButtonActive,
                ]}
                onPress={() => setTimeRange(range)}
              >
                <Text
                  style={[
                    styles.timeRangeText,
                    timeRange === range && styles.timeRangeTextActive,
                  ]}
                >
                  {range.charAt(0).toUpperCase() + range.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.chartPlaceholder}>
          <Text style={styles.chartIcon}>📊</Text>
          <Text style={styles.chartText}>Trend visualization</Text>
          <Text style={styles.chartSubtext}>
            Use react-native-chart-kit or Victory Native for production
          </Text>
        </View>
      </View>
    );
  };

  const renderRecentLogs = () => {
    if (!metrics || metrics.length === 0) return null;

    const recentMetrics = metrics.slice(0, 5);

    return (
      <View style={styles.recentSection}>
        <Text style={styles.sectionTitle}>Recent Logs</Text>
        {recentMetrics.map((metric, index) => {
          const metricInfo = getMetricInfo(metric.type);
          return (
            <View key={`${metric.id}-${index}`} style={styles.recentItem}>
              <View style={styles.recentIconContainer}>
                <Text style={styles.recentIcon}>{metricInfo?.icon || '📊'}</Text>
              </View>
              <View style={styles.recentInfo}>
                <Text style={styles.recentLabel}>{metricInfo?.label || metric.type}</Text>
                <Text style={styles.recentDate}>
                  {new Date(metric.date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </Text>
              </View>
              <View style={styles.recentValue}>
                <Text style={styles.recentValueText}>
                  {metric.value} {metric.unit}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  if (isLoading && !metrics) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.domains.healthcare} />
        <Text style={styles.loadingText}>Loading wellness data...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorTitle}>Failed to load wellness data</Text>
        <Text style={styles.errorText}>{(error as any).message}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Wellness Tracking</Text>
        <Text style={styles.headerSubtitle}>Track your daily health metrics</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refetch}
            tintColor={colors.domains.healthcare}
          />
        }
      >
        {/* Metrics Grid */}
        <View style={styles.metricsGrid}>
          {metricTypes.map(renderMetricCard)}
        </View>

        {/* Trend Chart */}
        {renderTrendChart()}

        {/* Recent Logs */}
        {renderRecentLogs()}
      </ScrollView>

      {/* Log Metric Modal */}
      <Modal
        visible={logModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setLogModalVisible(false);
          resetForm();
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleContainer}>
                <Text style={styles.modalIcon}>
                  {getMetricInfo(formData.type)?.icon || '📊'}
                </Text>
                <Text style={styles.modalTitle}>
                  Log {getMetricInfo(formData.type)?.label || 'Metric'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setLogModalVisible(false);
                  resetForm();
                }}
              >
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>
                  Value ({getMetricInfo(formData.type)?.unit})
                </Text>
                <TextInput
                  style={styles.input}
                  value={formData.value}
                  onChangeText={(text) => setFormData({ ...formData, value: text })}
                  placeholder={`Enter ${getMetricInfo(formData.type)?.label.toLowerCase()}`}
                  placeholderTextColor={colors.gray[400]}
                  keyboardType={formData.type === 'mood' ? 'default' : 'numeric'}
                  autoFocus
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Notes (optional)</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={formData.notes}
                  onChangeText={(text) => setFormData({ ...formData, notes: text })}
                  placeholder="Add any notes..."
                  placeholderTextColor={colors.gray[400]}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => {
                    setLogModalVisible(false);
                    resetForm();
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.saveButton]}
                  onPress={handleSaveMetric}
                  disabled={logMutation.isPending}
                >
                  {logMutation.isPending ? (
                    <ActivityIndicator color="#FFF" size="small" />
                  ) : (
                    <Text style={styles.saveButtonText}>Log Metric</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
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
  loadingText: {
    ...textStyles.body,
    color: colors.text.light.secondary,
    marginTop: spacing[4],
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[6],
    backgroundColor: colors.light.secondary,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: spacing[4],
  },
  errorTitle: {
    ...textStyles.h3,
    color: colors.text.light.primary,
    marginBottom: spacing[2],
  },
  errorText: {
    ...textStyles.body,
    color: colors.text.light.secondary,
    textAlign: 'center',
    marginBottom: spacing[6],
  },
  retryButton: {
    backgroundColor: colors.domains.healthcare,
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[3],
    borderRadius: borderRadius.lg,
  },
  retryButtonText: {
    ...textStyles.button,
    color: '#FFF',
  },
  header: {
    backgroundColor: '#FFF',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
  },
  headerTitle: {
    ...textStyles.h2,
    color: colors.text.light.primary,
  },
  headerSubtitle: {
    ...textStyles.bodySmall,
    color: colors.text.light.secondary,
    marginTop: spacing[1],
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing[4],
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[3],
    marginBottom: spacing[6],
  },
  metricCard: {
    backgroundColor: '#FFF',
    borderRadius: borderRadius.lg,
    padding: spacing[4],
    width: '48%',
    ...shadows.md,
    borderLeftWidth: 4,
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[3],
  },
  metricIcon: {
    fontSize: 24,
    marginRight: spacing[2],
  },
  metricTitleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metricTitle: {
    ...textStyles.label,
    color: colors.text.light.primary,
  },
  trendIcon: {
    fontSize: 14,
  },
  metricBody: {
    marginBottom: spacing[2],
    minHeight: 40,
  },
  metricValue: {
    ...textStyles.h2,
    fontSize: typography.sizes['3xl'],
  },
  metricUnit: {
    ...textStyles.bodySmall,
    color: colors.text.light.secondary,
    marginTop: -spacing[1],
  },
  metricNoData: {
    ...textStyles.body,
    color: colors.text.light.tertiary,
  },
  metricFooter: {
    borderTopWidth: 1,
    borderTopColor: colors.light.border,
    paddingTop: spacing[2],
    marginBottom: spacing[2],
  },
  metricAverage: {
    ...textStyles.caption,
    color: colors.text.light.secondary,
    marginBottom: spacing[1],
  },
  metricGoal: {
    ...textStyles.caption,
    color: colors.text.light.tertiary,
  },
  logButton: {
    backgroundColor: colors.light.secondary,
    paddingVertical: spacing[2],
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  logButtonText: {
    ...textStyles.label,
    color: colors.domains.healthcare,
  },
  trendSection: {
    backgroundColor: '#FFF',
    borderRadius: borderRadius.lg,
    padding: spacing[4],
    marginBottom: spacing[4],
    ...shadows.md,
  },
  trendHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[4],
  },
  trendTitle: {
    ...textStyles.h4,
    color: colors.text.light.primary,
  },
  timeRangeButtons: {
    flexDirection: 'row',
    gap: spacing[1],
  },
  timeRangeButton: {
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: borderRadius.md,
    backgroundColor: colors.light.secondary,
  },
  timeRangeButtonActive: {
    backgroundColor: colors.domains.healthcare,
  },
  timeRangeText: {
    ...textStyles.labelSmall,
    color: colors.text.light.secondary,
  },
  timeRangeTextActive: {
    color: '#FFF',
  },
  chartPlaceholder: {
    height: 200,
    backgroundColor: colors.light.secondary,
    borderRadius: borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chartIcon: {
    fontSize: 48,
    marginBottom: spacing[2],
  },
  chartText: {
    ...textStyles.body,
    color: colors.text.light.primary,
    marginBottom: spacing[1],
  },
  chartSubtext: {
    ...textStyles.caption,
    color: colors.text.light.tertiary,
    textAlign: 'center',
    paddingHorizontal: spacing[4],
  },
  recentSection: {
    backgroundColor: '#FFF',
    borderRadius: borderRadius.lg,
    padding: spacing[4],
    ...shadows.md,
  },
  sectionTitle: {
    ...textStyles.h4,
    color: colors.text.light.primary,
    marginBottom: spacing[3],
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
  },
  recentIconContainer: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    backgroundColor: colors.light.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing[3],
  },
  recentIcon: {
    fontSize: 20,
  },
  recentInfo: {
    flex: 1,
  },
  recentLabel: {
    ...textStyles.body,
    color: colors.text.light.primary,
    marginBottom: spacing[1],
  },
  recentDate: {
    ...textStyles.caption,
    color: colors.text.light.secondary,
  },
  recentValue: {
    alignItems: 'flex-end',
  },
  recentValueText: {
    ...textStyles.h4,
    color: colors.text.light.primary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay.light,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: borderRadius['2xl'],
    borderTopRightRadius: borderRadius['2xl'],
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
  },
  modalTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalIcon: {
    fontSize: 32,
    marginRight: spacing[3],
  },
  modalTitle: {
    ...textStyles.h3,
    color: colors.text.light.primary,
  },
  modalClose: {
    fontSize: 24,
    color: colors.text.light.secondary,
    fontWeight: typography.weights.bold,
  },
  modalBody: {
    padding: spacing[4],
  },
  formGroup: {
    marginBottom: spacing[4],
  },
  formLabel: {
    ...textStyles.label,
    color: colors.text.light.primary,
    marginBottom: spacing[2],
  },
  input: {
    ...textStyles.body,
    color: colors.text.light.primary,
    backgroundColor: colors.light.secondary,
    borderWidth: 1,
    borderColor: colors.light.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
    minHeight: 44,
  },
  textArea: {
    minHeight: 80,
    paddingTop: spacing[3],
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing[3],
    marginTop: spacing[4],
  },
  modalButton: {
    flex: 1,
    paddingVertical: spacing[3],
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: colors.gray[200],
  },
  cancelButtonText: {
    ...textStyles.button,
    color: colors.text.light.primary,
  },
  saveButton: {
    backgroundColor: colors.domains.healthcare,
  },
  saveButtonText: {
    ...textStyles.button,
    color: '#FFF',
  },
});
